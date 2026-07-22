/**
 * Çevrimdışı tam indirme listesini üretir.
 *
 * `next build` bittikten sonra `out/` taranır ve service worker'ın isteğe
 * bağlı "tümünü indir" özelliğinde kullanacağı URL listesi yazılır.
 *
 * Liste kabuk dosyalarını da içerir; kullanıcı indirmeyi seçtiğinde her şeyin
 * önbellekte olması beklenir.
 *
 * Çalıştırma: build sonrası otomatik (postbuild)
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "out");

/** Önbelleğe alınmayacaklar: kendisi ve türetilmiş meta dosyaları. */
const SKIP = new Set(["sw.js", "precache-manifest.json"]);

/**
 * İçerik JSON'ları tarayıcı tarafından hiç istenmez — sunucu bileşenleri
 * onları derleme zamanında okur ve veri sayfalara gömülür. Çevrimdışı için
 * indirmek boşuna trafik olur.
 */
const SKIP_DIRS = new Set(["content"]);

async function walk(dir: string, base = ""): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name) && base === "") continue;
			files.push(...(await walk(path.join(dir, entry.name), `${base}${entry.name}/`)));
			continue;
		}
		if (SKIP.has(entry.name)) continue;

		// index.html dosyaları klasör URL'si olarak istenir; ikisini de yazmak
		// aynı içeriği iki kez indirir.
		const url =
			entry.name === "index.html" ? base || "./" : `${base}${entry.name}`;
		files.push(url);
	}
	return files;
}

async function main(): Promise<void> {
	try {
		await stat(OUT_DIR);
	} catch {
		console.error("out/ bulunamadı — önce `next build` çalıştırın.");
		process.exit(1);
	}

	const urls = [...new Set(await walk(OUT_DIR))].sort();
	await writeFile(
		path.join(OUT_DIR, "precache-manifest.json"),
		JSON.stringify(urls),
		"utf8",
	);

	console.log(
		`\n✔ Çevrimdışı indirme listesi: ${urls.length} dosya ` +
			`(out/precache-manifest.json)\n`,
	);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
