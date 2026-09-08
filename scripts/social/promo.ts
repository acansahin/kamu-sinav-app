import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

import { CANVAS, COLUMN_PATH, roundedRect } from "../brand-mark";
import { kutuyaSigdir, metinGenisligi, xmlKacir } from "./card";
import {
	ACCENT,
	BRAND,
	BRAND_DARK,
	BRAND_LIGHT,
	CIKTI_DIR,
	FONT_STACK,
	JPEG_KALITE,
	MARKA_ADI,
} from "./config";

/**
 * Tanıtım karuseli — Instagram ve Facebook için.
 *
 * Mağaza ekran görüntülerini (`store/assets/screenshots/`) marka zeminine
 * yerleştirip başlıklandırır. Ham ekran görüntüsünü doğrudan paylaşmak iki
 * sebeple kötü: (1) 9:16'lık görsel akışta kırpılır ya da yanına şerit konur,
 * (2) görüntü tek başına neyi göstermek istediğinizi söylemez — başlık söyler.
 *
 * Ölçü **1080×1350 (4:5)**: Instagram akışının izin verdiği en uzun dikey
 * biçim, yani parmağın altında en çok yer kaplayan biçim. Kare de kabul
 * edilir ama %25 daha az alan demektir. Facebook aynı görseli kırpmadan
 * gösterir.
 *
 * Telefon görseli alt kenardan **bilinçli olarak taşar**: tamamını sığdırmak
 * ya görseli okunmayacak kadar küçültüyor ya da başlığa yer bırakmıyordu.
 *
 * Çalıştırma: npm run social:tanitim
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SS_DIR = path.join(ROOT, "store", "assets", "screenshots");

const GEN = 1080;
const YUK = 1350;
const PAD = 76;
const ICERIK = GEN - PAD * 2;

/** Telefon görselinin genişliği ve üst kenarı. */
const TEL_GEN = 616;
const TEL_UST = 596;
/** Ekran görüntüsü 1080×1920; ölçek buradan gelir. */
const TEL_YUK = Math.round((TEL_GEN * 1920) / 1080);
const KOSE = 40;

type Slayt = {
	dosya: string;
	rozet?: string;
	baslik: string;
	alt?: string;
	/** `store/assets/screenshots/` içindeki dosya adı; yoksa metin slaydı. */
	gorsel?: string;
	/** Madde listesi — yalnızca metin slaytlarında; telefon varsa yer yok. */
	liste?: string[];
	/** Listenin altındaki tek vurgulu satır (adres vb.). */
	vurgu?: string;
	not?: string;
};

const SLAYTLAR: Slayt[] = [
	{
		dosya: "01-kapak.jpg",
		rozet: "GÖREVDE YÜKSELME · UNVAN DEĞİŞİKLİĞİ",
		baslik: "Doğru şıkkı değil, dayandığı maddeyi öğrenin.",
		alt: "Kamu Sınav Akademi — 6 ders, 33 konu, 1400'ün üzerinde soru.",
		liste: [
			"657 sayılı Devlet Memurları Kanunu",
			"Türkiye Cumhuriyeti Anayasası",
			"Etik Davranış İlkeleri",
			"Resmî Yazışmalarda Usul ve Esaslar",
			"Devlet Teşkilatı ile İlgili Mevzuat",
			"Güvenlik Soruşturması ve Arşiv Araştırması",
		],
	},
	{
		dosya: "02-dayanak.jpg",
		rozet: "NEYİ FARKLI YAPAR",
		baslik: "Her cevapta mevzuat dayanağı ve gerekçe.",
		alt: "Hangi kanunun hangi maddesi olduğu ekranda yazar. Ezber değil, hüküm.",
		gorsel: "03-test-cozme.png",
	},
	{
		dosya: "03-tarihli-ozet.jpg",
		rozet: "GÜVEN",
		baslik: "Her konu özeti tarihli.",
		alt: "Hangi mevzuat sürümüne dayandığı ve en son ne zaman doğrulandığı yazar. Mevzuat sık değişir.",
		gorsel: "02-konu-ozeti.png",
	},
	{
		dosya: "04-deneme.jpg",
		rozet: "HAZIRLIK",
		baslik: "Gerçek sınav formatında süreli denemeler.",
		alt: "Ders dağılımı, süre ve başarı eşiği sınavdaki gibi. Yanlış doğruyu götürmez.",
		gorsel: "04-deneme-sinavi.png",
	},
	{
		dosya: "05-ilkeler.jpg",
		rozet: "TASARIM TERCİHLERİ",
		baslik: "Reklam yok. Hesap yok. İnternet gerekmez.",
		alt: "Çalışma verileriniz yalnızca cihazınızda kalır; hiçbir sunucuya gönderilmez.",
		gorsel: "01-ana-sayfa.png",
	},
	{
		dosya: "06-cagri.jpg",
		rozet: "ÜCRETSİZ DENEYİN",
		baslik: "Her dersin ilk konusu ve ilk testi açık.",
		alt: "Tam erişim tek seferlik satın almayla — abonelik değil, yenilenmez.",
		liste: ["Google Play'de arayın:"],
		vurgu: "Kamu Sınav Akademi",
		not: "Bu uygulama resmî değildir; hiçbir kurum veya sınav merkeziyle bağlantılı değildir.",
	},
];

type YaziSecenek = {
	x: number;
	y: number;
	boyut: number;
	kalin?: boolean;
	opaklik?: number;
	harfAraligi?: number;
};

function yazi(metin: string, o: YaziSecenek): string {
	return [
		`<text x="${o.x}" y="${o.y}" font-family="${FONT_STACK}"`,
		`font-size="${o.boyut}" fill="#ffffff"`,
		o.kalin ? 'font-weight="bold"' : "",
		o.opaklik !== undefined ? `opacity="${o.opaklik}"` : "",
		o.harfAraligi ? `letter-spacing="${o.harfAraligi}"` : "",
		`>${xmlKacir(metin)}</text>`,
	]
		.filter(Boolean)
		.join(" ");
}

function satirlariYaz(
	satirlar: string[],
	x: number,
	ustY: number,
	boyut: number,
	secenek: Omit<YaziSecenek, "x" | "y" | "boyut"> = {},
): string {
	return satirlar
		.map((satir, i) =>
			yazi(satir, {
				...secenek,
				x,
				y: ustY + boyut * 0.82 + i * boyut * 1.34,
				boyut,
			}),
		)
		.join("\n  ");
}

function zeminSvg(slayt: Slayt): string {
	const p: string[] = [];
	const metinSlaydi = !slayt.gorsel;

	let y = 96;

	if (slayt.rozet) {
		const rb = 24;
		const genislik = metinGenisligi(slayt.rozet, rb, true) + 52;

		p.push(
			`<path d="${roundedRect(PAD, y, genislik, 52, 26)}" fill="#ffffff" opacity="0.16"/>`,
			yazi(slayt.rozet, {
				x: PAD + 26,
				y: y + 34,
				boyut: rb,
				kalin: true,
				harfAraligi: 1.4,
			}),
		);
		y += 92;
	}

	// Metin slaydında telefon yok: başlık hem daha büyük hem daha uzun olabilir.
	const baslikAlani = metinSlaydi ? 520 : TEL_UST - y - 200;
	const baslik = kutuyaSigdir(
		slayt.baslik,
		ICERIK,
		baslikAlani,
		metinSlaydi ? [86, 78, 70, 62, 54] : [64, 58, 52, 46, 40],
		true,
	);

	p.push(satirlariYaz(baslik.satirlar, PAD, y, baslik.boyut, { kalin: true }));
	y += baslik.yukseklik + (metinSlaydi ? 48 : 30);

	if (slayt.alt) {
		const alt = kutuyaSigdir(
			slayt.alt,
			ICERIK,
			metinSlaydi ? 260 : TEL_UST - y - 36,
			metinSlaydi ? [40, 36, 32, 30] : [32, 30, 28, 26],
		);

		p.push(satirlariYaz(alt.satirlar, PAD, y, alt.boyut, { opaklik: 0.82 }));
		y += alt.yukseklik + 52;
	}

	/*
	 * Madde listesi yalnızca metin slaytlarında. İki işi birden görür: kapağın
	 * alt yarısındaki boşluğu doldurur ve ders adlarını AÇIKÇA yazar — hem
	 * arama hem üretken motorlar için çıkarılabilir olan budur, "kapsamlı
	 * içerik" gibi sıfatlar değil.
	 */
	if (slayt.liste?.length) {
		const boyut = 34;

		// Tek maddede madde imi konmaz: işaret bir listeyi ima eder, liste yok.
		const imli = slayt.liste.length > 1;

		slayt.liste.forEach((madde, i) => {
			const satirY = y + i * 54;

			if (imli) {
				p.push(
					`<circle cx="${PAD + 8}" cy="${satirY + boyut * 0.5}" r="6" fill="#ffffff" opacity="0.5"/>`,
				);
			}

			p.push(
				yazi(madde, {
					x: imli ? PAD + 34 : PAD,
					y: satirY + boyut * 0.82,
					boyut,
					opaklik: 0.9,
				}),
			);
		});

		y += slayt.liste.length * 54 + 26;
	}

	if (slayt.vurgu) {
		const vurgu = kutuyaSigdir(slayt.vurgu, ICERIK, 130, [46, 42, 38, 34], true);

		p.push(satirlariYaz(vurgu.satirlar, PAD, y, vurgu.boyut, { kalin: true }));
	}

	// Telefon görselinin arkasındaki hafif çerçeve; görsel sonra composite edilir.
	if (slayt.gorsel) {
		const x = (GEN - TEL_GEN) / 2;

		p.push(
			`<path d="${roundedRect(x - 10, TEL_UST - 10, TEL_GEN + 20, TEL_YUK + 20, KOSE + 10)}" fill="#ffffff" opacity="0.20"/>`,
		);
	}

	/*
	 * Künye telefonlu slaytta sağ ÜSTTE durur (görsel alttan taştığı için alt
	 * şerit yok), metin slaydında sol ALTTA. Metin slaydında üstte tutmak,
	 * uzun rozetle çakışmasına yol açıyordu — genişlik ölçümü yaklaşık olduğu
	 * için çakışma ancak üretilen görselde görülüyor.
	 */
	const markaGen = metinGenisligi(MARKA_ADI, 26, true);
	const kunyeX = metinSlaydi ? PAD + 58 : GEN - PAD - markaGen;
	const kunyeY = metinSlaydi
		? YUK - PAD - (slayt.not ? 108 : 0) - 30
		: 122;

	p.push(
		`<g transform="translate(${kunyeX - 58} ${kunyeY - 30}) scale(${42 / CANVAS})">
    <path d="${COLUMN_PATH}" fill="#ffffff"/>
  </g>`,
		yazi(MARKA_ADI, {
			x: kunyeX,
			y: kunyeY,
			boyut: 26,
			kalin: true,
			opaklik: 0.85,
		}),
	);

	if (slayt.not) {
		const not = kutuyaSigdir(slayt.not, ICERIK, 120, [24, 22, 20]);

		p.push(
			satirlariYaz(not.satirlar, PAD, YUK - PAD - not.yukseklik, not.boyut, {
				opaklik: 0.62,
			}),
		);
	}

	return `<svg width="${GEN}" height="${YUK}" viewBox="0 0 ${GEN} ${YUK}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="zemin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_LIGHT}"/>
      <stop offset="55%" stop-color="${BRAND}"/>
      <stop offset="100%" stop-color="${BRAND_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="${GEN}" height="${YUK}" fill="url(#zemin)"/>
  <circle cx="${GEN - 40}" cy="-60" r="300" fill="${ACCENT}" opacity="0.12"/>
  <circle cx="-100" cy="${YUK + 40}" r="320" fill="#ffffff" opacity="0.05"/>
  ${p.join("\n  ")}
</svg>`;
}

/** Ekran görüntüsünü ölçekler ve köşelerini yuvarlar. */
async function telefonGorseli(dosya: string): Promise<Buffer> {
	const ham = await readFile(path.join(SS_DIR, dosya));
	const maske = Buffer.from(
		`<svg width="${TEL_GEN}" height="${TEL_YUK}" xmlns="http://www.w3.org/2000/svg">
  <path d="${roundedRect(0, 0, TEL_GEN, TEL_YUK, KOSE)}" fill="#ffffff"/>
</svg>`,
	);

	return sharp(ham)
		.resize(TEL_GEN, TEL_YUK, { fit: "fill" })
		.composite([{ input: maske, blend: "dest-in" }])
		.png()
		.toBuffer();
}

async function main(): Promise<void> {
	const cikti = path.join(ROOT, CIKTI_DIR, "tanitim");

	await mkdir(cikti, { recursive: true });

	console.log("\n  Tanıtım karuseli üretiliyor (1080×1350):\n");

	for (const slayt of SLAYTLAR) {
		const zemin = sharp(Buffer.from(zeminSvg(slayt)));
		const birlesik = slayt.gorsel
			? sharp(await zemin.png().toBuffer()).composite([
					{
						input: await telefonGorseli(slayt.gorsel),
						top: TEL_UST,
						left: Math.round((GEN - TEL_GEN) / 2),
					},
				])
			: zemin;

		const jpeg = await birlesik
			.flatten({ background: BRAND })
			.jpeg({ quality: JPEG_KALITE, mozjpeg: true })
			.toBuffer();

		await writeFile(path.join(cikti, slayt.dosya), jpeg);
		console.log(
			`    ${slayt.dosya.padEnd(22)}${String(Math.round(jpeg.length / 1024)).padStart(5)} KB   ${slayt.baslik}`,
		);
	}

	console.log(`\n  Çıktı: ${path.relative(ROOT, cikti)}\n`);
}

main().catch((hata: unknown) => {
	console.error(hata);
	process.exit(1);
});
