/**
 * Uygulama ikonlarını koddan üretir.
 *
 * İkonlar depoya ikili dosya olarak elle konmaz: kaynak buradaki SVG'dir,
 * PNG'ler ondan türetilir. Marka rengi değişirse tek yerden yeniden üretilir.
 * Bu, web ikonları kadar Android launcher ikonları için de geçerlidir —
 * `android/**` git'te tutulduğu için çıktılar commit'lenir.
 *
 * Çalıştırma: npm run icons:build
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");
const ANDROID_RES = path.join(ROOT, "android", "app", "src", "main", "res");
/** Google Play'e yüklenecek görseller; ekran görüntüleri de buraya konur. */
const STORE_DIR = path.join(ROOT, "store", "assets");

/** globals.css içindeki --brand ile aynı olmalı. */
const BRAND = "#17395e";

/** Tüm ikonların ortak tuval boyu; her çıktı bundan küçültülür. */
const CANVAS = 512;

/**
 * Ortak tik işareti. Verilen oranda, tuvalin merkezine göre ölçeklenir.
 * Tek geometri: web, launcher ve splash aynı işareti kullanır.
 */
function mark(scale: number): string {
	const offset = (CANVAS * (1 - scale)) / 2;

	return `  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M150 268 L222 340 L366 176"
          stroke="#ffffff" stroke-width="44"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>`;
}

/**
 * @param safeRatio İçeriğin kapladığı alan oranı. Maskable ikonlarda
 *   platformlar kenarları kırpar; içerik iç %80'de kalmalıdır.
 */
function markSvg(safeRatio: number): string {
	return `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${CANVAS}" height="${CANVAS}" rx="${maskableRadius(safeRatio)}" fill="${BRAND}"/>
${mark(safeRatio)}
</svg>`;
}

/** Maskable ikonda köşe yuvarlaması platforma bırakılır; zemin tam dolu olur. */
function maskableRadius(safeRatio: number): number {
	return safeRatio < 1 ? 0 : 112;
}

/**
 * Android'in `roundIcon` çıktısı. Köşe yuvarlaması yerine tam daire zemin:
 * kare ikonu daireye kırpmak tik işaretinin uçlarını yiyor.
 */
function roundSvg(): string {
	const radius = CANVAS / 2;

	return `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${radius}" cy="${radius}" r="${radius}" fill="${BRAND}"/>
${mark(1)}
</svg>`;
}

/**
 * Adaptive icon ön planı — zemin şeffaftır, onu `@color/ic_launcher_background`
 * verir. Android 108dp'lik tuvalin yalnızca iç 72dp'sini gösterir ve içeriğin
 * iç 66dp'de (%61) kalmasını ister; işaret bu yüzden küçültülür.
 */
const FOREGROUND_SAFE = 0.9;

function foregroundSvg(): string {
	return `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
${mark(FOREGROUND_SAFE)}
</svg>`;
}

const OUTPUTS = [
	{ file: "icon-192.png", size: 192, safe: 1 },
	{ file: "icon-512.png", size: 512, safe: 1 },
	{ file: "icon-maskable-512.png", size: 512, safe: 0.72 },
	{ file: "apple-touch-icon.png", size: 180, safe: 1 },
];

/**
 * Google Play mağaza kartının üstünde duran görsel. Ölçü Play tarafından
 * sabitlenmiştir: 1024×500, JPEG veya 24-bit PNG, saydamlık yok.
 *
 * İkonlarla aynı geometri ve aynı marka renginden üretilir — mağaza kartı ile
 * launcher ikonu arasındaki sürekliliği elle hizalamak yerine tek kaynaktan
 * almak içindir.
 */
const FEATURE_W = 1024;
const FEATURE_H = 500;

function featureGraphicSvg(): string {
	/*
	 * Yazı tipi adı değil, yığın verilir: görsel üretim makinesinde hangi
	 * fontun bulunduğu garanti değildir ve librsvg ilk bulduğuna düşer.
	 */
	const fontStack =
		"DejaVu Sans, Liberation Sans, Segoe UI, Arial, Helvetica, sans-serif";
	const markSize = 190;
	const markX = 92;
	const markY = (FEATURE_H - markSize) / 2;

	return `<svg width="${FEATURE_W}" height="${FEATURE_H}" viewBox="0 0 ${FEATURE_W} ${FEATURE_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${FEATURE_W}" height="${FEATURE_H}" fill="${BRAND}"/>
  <circle cx="${FEATURE_W - 120}" cy="${FEATURE_H + 40}" r="300" fill="#ffffff" opacity="0.05"/>
  <circle cx="${FEATURE_W - 40}" cy="-60" r="200" fill="#ffffff" opacity="0.05"/>

  <g transform="translate(${markX} ${markY})">
    <rect width="${markSize}" height="${markSize}" rx="42" fill="#ffffff" opacity="0.12"/>
    <g transform="scale(${markSize / CANVAS})">
      <path d="M150 268 L222 340 L366 176"
            stroke="#ffffff" stroke-width="44"
            stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
  </g>

  <text x="${markX + markSize + 56}" y="216" font-family="${fontStack}"
        font-size="76" font-weight="bold" fill="#ffffff">Kamu Sınav</text>
  <text x="${markX + markSize + 56}" y="300" font-family="${fontStack}"
        font-size="76" font-weight="bold" fill="#ffffff" opacity="0.72">Akademi</text>
  <text x="${markX + markSize + 60}" y="360" font-family="${fontStack}"
        font-size="30" fill="#ffffff" opacity="0.75">Görevde Yükselme ve Unvan Değişikliği</text>
</svg>`;
}

/**
 * Android yoğunluk kademeleri. Ölçüler dp cinsindendir: launcher ikonu 48dp,
 * adaptive icon ön planı 108dp. Piksel boyu bu çarpanla bulunur.
 */
const DENSITIES = [
	{ dir: "mdpi", factor: 1 },
	{ dir: "hdpi", factor: 1.5 },
	{ dir: "xhdpi", factor: 2 },
	{ dir: "xxhdpi", factor: 3 },
	{ dir: "xxxhdpi", factor: 4 },
];

const LAUNCHER_DP = 48;
const FOREGROUND_DP = 108;

async function writePng(
	svg: string,
	size: number,
	file: string,
): Promise<number> {
	const buffer = await sharp(Buffer.from(svg))
		.resize(size, size)
		.png({ compressionLevel: 9 })
		.toBuffer();

	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, buffer);
	return buffer.length;
}

function kb(bytes: number): string {
	return `${String(Math.round(bytes / 1024)).padStart(3)} KB`;
}

async function main(): Promise<void> {
	console.log("  Web:");
	await mkdir(OUT_DIR, { recursive: true });

	for (const { file, size, safe } of OUTPUTS) {
		const bytes = await writePng(markSvg(safe), size, path.join(OUT_DIR, file));
		console.log(`    ${file.padEnd(24)} ${size}×${size}  ${kb(bytes)}`);
	}

	// Favicon: Next `src/app/icon.svg` dosyasını otomatik olarak kullanır.
	await writeFile(path.join(ROOT, "src", "app", "icon.svg"), markSvg(1), "utf8");
	console.log(`    src/app/icon.svg         (favicon)`);

	console.log("\n  Android launcher:");
	const square = markSvg(1);
	const round = roundSvg();
	const foreground = foregroundSvg();

	for (const { dir, factor } of DENSITIES) {
		const mipmap = path.join(ANDROID_RES, `mipmap-${dir}`);
		const launcher = Math.round(LAUNCHER_DP * factor);
		const adaptive = Math.round(FOREGROUND_DP * factor);

		const bytes =
			(await writePng(square, launcher, path.join(mipmap, "ic_launcher.png"))) +
			(await writePng(
				round,
				launcher,
				path.join(mipmap, "ic_launcher_round.png"),
			)) +
			(await writePng(
				foreground,
				adaptive,
				path.join(mipmap, "ic_launcher_foreground.png"),
			));

		console.log(
			`    mipmap-${dir.padEnd(17)} ${launcher}×${launcher} + ${adaptive}×${adaptive}  ${kb(bytes)}`,
		);
	}

	console.log("\n  Google Play:");
	await mkdir(STORE_DIR, { recursive: true });

	// Mağaza kartı ikonu 512×512 ve saydamlıksız olmak zorundadır.
	const storeIcon = await sharp(Buffer.from(markSvg(1)))
		.resize(512, 512)
		.flatten({ background: BRAND })
		.png({ compressionLevel: 9 })
		.toBuffer();
	await writeFile(path.join(STORE_DIR, "icon-512.png"), storeIcon);
	console.log(`    icon-512.png             512×512  ${kb(storeIcon.length)}`);

	const feature = await sharp(Buffer.from(featureGraphicSvg()))
		.flatten({ background: BRAND })
		.png({ compressionLevel: 9 })
		.toBuffer();
	await writeFile(path.join(STORE_DIR, "feature-graphic.png"), feature);
	console.log(
		`    feature-graphic.png      ${FEATURE_W}×${FEATURE_H}  ${kb(feature.length)}`,
	);
}

console.log("\n✔ İkonlar üretiliyor:\n");
main()
	.then(() => console.log(""))
	.catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
