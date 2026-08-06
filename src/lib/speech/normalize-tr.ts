import { kesriOku } from "@/lib/speech/number-tr";

/**
 * Metni Türkçe TTS motorunun doğru okuyacağı hâle getirir.
 *
 * Konu özetleri hukuk metnidir: madde referansları, kesirler, oranlar, tarihler
 * ve aralık tireleri yoğundur. Bunların çoğunu motor zaten doğru okur; burada
 * YALNIZCA ölçülüp yanlış okunduğu görülen yapılar ele alınıyor. Her kural
 * `content/subjects/**` altındaki gerçek bir dizeye dayanıyor ve testi o dizeyle
 * yazılmıştır.
 *
 * ⚠️ **`toLowerCase()` YOKTUR ve olmamalıdır.** Varsayılan yerel ayar "I"yı "i"
 * yapar (AGENTS.md Türkçe tuzağı); ayrıca TTS'e verilen metnin özgün yazımı
 * korunmalıdır — telaffuz ona bağlıdır. `lib/search/normalize.ts` içindeki
 * `foldForSearch` bu yüzden buraya KARIŞTIRILMAMALIDIR: o aksanları siler
 * (`ğ→g`, `ş→s`) ve sesi bozar; yalnızca eşleştirme içindir.
 *
 * ⚠️ **Lookbehind (`(?<!...)`) kullanılmaz.** Eski Android WebView'lerde
 * lookbehind ayrıştırma anında SyntaxError verir ve modülün tamamını öldürür —
 * çalışma anında yakalanamayan bir hata. Tüm kurallar capture grubu ve
 * lookahead ile yazılmıştır (ikisi de her yerde güvenli).
 *
 * `lib/` kuralı gereği React ve DOM görmez.
 */

/**
 * Türkçe harf adları.
 *
 * ⚠️ **Tek başına duran büyük harfi motorlar ROMEN RAKAMI sanıyor.** Cihazda
 * ölçüldü: "Fıkra C" → "Fıkra yüz", "Fıkra D" → "Fıkra beş yüz" (C=100, D=500).
 * Hata tam olarak bu iki harfte bildirildi; A ve B romen rakamı olmadığı için
 * doğru okunuyordu. Aynı tuzak I, V, X, L ve M için de geçerlidir.
 *
 * Harf adını YAZMAK sesi motorun yorumuna bırakmaz: "ce" sıradan bir Türkçe
 * sözcük gibi okunur ve harfin adıyla birebir aynı sesi verir.
 *
 * ⚠️ Bu tablo yalnızca harfin **fıkra/bent adı olduğu KESİN** olduğu yerlerde
 * uygulanır (bkz. 7. adım, 15. adım ve `table.ts`). Genel bir "tek harfi
 * çevir" kuralı yazılamaz, çünkü romen rakamı bazen BİLİNÇLİDİR:
 * "(I) sayılı cetvel" ifadesinde motorun "bir" okuması doğru olandır
 * (`devlet-teskilati/ust-kademe-kamu-yoneticileri.mdx`).
 */
const HARF_ADLARI: Record<string, string> = {
	A: "a",
	B: "be",
	C: "ce",
	Ç: "çe",
	D: "de",
	E: "e",
	F: "fe",
	G: "ge",
	Ğ: "yumuşak ge",
	H: "he",
	I: "ı",
	İ: "i",
	J: "je",
	K: "ke",
	L: "le",
	M: "me",
	N: "ne",
	O: "o",
	Ö: "ö",
	P: "pe",
	Q: "ku",
	R: "re",
	S: "se",
	Ş: "şe",
	T: "te",
	U: "u",
	Ü: "ü",
	V: "ve",
	W: "çift ve",
	X: "iks",
	Y: "ye",
	Z: "ze",
};

/** Bir harfin Türkçe adı; harf değilse `null`. */
export function harfAdi(harf: string): string | null {
	return HARF_ADLARI[harf] ?? null;
}

const AYLAR = [
	"Ocak",
	"Şubat",
	"Mart",
	"Nisan",
	"Mayıs",
	"Haziran",
	"Temmuz",
	"Ağustos",
	"Eylül",
	"Ekim",
	"Kasım",
	"Aralık",
] as const;

/**
 * Metni seslendirmeye hazırlar.
 *
 * ⚠️ **ADIM SIRASI BAĞLAYICIDIR.** Üç yerde bir adım kendinden sonrakinin
 * girdisini üretiyor; sıra bozulursa kurallar sessizce tetiklenmez ve hata
 * ancak kulakla fark edilir. Gerekçeler adımların yanında, regresyon testleri
 * `tests/unit/speech-normalize.test.ts` içinde.
 */
export function konusmaMetni(ham: string): string {
	let metin = ham;

	// 1 — Unicode temizliği. Kesme işaretinin tipografik biçimi bazı motorlarda
	//     sözcüğü böler; bölünmez boşluk ve yumuşak tire sessizce sorun çıkarır.
	metin = metin
		.replace(/ /g, " ")
		.replace(/­/g, "")
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"');

	// 2 — `<Madde>` bileşeninin çıktısı: "657 s.K. m.125".
	//     15. adımdaki genel "m.N" kuralından ÖNCE olmalı; sonra gelseydi
	//     "657 s.K. madde 125" kalır ve bu kural hiç eşleşmezdi.
	metin = metin.replace(
		/(\d+)\s*s\.\s*K\.\s*m\.\s*(\d+)/g,
		"$1 sayılı Kanun madde $2",
	);

	// 3 — Tarihler. 7. ve 9. adımdan ÖNCE olmalı: "1/2/2018" önce kesir kuralına
	//     yakalanırsa "ikide bir /2018" olur.
	metin = metin.replace(
		/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
		(tam, gun: string, ay: string, yil: string) => {
			const ayNo = Number(ay);
			if (ayNo < 1 || ayNo > 12) return tam;
			return `${Number(gun)} ${AYLAR[ayNo - 1]} ${yil}`;
		},
	);

	// 4 — Yüzde aralığı. 5. adımdan önce, çünkü "%15-%50" içindeki tire
	//     karşılaştırma kuralının ilgi alanına girmez ama yüzde kuralı ikisini
	//     de tüketirse aralık kaybolur.
	metin = metin.replace(/%(\d+)\s*-\s*%(\d+)/g, "yüzde $1 ila yüzde $2");

	// 5 — Karşılaştırma. Motorlar "<" ve ">" işaretlerini ya atlar ya da
	//     "küçüktür/büyüktür" der; ikisi de cümleyi bozar.
	//
	//     "altı/üzeri" bilinçli seçim: "2.000'den küçük" demek ünlü uyumuna göre
	//     'den/'dan/'ten/'tan üretmeyi gerektirirdi — sayının OKUNUŞUNA bağlı,
	//     kırılgan. "2.000 altı" eksiksiz Türkçedir ve hiç morfoloji istemez.
	//
	//     Yüzde işareti bu adımda birlikte yakalanır; 6. adıma bırakılsaydı
	//     ">%50" önce ">yüzde 50" olur ve bu regex rakam bulamazdı.
	metin = metin.replace(
		/([<>])\s*(%?)\s*([\d.]+)/g,
		(_tam, yon: string, yuzde: string, sayi: string) => {
			const govde = yuzde ? `yüzde ${sayi}` : sayi;
			return `${govde} ${yon === ">" ? "üzeri" : "altı"}`;
		},
	);

	// 6 — Kalan yüzdeler.
	metin = metin.replace(/%\s*(\d+)/g, "yüzde $1");

	// 7 — Fıkra/bent gösterimi: "4/A", "48/A".
	//     Sözcük EKLENMEZ: içerikte hem 4/A (fıkra) hem 48/A (bent) geçiyor ve
	//     tek bir sabit sözcük ikisine birden uymuyor.
	//     Harf ADIYLA yazılır: burada harfin bir fıkra/bent adı olduğu kesindir
	//     ve düz bırakılırsa "4/C" motorda "dört yüz", "4/D" "dört beş yüz"
	//     oluyor (romen rakamı yorumu — bkz. HARF_ADLARI).
	//     Lookahead, "A/B testi" gibi harf-harf yapılarını dışarıda tutar.
	metin = metin.replace(
		/(\d{1,3})\/([A-ZÇĞİÖŞÜ])(?![A-Za-zÇĞİÖŞÜçğıöşü])/g,
		(_tam, sayi: string, harf: string) => `${sayi} ${harfAdi(harf) ?? harf}`,
	);

	// 8 — Aralık tiresi (en tire / em tire). 9. adımdan ÖNCE olmalı: "1/30 – 1/8"
	//     içindeki kesirler önce sözcüğe çevrilirse tire iki RAKAM arasında
	//     kalmaz ve bu kural hiç tetiklenmez.
	metin = metin.replace(/(\d)\s*[–—]\s*(?=\d)/g, "$1 ila ");

	// 9 — Kesirler. Motorların gerçekten yanlış okuduğu ikinci yapı.
	metin = metin.replace(
		/\b(\d{1,4})\/(\d{1,4})\b/g,
		(tam, pay: string, payda: string) =>
			kesriOku(Number(pay), Number(payda)) ?? tam,
	);

	// 10 — Mevzuat kısaltmaları.
	metin = metin.replace(/\bKHK-(\d+)/g, "KHK $1");

	// 11 — BOŞLUKLU eğik çizgi seçenek anlamı taşır ("20 gün / 30 gün",
	//      "Başdanışman / Danışman") ve motor onu "bölü" diye okur.
	//      Boşluk şartı bu kuralı kesirlerden ve "4/A"dan tamamen ayırır;
	//      onlarda eğik çizginin iki yanı bitişiktir.
	metin = metin.replace(/ \/ /g, " veya ");

	// 12 — Orta nokta ayracı (`<Sayi>` bloklarında yoğun).
	//
	//      NOKTA DEĞİL, NOKTALI VİRGÜL. "AYM: 15 üye · 12 + 3 · 12 yıl · 65 yaş
	//      haddi" bir LİSTEDİR, cümle dizisi değil; nokta beş ayrı tam durak ve
	//      beş kez düşen kontur üretiyordu. Noktalı virgül orta uzunlukta bir
	//      duraklama verir ve sonlandırıcı konturu uygulamaz.
	//
	//      Ek kazanç: `cumlelereBol` yalnızca `.!?…` üzerinden böldüğü için
	//      `<Sayi>` bloğu artık tek utterance kalır.
	metin = metin.replace(/\s*·\s*/g, "; ");

	// 13 — Ok işareti: sıralama anlamı taşır, virgül duraklaması yeterli.
	metin = metin.replace(/\s*→\s*/g, ", ");

	// 14 — Rakam arasında kalmayan en/em tireler (tanım tiresi): virgül.
	metin = metin.replace(/\s*[–—]\s*/g, ", ");

	// 15 — Parantez içindeki fıkra/bent harfleri.
	//
	//      İki biçim var ve ikisi de gerçek içerikten: "(C) fıkrası" ve
	//      "3 (A, B, D)" (657-dmk/genel-hukumler.mdx). Düz bırakılırsa motor
	//      C'yi "yüz", D'yi "beş yüz" okuyor.
	//
	//      Kural BAĞLAMA BAĞLIDIR ve öyle kalmalıdır: tek harfi her yerde
	//      çevirmek "(I) sayılı cetvel" ifadesini bozardı — orada romen rakamı
	//      bilinçlidir ve motorun "bir" okuması DOĞRUDUR. Bu yüzden tek harf
	//      yalnızca ardından "fıkra/bent" sözcüğü gelirse, harf listesi ise
	//      yalnızca en az iki harf varsa çevrilir; "(I)" hiçbirine uymaz.
	metin = metin.replace(
		/\(([A-ZÇĞİÖŞÜ])\)(?=\s+(?:fıkra|bent|bend))/g,
		(tam, harf: string) => {
			const ad = harfAdi(harf);
			return ad === null ? tam : `(${ad})`;
		},
	);
	metin = metin.replace(
		/\(([A-ZÇĞİÖŞÜ](?:,\s*[A-ZÇĞİÖŞÜ])+)\)/g,
		(_tam, liste: string) =>
			`(${liste
				.split(",")
				.map((h) => harfAdi(h.trim()) ?? h.trim())
				.join(", ")})`,
	);

	// 16 — Genel kısaltmalar. "m.N" kuralı 2. adımdan sonra gelmek zorunda.
	metin = metin
		.replace(/\bmd\.\s*(\d+)/g, "madde $1")
		.replace(/\bm\.\s*(\d+)/g, "madde $1")
		.replace(/\bvb\./g, "ve benzeri")
		.replace(/\bvs\./g, "vesaire")
		.replace(/\bbkz\./g, "bakınız");

	// 17 — Sadeleştirme: art arda düşen noktalama ve boşluklar.
	metin = metin
		.replace(/\s+/g, " ")
		.replace(/\s+([.,;:!?])/g, "$1")
		.replace(/\.\s*\./g, ".")
		.replace(/,\s*,/g, ",")
		.trim();

	return metin;
}
