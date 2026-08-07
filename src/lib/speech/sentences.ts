import {
	BLOK_UST_SINIR,
	DURAK_ISARETI,
	MOTOR_TAVANI,
} from "@/lib/speech/types";

/**
 * Metni seslendirme parçalarına böler.
 *
 * Naif bir `/[.!?]\s/` bu içerikte üç ayrı yerde kırılır ve üçü de gerçek:
 *   - "127. maddeye göre" — sıra sayısı, cümle sonu değil
 *   - "2.000" / "100.000" — binlik ayracı
 *   - "657 s.K. m.1" — mevzuat kısaltması
 *
 * Bu yüzden bölme iki koşula birden bağlı: noktalama işaretinden SONRA büyük
 * harf gelmeli, ÖNCE de bilinen bir kısaltma olmamalı.
 *
 * `lib/` kuralı gereği React ve DOM görmez.
 */

/**
 * Nokta ile biten ama cümleyi bitirmeyen belirteçler.
 *
 * Tek harfli büyük kısaltmalar ayrıca kod içinde yakalanıyor (ör. "s.K." →
 * "K"), bu liste yalnızca çok harflileri sayar.
 */
const KISALTMALAR = new Set([
	"s",
	"K",
	"m",
	"md",
	"bkz",
	"vb",
	"vs",
	"Dr",
	"Doç",
	"Prof",
	"Sn",
	"No",
	"örn",
	"yy",
]);

const BUYUK_HARF = /[A-ZÇĞİÖŞÜ]/;

/** Noktadan hemen önceki belirteç bir kısaltma mı? */
function kisaltmaMi(metin: string, noktaIndeksi: number): boolean {
	let bas = noktaIndeksi - 1;
	while (bas >= 0 && /[^\s.]/.test(metin[bas])) bas -= 1;
	const belirtec = metin.slice(bas + 1, noktaIndeksi);

	if (belirtec.length === 0) return false;
	if (KISALTMALAR.has(belirtec)) return true;
	// Tek harfli büyük kısaltma: "s.K." içindeki "K".
	return belirtec.length === 1 && BUYUK_HARF.test(belirtec);
}

/**
 * Metni cümlelere ayırır.
 *
 * Bölme yalnızca `.!?…` + boşluk + büyük harf (ya da tırnak/parantez + büyük
 * harf) örüntüsünde yapılır. Rakamla devam eden bir noktadan sonrası aynı
 * cümlede kalır — `<Sayi>` bloklarındaki "15 gün. 30 gün. 6 ay" bilinçli
 * olarak tek parça olur, zaten kısadır.
 */
export function cumlelereBol(metin: string): string[] {
	const cumleler: string[] = [];
	let bas = 0;

	for (let i = 0; i < metin.length; i += 1) {
		const harf = metin[i];
		if (harf !== "." && harf !== "!" && harf !== "?" && harf !== "…") continue;

		// Ardışık noktalama ("…" veya "?!") tek sınır sayılır.
		let son = i;
		while (
			son + 1 < metin.length &&
			".!?…".includes(metin[son + 1])
		) {
			son += 1;
		}

		const sonrasi = metin.slice(son + 1);
		const eslesme = /^\s+["“(]?(.)/.exec(sonrasi);
		if (!eslesme) continue;
		if (!BUYUK_HARF.test(eslesme[1])) continue;
		if (harf === "." && kisaltmaMi(metin, i)) continue;

		const cumle = metin.slice(bas, son + 1).trim();
		if (cumle.length > 0) cumleler.push(cumle);
		bas = son + 1;
		i = son;
	}

	const kalan = metin.slice(bas).trim();
	if (kalan.length > 0) cumleler.push(kalan);

	return cumleler;
}

/**
 * Metni durak işaretlerinden ayırır ve işareti TÜKETİR.
 *
 * `konusmaMetni` tirenin yerine bu işareti koyuyor; her parça ayrı bir
 * `speak()` çağrısı olacağı için aradaki motor yeniden yapılandırması istenen
 * duraklamayı üretir (gerekçe: `types.ts` → DURAK_ISARETI).
 *
 * İşaretin motora ULAŞMAMASI bu fonksiyona bağlıdır — metni `speak()`e veren
 * her yol buradan geçmek zorundadır (`bloklaraAyir` ve `extract.ts`in tablo
 * dalı). Boş parçalar düşürülür: art arda gelen iki tire sessiz bir utterance
 * üretirdi.
 */
export function duraklardanBol(metin: string): string[] {
	return metin
		.split(DURAK_ISARETI)
		.map((parca) => parca.trim())
		.filter((parca) => parca.length > 0);
}

/**
 * Motorun girdi sınırına sığmayan bir parçayı kelime boşluğundan böler.
 *
 * Bu bir UX kuralı DEĞİL, son çare bir emniyet supabıdır: içerikte hiçbir blok
 * bu boyuta yaklaşmıyor. Yalnızca noktalamasız devasa bir dize geldiğinde
 * (bozuk içerik, yapıştırılmış tablo) motorun sessizce kesmesini engeller.
 */
export function motorTavaniniUygula(parca: string): string[] {
	if (parca.length <= MOTOR_TAVANI) return [parca];

	const pencere = parca.slice(0, MOTOR_TAVANI);
	const bosluk = pencere.lastIndexOf(" ");
	const kesim = bosluk > 0 ? bosluk + 1 : MOTOR_TAVANI;

	const bas = parca.slice(0, kesim).trim();
	const kalan = parca.slice(kesim).trim();

	if (kalan.length === 0) return [bas];
	return [bas, ...motorTavaniniUygula(kalan)];
}

/**
 * Bir bloğun metnini seslendirme parçalarına çevirir.
 *
 * Normal hâlde çıktı TEK parçadır — bloğun tamamı. Bölme yalnızca blok üst
 * sınırı aşıldığında ve YALNIZCA CÜMLE SINIRINDAN yapılır; virgülden bölmek
 * cümle ortasında tam durak ve düşen tonlama üretiyordu, kesik okumanın ikinci
 * sebebi buydu.
 *
 * Tek başına sınırı aşan bir cümle olduğu gibi bırakılır. Ölçülen en kötü hâl
 * `etik/etik-kurul-ve-mevzuat.mdx` içindeki 539 karakterlik tek cümledir ve onu
 * tek utterance vermek liste tonlamasını üreten şeyin kendisidir.
 */
export function bloklaraAyir(metin: string): string[] {
	// Durak işaretleri ÖNCE ayrılır ve bir daha birleştirilmez: aşağıdaki
	// açgözlü paketleme onları tekrar aynı parçaya toplarsa duraklama kaybolur.
	return duraklardanBol(metin).flatMap(cumleleriPaketle);
}

function cumleleriPaketle(metin: string): string[] {
	const cumleler = cumlelereBol(metin);
	const parcalar: string[] = [];

	// Açgözlü paketleme: sınırı aşana kadar cümleleri aynı parçada biriktir.
	for (const cumle of cumleler) {
		const oncekiIndeks = parcalar.length - 1;
		const onceki = parcalar[oncekiIndeks];

		if (
			onceki !== undefined &&
			onceki.length + cumle.length + 1 <= BLOK_UST_SINIR
		) {
			parcalar[oncekiIndeks] = `${onceki} ${cumle}`;
			continue;
		}
		parcalar.push(cumle);
	}

	return parcalar.flatMap(motorTavaniniUygula);
}
