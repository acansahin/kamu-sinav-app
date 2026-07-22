/**
 * Uygulama ikonlarını koddan üretir.
 *
 * İkonlar depoya ikili dosya olarak elle konmaz: kaynak buradaki SVG'dir,
 * PNG'ler ondan türetilir. Marka rengi değişirse tek yerden yeniden üretilir.
 *
 * Çalıştırma: npm run icons:build
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "icons");

/** globals.css içindeki --brand ile aynı olmalı. */
const BRAND = "#17395e";

/**
 * @param safeRatio İçeriğin kapladığı alan oranı. Maskable ikonlarda
 *   platformlar kenarları kırpar; içerik iç %80'de kalmalıdır.
 */
function markSvg(safeRatio: number): string {
	const size = 512;
	const scale = safeRatio;
	const offset = (size * (1 - scale)) / 2;

	return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${maskableRadius(safeRatio)}" fill="${BRAND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M150 268 L222 340 L366 176"
          stroke="#ffffff" stroke-width="44"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

/** Maskable ikonda köşe yuvarlaması platforma bırakılır; zemin tam dolu olur. */
function maskableRadius(safeRatio: number): number {
	return safeRatio < 1 ? 0 : 112;
}

const OUTPUTS = [
	{ file: "icon-192.png", size: 192, safe: 1 },
	{ file: "icon-512.png", size: 512, safe: 1 },
	{ file: "icon-maskable-512.png", size: 512, safe: 0.72 },
	{ file: "apple-touch-icon.png", size: 180, safe: 1 },
];

async function main(): Promise<void> {
	await mkdir(OUT_DIR, { recursive: true });

	for (const { file, size, safe } of OUTPUTS) {
		const buffer = await sharp(Buffer.from(markSvg(safe)))
			.resize(size, size)
			.png({ compressionLevel: 9 })
			.toBuffer();

		await writeFile(path.join(OUT_DIR, file), buffer);
		console.log(
			`  ${file.padEnd(26)} ${size}×${size}  ${String(Math.round(buffer.length / 1024)).padStart(3)} KB`,
		);
	}

	// Favicon: Next `src/app/icon.svg` dosyasını otomatik olarak kullanır.
	await writeFile(path.join(ROOT, "src", "app", "icon.svg"), markSvg(1), "utf8");
	console.log(`  src/app/icon.svg           (favicon)`);
}

console.log("\n✔ İkonlar üretiliyor:\n");
main()
	.then(() => console.log(""))
	.catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
