import { writeFile } from "node:fs/promises";

import sharp from "sharp";

import { CANVAS, COLUMN_PATH, roundedRect } from "../brand-mark";
import {
	ACCENT,
	BRAND,
	BRAND_DARK,
	BRAND_LIGHT,
	CORRECT,
	FONT_STACK,
	JPEG_KALITE,
	KART_BOYUT,
	MARKA_ADI,
} from "./config";
import type { KartIcerigi } from "./types";

/**
 * Sosyal medya kartı: SVG çizilir, `sharp` (librsvg) JPEG'e çevirir.
 *
 * `generate-icons.ts` ile aynı yaklaşım — görsel ikili dosya olarak depoya
 * konmaz, koddan üretilir. Marka işareti `brand-mark.ts`ten gelir; kopyalanmaz.
 *
 * ⚠️ **SVG metni kendiliğinden sarmaz.** `<text>` tek satırdır ve tuvalden
 * taşan kısmı sessizce kaybolur — hata da vermez. Bu yüzden satır kırma ve
 * yazı boyutu seçimi burada, elle yapılır; genişlik ölçümü de yaklaşıktır
 * (aşağıya bakın). Ölçüm hatası tek yönlüdür: gerçekte olduğundan GENİŞ
 * tahmin edilir, böylece taşma yerine biraz erken satır kırılır.
 */

const PAD = 76;
const ICERIK_GENISLIGI = KART_BOYUT - PAD * 2;
/**
 * Gövdenin başladığı y — üstte rozet ve üst bilgi var.
 *
 * Bittiği y sabit DEĞİL: dayanak satırı varsa gövde erken biter. Sabit bir
 * alt sınır, uzun bir kanun adının künye şeridine binmesine yol açıyordu.
 */
const GOVDE_UST = 250;
const GOVDE_ALT_DAYANAKLI = 852;
const GOVDE_ALT_SADE = 908;
/** Dayanak satırının üst kenarı ve ona ayrılan yükseklik. */
const DAYANAK_Y = 862;
const DAYANAK_YUKSEKLIGI = 68;
/** Künye şeridinin (ayraç + logo + marka adı) başladığı y. */
const KUNYE_Y = 940;

/** Satır yüksekliği çarpanı; 1.3 altında Türkçe'de "ğ" ile "İ" çakışıyor. */
const SATIR_ARALIGI = 1.34;

/**
 * DejaVu Sans için yaklaşık karakter genişlikleri (em cinsinden).
 *
 * Gerçek ölçüm için font dosyasını ayrıştırmak gerekirdi; bu iş için fazla.
 * Değerler DejaVu Sans'ın advance width tablosundan yuvarlanarak alındı ve
 * `GUVENLIK_PAYI` ile yukarı çekildi — amaç kesin genişlik değil, TAŞMAMAK.
 */
const DAR_KARAKTERLER = new Set("ijltfrıI.,;:'\"!|()[]{}-–—/\\");
const GENIS_KARAKTERLER = new Set("mwMWĞÜÖÇŞ@%&");
const GUVENLIK_PAYI = 1.03;

function karakterGenisligi(ch: string): number {
	if (ch === " ") return 0.32;
	if (DAR_KARAKTERLER.has(ch)) return 0.34;
	if (GENIS_KARAKTERLER.has(ch)) return 0.95;
	if (ch >= "0" && ch <= "9") return 0.64;
	// Büyük harf tespiti Türkçe'ye duyarlı olmalı: varsayılan yerel ayarda
	// "I" ile "ı" karıştığı için `toLocaleUpperCase("tr")` ile karşılaştırılır.
	if (ch === ch.toLocaleUpperCase("tr") && ch !== ch.toLocaleLowerCase("tr")) {
		return 0.7;
	}

	return 0.6;
}

/** Metnin verilen punto ve kalınlıktaki yaklaşık genişliği (px). */
export function metinGenisligi(
	metin: string,
	boyut: number,
	kalin = false,
): number {
	let em = 0;

	for (const ch of metin) em += karakterGenisligi(ch);

	return em * boyut * (kalin ? 1.06 : 1) * GUVENLIK_PAYI;
}

/**
 * Metni verilen genişliğe göre satırlara böler.
 *
 * Tek başına sığmayan sözcük (uzun mevzuat adı, birleşik terim) sert
 * bölünür: alternatif, sözcüğün tuvalden taşıp görünmez olmasıydı.
 */
export function satirlaraBol(
	metin: string,
	genislik: number,
	boyut: number,
	kalin = false,
): string[] {
	const satirlar: string[] = [];

	for (const paragraf of metin.split("\n")) {
		let aktif = "";

		for (const kelime of paragraf.split(/\s+/).filter(Boolean)) {
			const aday = aktif ? `${aktif} ${kelime}` : kelime;

			if (metinGenisligi(aday, boyut, kalin) <= genislik) {
				aktif = aday;
				continue;
			}

			if (aktif) satirlar.push(aktif);

			if (metinGenisligi(kelime, boyut, kalin) <= genislik) {
				aktif = kelime;
				continue;
			}

			// Sert bölme: sığan en uzun önekten kes, kalanı sıradaki satıra bırak.
			let kalan = kelime;

			while (metinGenisligi(kalan, boyut, kalin) > genislik) {
				let kes = kalan.length;

				while (
					kes > 1 &&
					metinGenisligi(kalan.slice(0, kes), boyut, kalin) > genislik
				) {
					kes -= 1;
				}

				satirlar.push(kalan.slice(0, kes));
				kalan = kalan.slice(kes);
			}

			aktif = kalan;
		}

		if (aktif) satirlar.push(aktif);
	}

	return satirlar;
}

type Kutu = { satirlar: string[]; boyut: number; yukseklik: number };

/**
 * Metni verilen yüksekliğe sığdırmak için puntoyu kademe kademe düşürür.
 *
 * En küçük puntoda da sığmazsa satır sayısı kırpılır ve son satıra üç nokta
 * konur. Kırpma bilinçli olarak SON çaredir: kartın okunabilirliği metnin
 * tamamından önce gelir, ama sessizce yarısını yutmak da olmaz — üç nokta
 * devamının uygulamada olduğunu söyler.
 */
export function kutuyaSigdir(
	metin: string,
	genislik: number,
	maksYukseklik: number,
	boyutlar: number[],
	kalin = false,
): Kutu {
	let son: Kutu | null = null;

	for (const boyut of boyutlar) {
		const satirlar = satirlaraBol(metin, genislik, boyut, kalin);
		const yukseklik = satirlar.length * boyut * SATIR_ARALIGI;

		son = { satirlar, boyut, yukseklik };

		if (yukseklik <= maksYukseklik) return son;
	}

	const kutu = son as Kutu;
	const sigan = Math.max(
		1,
		Math.floor(maksYukseklik / (kutu.boyut * SATIR_ARALIGI)),
	);
	const satirlar = kutu.satirlar.slice(0, sigan);

	satirlar[satirlar.length - 1] = `${satirlar[satirlar.length - 1]}…`;

	return {
		satirlar,
		boyut: kutu.boyut,
		yukseklik: satirlar.length * kutu.boyut * SATIR_ARALIGI,
	};
}

/** Kutuyu verilen satır sayısına indirir; kırpıldıysa üç nokta ekler. */
function satirlariKirp(kutu: Kutu, maksSatir: number): Kutu {
	if (kutu.satirlar.length <= maksSatir) return kutu;

	const satirlar = kutu.satirlar.slice(0, maksSatir);

	satirlar[satirlar.length - 1] = `${satirlar[satirlar.length - 1]}…`;

	return {
		satirlar,
		boyut: kutu.boyut,
		yukseklik: satirlar.length * kutu.boyut * SATIR_ARALIGI,
	};
}

/**
 * Birden çok metni **tek ve ortak** puntoyla verilen toplam yüksekliğe
 * sığdırır.
 *
 * Her şıkkı ayrı ayrı sığdırmak, uzunluğu farklı şıkların farklı puntolarla
 * çizilmesine yol açıyordu: kısa olan büyük, uzun olan küçük görünüyor ve
 * kart "bozuk" duruyordu. Şıklar bir küme; ölçüleri de küme olarak seçilir.
 */
export function kutulariSigdir(
	metinler: string[],
	genislik: number,
	maksToplam: number,
	boyutlar: number[],
	aralik: number,
	maksSatir: number,
): { kutular: Kutu[]; boyut: number } {
	const bosluk = Math.max(0, metinler.length - 1) * aralik;
	let son: { kutular: Kutu[]; boyut: number } | null = null;

	for (const boyut of boyutlar) {
		const kutular = metinler.map((metin) => {
			const satirlar = satirlaraBol(metin, genislik, boyut);

			return satirlariKirp(
				{
					satirlar,
					boyut,
					yukseklik: satirlar.length * boyut * SATIR_ARALIGI,
				},
				maksSatir,
			);
		});
		const toplam =
			kutular.reduce((t, kutu) => t + kutu.yukseklik, 0) + bosluk;

		son = { kutular, boyut };

		if (toplam <= maksToplam) return son;
	}

	// En küçük puntoda da sığmadı: satır tavanını daralt.
	const { kutular, boyut } = son as { kutular: Kutu[]; boyut: number };
	const satirBasina = boyut * SATIR_ARALIGI;
	const izin = Math.max(
		1,
		Math.floor((maksToplam - bosluk) / (metinler.length * satirBasina)),
	);

	return {
		kutular: kutular.map((kutu) => satirlariKirp(kutu, izin)),
		boyut,
	};
}

/** XML'de anlamı olan karakterler; kaçırılan bir `&` SVG'yi tümden bozar. */
export function xmlKacir(metin: string): string {
	return metin
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

type YaziSecenek = {
	x: number;
	y: number;
	boyut: number;
	renk?: string;
	kalin?: boolean;
	opaklik?: number;
	harfAraligi?: number;
};

function yazi(metin: string, o: YaziSecenek): string {
	const nitelikler = [
		`x="${o.x}"`,
		`y="${o.y}"`,
		`font-family="${FONT_STACK}"`,
		`font-size="${o.boyut}"`,
		`fill="${o.renk ?? "#ffffff"}"`,
		o.kalin ? 'font-weight="bold"' : "",
		o.opaklik !== undefined ? `opacity="${o.opaklik}"` : "",
		o.harfAraligi ? `letter-spacing="${o.harfAraligi}"` : "",
	].filter(Boolean);

	return `<text ${nitelikler.join(" ")}>${xmlKacir(metin)}</text>`;
}

function satirlariYaz(
	satirlar: string[],
	x: number,
	ustY: number,
	boyut: number,
	secenek: Omit<YaziSecenek, "x" | "y" | "boyut"> = {},
): string {
	return satirlar
		.map((satir, index) =>
			yazi(satir, {
				...secenek,
				x,
				// SVG'de y taban çizgisidir; ilk satırın tepesi ustY olsun diye
				// yaklaşık bir üst-boşluk (0.82 em) eklenir.
				y: ustY + boyut * 0.82 + index * boyut * SATIR_ARALIGI,
				boyut,
			}),
		)
		.join("\n  ");
}

/**
 * Kart SVG'si.
 *
 * Zemin gradyanı `--brand-gradient` ile aynı üç duraktan oluşur; kart
 * uygulamanın kahraman yüzeyleriyle aynı yüzü göstersin diye. Yüksek
 * kontrast ve baskı varyantları YOK — kart bir ekran öğesi değil, dışa
 * gönderilen bir görsel.
 */
export function kartSvg(icerik: KartIcerigi): string {
	const parcalar: string[] = [];

	// --- Rozet ---
	const rozetBoyut = 26;
	const rozetGenislik = metinGenisligi(icerik.rozet, rozetBoyut, true) + 56;

	parcalar.push(
		`<path d="${roundedRect(PAD, 84, rozetGenislik, 56, 28)}" fill="#ffffff" opacity="0.16"/>`,
		yazi(icerik.rozet, {
			x: PAD + 28,
			y: 122,
			boyut: rozetBoyut,
			kalin: true,
			harfAraligi: 1.5,
		}),
		yazi(icerik.ustBilgi, {
			x: PAD,
			y: 190,
			boyut: 30,
			opaklik: 0.72,
		}),
	);

	// --- Gövde ---
	let y = GOVDE_UST;
	let kalanYukseklik =
		(icerik.dayanak ? GOVDE_ALT_DAYANAKLI : GOVDE_ALT_SADE) - GOVDE_UST;

	if (icerik.vurgu) {
		// Cevap kartında doğru şık en üstte ve en görünür yerde durur.
		const vurguKutu = kutuyaSigdir(
			icerik.vurgu,
			ICERIK_GENISLIGI - 96,
			200,
			[46, 42, 38, 34],
			true,
		);
		const kutuYukseklik = vurguKutu.yukseklik + 64;

		parcalar.push(
			`<path d="${roundedRect(PAD, y, ICERIK_GENISLIGI, kutuYukseklik, 28)}" fill="${CORRECT}"/>`,
			satirlariYaz(
				vurguKutu.satirlar,
				PAD + 48,
				y + 32,
				vurguKutu.boyut,
				{ kalin: true },
			),
		);

		y += kutuYukseklik + 44;
		kalanYukseklik -= kutuYukseklik + 44;
	}

	const satirlar = icerik.satirlar ?? [];

	// Şıklar önce ölçülür: sayıları sabit olduğu için sıkıştırılabilirlikleri
	// düşük. Artan pay başlığa verilir.
	const SIK_ARALIGI = 22;
	let sikKutulari: Kutu[] = [];
	let sikToplam = 0;

	if (satirlar.length > 0) {
		const { kutular } = kutulariSigdir(
			satirlar,
			ICERIK_GENISLIGI - 76,
			kalanYukseklik * 0.62,
			[34, 32, 30, 28, 26, 24],
			SIK_ARALIGI,
			2,
		);

		sikKutulari = kutular;
		sikToplam =
			kutular.reduce((t, kutu) => t + kutu.yukseklik, 0) +
			kutular.length * SIK_ARALIGI;
	}

	// Cevap kartında gövde bir AÇIKLAMADIR, başlık değil: vurgu kutusu zaten
	// kalın ve yeşil. İkisi birden kalın olduğunda kartta hiyerarşi kalmıyor
	// ve uzun açıklama bloğu okunmuyordu.
	const govdeKalin = !icerik.vurgu;
	const baslikKutu = kutuyaSigdir(
		icerik.baslik,
		ICERIK_GENISLIGI,
		kalanYukseklik - sikToplam - (satirlar.length > 0 ? 36 : 0),
		govdeKalin ? [54, 50, 46, 42, 38, 34, 30] : [40, 36, 34, 32, 30, 28],
		govdeKalin,
	);

	parcalar.push(
		satirlariYaz(baslikKutu.satirlar, PAD, y, baslikKutu.boyut, {
			kalin: govdeKalin,
			opaklik: govdeKalin ? undefined : 0.94,
		}),
	);
	y += baslikKutu.yukseklik + 36;

	sikKutulari.forEach((kutu, index) => {
		const harf = String.fromCharCode(65 + index);
		const merkez = y + kutu.boyut * 0.6;

		parcalar.push(
			`<circle cx="${PAD + 22}" cy="${merkez}" r="22" fill="#ffffff" opacity="0.14"/>`,
			yazi(harf, {
				x: PAD + 22 - metinGenisligi(harf, 24, true) / 2,
				y: merkez + 8,
				boyut: 24,
				kalin: true,
				opaklik: 0.9,
			}),
			satirlariYaz(kutu.satirlar, PAD + 76, y, kutu.boyut, {
				opaklik: 0.95,
			}),
		);

		y += kutu.yukseklik + SIK_ARALIGI;
	});

	// --- Künye şeridi ---
	if (icerik.dayanak) {
		// ⚠️ Emoji YOK. Kart librsvg ile çizilir ve DejaVu Sans'ta emoji glif'i
		// yoktur; renkli emoji fontu da üretim makinesinde garanti değil.
		// Bulunamayan glif sessizce boş kutu olarak çizilir. Metindeki (caption)
		// emojiler sorunsuzdur — onları platform kendisi render eder.
		const dayanak = kutuyaSigdir(
			`Dayanak · ${icerik.dayanak}`,
			ICERIK_GENISLIGI,
			DAYANAK_YUKSEKLIGI,
			[26, 24, 22],
		);

		parcalar.push(
			satirlariYaz(dayanak.satirlar, PAD, DAYANAK_Y, dayanak.boyut, {
				opaklik: 0.72,
			}),
		);
	}

	parcalar.push(
		`<path d="M${PAD} ${KUNYE_Y} H${KART_BOYUT - PAD}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>`,
		`<g transform="translate(${PAD} ${KUNYE_Y + 24}) scale(${52 / CANVAS})">
    <path d="${COLUMN_PATH}" fill="#ffffff"/>
  </g>`,
		yazi(MARKA_ADI, {
			x: PAD + 68,
			y: KUNYE_Y + 62,
			boyut: 30,
			kalin: true,
			opaklik: 0.9,
		}),
	);

	return `<svg width="${KART_BOYUT}" height="${KART_BOYUT}" viewBox="0 0 ${KART_BOYUT} ${KART_BOYUT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="zemin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_LIGHT}"/>
      <stop offset="55%" stop-color="${BRAND}"/>
      <stop offset="100%" stop-color="${BRAND_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="${KART_BOYUT}" height="${KART_BOYUT}" fill="url(#zemin)"/>
  <circle cx="${KART_BOYUT - 60}" cy="-40" r="260" fill="${ACCENT}" opacity="0.10"/>
  <circle cx="-80" cy="${KART_BOYUT + 60}" r="300" fill="#ffffff" opacity="0.05"/>
  ${parcalar.join("\n  ")}
</svg>`;
}

/**
 * Yazı tipinin gerçekten çizilip çizilmediğini yoklar.
 *
 * librsvg font bulamazsa metni **sessizce atlar**: kart üretilir, hata
 * alınmaz, sadece yazı yoktur. Bu hata ancak paylaşım yayına çıktıktan sonra
 * görülürdü. Yoklama, beyaz zemine tek harf çizip koyu piksel arar.
 */
async function yaziCiziliyorMu(): Promise<boolean> {
	const deneme = `<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" fill="#ffffff"/>
  <text x="2" y="38" font-family="${FONT_STACK}" font-size="40" fill="#000000">W</text>
</svg>`;
	const { data } = await sharp(Buffer.from(deneme))
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return data.some((deger) => deger < 128);
}

/** Kartı üretir ve diske yazar; dosya boyutunu döndürür. */
export async function kartUret(
	icerik: KartIcerigi,
	dosyaYolu: string,
): Promise<number> {
	if (!(await yaziCiziliyorMu())) {
		throw new Error(
			"Yazı tipi bulunamadı: kart metinsiz çıkardı. " +
				"Üretim makinesine DejaVu Sans kurulmalı (Ubuntu: fonts-dejavu-core).",
		);
	}

	const jpeg = await sharp(Buffer.from(kartSvg(icerik)))
		.flatten({ background: BRAND })
		.jpeg({ quality: JPEG_KALITE, mozjpeg: true })
		.toBuffer();

	await writeFile(dosyaYolu, jpeg);

	return jpeg.length;
}
