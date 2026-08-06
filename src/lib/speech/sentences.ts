import {
	PARCA_ALT_SINIR,
	PARCA_MUTLAK_TAVAN,
	PARCA_UST_SINIR,
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
 * Uzun bir cümleyi doğal bir noktadan böler.
 *
 * Sıra: önce `;`, sonra `,`, sonra üst sınıra en yakın kelime boşluğu. Hiçbiri
 * yoksa mutlak tavandan kesilir — bölünemeyen bir cümle, dinleyiciyi
 * duraklatamaz hâle getirmektense ortadan kesilir.
 */
function uzunuBol(cumle: string): string[] {
	if (cumle.length <= PARCA_UST_SINIR) return [cumle];

	const pencere = cumle.slice(0, PARCA_UST_SINIR);
	const aday =
		pencere.lastIndexOf(";") > 0
			? pencere.lastIndexOf(";")
			: pencere.lastIndexOf(",") > 0
				? pencere.lastIndexOf(",")
				: pencere.lastIndexOf(" ");

	const kesim = aday > 0 ? aday + 1 : Math.min(PARCA_MUTLAK_TAVAN, cumle.length);

	const bas = cumle.slice(0, kesim).trim();
	const kalan = cumle.slice(kesim).trim();

	if (kalan.length === 0) return [bas];
	return [bas, ...uzunuBol(kalan)];
}

/**
 * Bir bloğun metnini seslendirme parçalarına çevirir.
 *
 * Kısa cümleler birleştirilir, uzunlar bölünür. Birleştirme YALNIZCA blok
 * içinde yapılır: iki ayrı paragrafın cümlelerini tek parçaya koymak,
 * vurgulamanın hangi bloğa ait olduğunu belirsizleştirirdi.
 */
export function parcalaraAyir(metin: string): string[] {
	const cumleler = cumlelereBol(metin).flatMap(uzunuBol);
	const parcalar: string[] = [];

	for (const cumle of cumleler) {
		const oncekiIndeks = parcalar.length - 1;
		const onceki = parcalar[oncekiIndeks];

		if (
			onceki !== undefined &&
			onceki.length < PARCA_ALT_SINIR &&
			onceki.length + cumle.length + 1 <= PARCA_UST_SINIR
		) {
			parcalar[oncekiIndeks] = `${onceki} ${cumle}`;
			continue;
		}
		parcalar.push(cumle);
	}

	return parcalar;
}
