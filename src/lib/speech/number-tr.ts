/**
 * Türkçe sayı okunuşu — YALNIZCA kesirler için.
 *
 * Bu modülün var olma sebebi dar: `1/30` gibi bir kesri doğru seslendirmenin tek
 * yolu paydayı sözcüğe çevirip bulunma hâli eki eklemektir ("otuzda bir").
 * Rakamın kendisi TTS motoruna verilseydi "bir bölü otuz" ya da "bir eğik çizgi
 * otuz" diye okunurdu.
 *
 * **Başka hiçbir yerde rakamlar sözcüğe çevrilmez.** Her TTS motoru tamsayıyı
 * kendi diline göre zaten doğru okur; onu elle çevirmek yalnızca hata yüzeyi
 * ekler. Motorların GERÇEKTEN yanlış okuduğu iki yapı vardır: kesirler ve
 * `<`/`>` karşılaştırmaları. İlki burada, ikincisi `normalize-tr.ts` içinde
 * çözülür.
 *
 * `lib/` kuralı gereği React ve DOM görmez; tamamen saf ve testlidir.
 */

const BIRLER = [
	"",
	"bir",
	"iki",
	"üç",
	"dört",
	"beş",
	"altı",
	"yedi",
	"sekiz",
	"dokuz",
] as const;

const ONLAR = [
	"",
	"on",
	"yirmi",
	"otuz",
	"kırk",
	"elli",
	"altmış",
	"yetmiş",
	"seksen",
	"doksan",
] as const;

/**
 * 0–9999 arası bir tamsayının okunuşu.
 *
 * Üst sınır bilinçli: kesir paydası olarak dört basamaktan büyük bir sayı
 * içerikte geçmiyor ve geçseydi zaten sözcüğe çevirmek okunabilirliği
 * artırmazdı. Aralık dışında boş dize döner; çağıran taraf o hâlde rakamı
 * olduğu gibi bırakır.
 */
export function sayiyiOku(sayi: number): string {
	if (!Number.isInteger(sayi) || sayi < 0 || sayi > 9999) return "";
	if (sayi === 0) return "sıfır";

	const parcalar: string[] = [];
	let kalan = sayi;

	const binler = Math.floor(kalan / 1000);
	if (binler > 0) {
		// "bir bin" denmez, "bin" denir.
		parcalar.push(binler === 1 ? "bin" : `${BIRLER[binler]} bin`);
		kalan %= 1000;
	}

	const yuzler = Math.floor(kalan / 100);
	if (yuzler > 0) {
		// "bir yüz" denmez, "yüz" denir.
		parcalar.push(yuzler === 1 ? "yüz" : `${BIRLER[yuzler]} yüz`);
		kalan %= 100;
	}

	const onlar = Math.floor(kalan / 10);
	if (onlar > 0) parcalar.push(ONLAR[onlar]);

	const birler = kalan % 10;
	if (birler > 0) parcalar.push(BIRLER[birler]);

	return parcalar.join(" ");
}

/** Kalın ünlüler — bulunma eki `-da/-ta` alır. */
const KALIN_UNLULER = "aıou";
/** Sert ünsüzler (fıstıkçı şahap) — ek sertleşir: `-ta/-te`. */
const SERT_UNSUZLER = "fstkçşhp";

/**
 * Bulunma hâli eki (`-da/-de/-ta/-te`).
 *
 * İki kural birlikte çalışır ve ikisi de sözcüğün SONUNDAN okunur:
 *   - Büyük ünlü uyumu: son ünlü kalınsa `a`, inceyse `e`.
 *   - Ünsüz benzeşmesi: son harf sert ünsüzse `d` → `t`.
 *
 * Örnekler: otuz→otuz**da**, sekiz→sekiz**de**, dört→dört**te**,
 * kırk→kırk**ta**, beş→beş**te**, yüz→yüz**de**, bin→bin**de**.
 */
export function bulunmaEki(sozcuk: string): string {
	if (sozcuk.length === 0) return "de";

	// Son ünlü aranır; sözcük sonundan başa doğru ilk ünlü hangisiyse odur.
	let kalin = false;
	for (let i = sozcuk.length - 1; i >= 0; i -= 1) {
		const harf = sozcuk[i];
		if ("aeıioöuü".includes(harf)) {
			kalin = KALIN_UNLULER.includes(harf);
			break;
		}
	}

	const sonHarf = sozcuk[sozcuk.length - 1];
	const sert = SERT_UNSUZLER.includes(sonHarf);

	if (sert) return kalin ? "ta" : "te";
	return kalin ? "da" : "de";
}

/**
 * Kesri okunabilir hâle getirir: `1/30` → "otuzda bir".
 *
 * Payda okunamıyorsa (aralık dışı) `null` döner ve çağıran taraf ifadeyi
 * olduğu gibi bırakır — yanlış okumaktansa dokunmamak yeğdir.
 */
export function kesriOku(pay: number, payda: number): string | null {
	const paydaSozcuk = sayiyiOku(payda);
	const paySozcuk = sayiyiOku(pay);
	if (!paydaSozcuk || !paySozcuk) return null;

	// Ek, paydanın SON sözcüğüne göre belirlenir: "iki bin" → "iki binde".
	const sonSozcuk = paydaSozcuk.split(" ").at(-1) ?? paydaSozcuk;
	return `${paydaSozcuk}${bulunmaEki(sonSozcuk)} ${paySozcuk}`;
}
