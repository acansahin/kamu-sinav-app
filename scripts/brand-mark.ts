/**
 * Marka işaretinin geometrisi — TEK KAYNAK.
 *
 * Bu dosya `generate-icons.ts`ten ayrıldı çünkü işareti artık ikinci bir
 * üretici de kullanıyor (`scripts/social/card.ts`, sosyal medya kartları).
 * `generate-icons.ts` modül düzeyinde `main()` çağırıyor — oradan `import`
 * etmek her sosyal paylaşımda ikonları ve Android kaynaklarını yeniden
 * yazardı.
 *
 * Ayrı tutmanın gerekçesi ikonlarla splash vektörünün ortak `COLUMN_PATH`
 * paylaşmasıyla aynı: geometri kopyalandığında logo değişince kopyalar
 * sessizce ayrışıyor ve fark ancak üretilmiş görsele bakınca görülüyor.
 */

/** Tüm ikonların ortak tuval boyu; her çıktı bundan küçültülür. */
export const CANVAS = 512;

/**
 * Yuvarlatılmış dikdörtgeni `pathData` olarak yazar.
 *
 * `<rect rx>` KULLANILMAZ, çünkü aynı geometri Android açılış ekranının
 * VectorDrawable'ına da gidiyor ve o biçim yalnızca `<path>`, `<group>` ve
 * `<clip-path>` tanır — `<rect>` ve `rx` yoktur. Tek dize üretip iki yerde
 * kullanmak, işaretin ikiye ayrılıp sessizce ayrışmasını imkânsız kılar.
 *
 * Virgül/boşluk karışımı bilinçli: hem SVG hem Android'in PathParser'ı okur.
 */
export function roundedRect(
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
): string {
	const right = x + w;
	const bottom = y + h;

	return [
		`M${x + r},${y}`,
		`H${right - r}`,
		`A${r},${r} 0 0 1 ${right},${y + r}`,
		`V${bottom - r}`,
		`A${r},${r} 0 0 1 ${right - r},${bottom}`,
		`H${x + r}`,
		`A${r},${r} 0 0 1 ${x},${bottom - r}`,
		`V${y + r}`,
		`A${r},${r} 0 0 1 ${x + r},${y}`,
		"Z",
	].join(" ");
}

/**
 * Marka işareti: klasik sütun — başlık, üç yiv, taban.
 *
 * Kamu kurumu / hukuk çağrışımı taşır ve önceki tik işaretinin aksine
 * kategoride ayrışır. Tamamı DOLU form: ince bir stroke'un mdpi 48px
 * launcher'da eriyip gitmesi riski yok.
 *
 * Sınır kutusu 104..408 × 119..393, yani merkezi tam (256, 256). Yuvarlak
 * maskede yarı köşegen 205 < 256; maskable'da (0.72 ölçek) 148 < 205; adaptive
 * ön planda (0.9 ölçek) genişlik tuvalin %53'ü, Android'in istediği iç %61'in
 * içinde. Parçaların yönü aynı (saat yönü), nonzero dolgu delik açmaz.
 *
 * Dikey boşluklar bilinçli olarak eşittir (başlık↔yiv ve yiv↔taban = 18):
 * eşit olmayan boşluk küçük boyutta sütunu "kaymış" gösteriyordu.
 */
export const COLUMN_PATH = [
	roundedRect(124, 119, 264, 44, 14), // başlık
	roundedRect(161, 181, 38, 146, 19), // yiv
	roundedRect(237, 181, 38, 146, 19), // yiv
	roundedRect(313, 181, 38, 146, 19), // yiv
	roundedRect(104, 345, 304, 48, 14), // taban
].join(" ");
