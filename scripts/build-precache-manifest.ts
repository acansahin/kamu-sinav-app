/**
 * Çevrimdışı tam indirme listesini üretir ve service worker'ı damgalar.
 *
 * `next build` bittikten sonra `out/` taranır ve service worker'ın isteğe
 * bağlı "tümünü indir" özelliğinde kullanacağı URL listesi yazılır.
 *
 * Liste kabuk dosyalarını da içerir; kullanıcı indirmeyi seçtiğinde her şeyin
 * önbellekte olması beklenir.
 *
 * Ayrıca `out/sw.js` içindeki `VERSION` sabiti derlemenin parmak iziyle
 * değiştirilir. Bkz. `stampServiceWorker` — bu adım atlanırsa güncellemeler
 * kullanıcıya ULAŞMAZ.
 *
 * Çalıştırma: build sonrası otomatik (postbuild)
 */
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
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

/** Damgalanacak satır. Değişirse `stampServiceWorker` bilerek patlar. */
const VERSION_PATTERN = /const VERSION = "[^"]*";/;

/** Parmak izine girmeyecekler: ikisi de bu betiğin kendi çıktısı. */
const FINGERPRINT_SKIP = new Set(["sw.js", "precache-manifest.json"]);

/** `out/` altındaki tüm dosyalar — `walk`tan farklı olarak hiçbiri elenmez. */
async function walkAll(dir: string, base = ""): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			files.push(
				...(await walkAll(path.join(dir, entry.name), `${base}${entry.name}/`)),
			);
			continue;
		}
		if (FINGERPRINT_SKIP.has(entry.name)) continue;
		files.push(`${base}${entry.name}`);
	}
	return files;
}

/**
 * Derlemenin parmak izi: yayınlanan her dosyanın yolu VE içeriği.
 *
 * Yalnızca dosya ADLARINI özetlemek yetmez. JS parçaları içerik adreslidir,
 * yani kod değişince adları da değişir; ama RSC yükleri (`konular/index.txt`)
 * ve içerik JSON'ları sabit adlıdır — sadece içerik değiştiğinde bir tek
 * onların baytları değişir. Ada bakan bir parmak izi böyle bir derlemede aynı
 * kalır ve önbellek tazelenmezdi.
 */
async function fingerprint(): Promise<string> {
	const files = (await walkAll(OUT_DIR)).sort();
	const hash = createHash("sha256");

	for (const file of files) {
		hash.update(file);
		hash.update(await readFile(path.join(OUT_DIR, file)));
	}

	return hash.digest("hex").slice(0, 16);
}

/**
 * `out/sw.js` içindeki önbellek sürümünü derlemeye bağlar.
 *
 * ⚠️ Bu adım olmadan uygulama GÜNCELLENEMEZ ve hata yalnızca cihazda, yalnızca
 * güncelleyen kullanıcıda görünür. Zincir şudur: `sw.js` her derlemede bayt
 * bayt aynı kalırsa tarayıcı onu güncellenmiş saymaz → `activate` hiç çalışmaz
 * → eski önbellek silinmez → sabit adlı RSC yükleri (`konular/index.txt`) ESKİ
 * derlemeden servis edilir → o yükler artık pakette olmayan parça adlarına
 * referans verir → `<Link>` ile gezinme sessizce düşer. Cihazda görülen belirti
 * buydu: alt menüde "Konular" bazen açıyor, bazen açmıyordu (rotanın yükü
 * güncellemeden önce önbelleğe girmişse açmıyor).
 *
 * Elle artırılan bir sabit çözüm değildir: bu depoda unutulan elle artırma
 * zaten en sık hata kaynağı (bkz. `versionCode`).
 */
async function stampServiceWorker(version: string): Promise<void> {
	const swPath = path.join(OUT_DIR, "sw.js");
	const source = await readFile(swPath, "utf8");

	if (!VERSION_PATTERN.test(source)) {
		console.error(
			"sw.js içinde VERSION sabiti bulunamadı. Sabit yeniden adlandırıldıysa " +
				"VERSION_PATTERN da güncellenmeli — damgasız bir service worker " +
				"güncellemeleri kullanıcıya hiç ulaştırmaz.",
		);
		process.exit(1);
	}

	await writeFile(
		swPath,
		source.replace(VERSION_PATTERN, `const VERSION = "${version}";`),
		"utf8",
	);
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

	const version = await fingerprint();
	await stampServiceWorker(version);

	console.log(
		`\n✔ Çevrimdışı indirme listesi: ${urls.length} dosya ` +
			`(out/precache-manifest.json)\n` +
			`✔ Service worker önbellek sürümü: ${version}\n`,
	);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
