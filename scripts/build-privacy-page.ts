import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { JSDOM } from "jsdom";

/**
 * Yayına yalnızca gizlilik politikasını bırakır.
 *
 * **Neden gerekiyor:** Uygulama Google Play'de satılıyor ve aynı içeriği
 * ücretsiz veren bir web sürümünü yayında tutmak satışın önüne geçiyor. Ama
 * site tümden kaldırılamaz: Play Console'a verilen ZORUNLU gizlilik politikası
 * adresi (`/gizlilik/`) buradan servis ediliyor ve 404 vermesi politika ihlali
 * doğurur — bkz. `store/yukleme-kilavuzu.md`.
 *
 * **Neden sayfayı olduğu gibi bırakmıyoruz:** Dışa aktarılan sayfa uygulama
 * kabuğunu (başlık, alt menü, alt bilgi) taşıyor ve o kabuktaki on iki
 * bağlantının tamamı budamadan sonra 404 verirdi. Ölçüldü.
 *
 * **Nasıl:** Kabuk parçaları zaten `data-print="hide"` ile işaretli — deponun
 * baskı/sesli-okuma konvansiyonu. Yani "yazdırılacak hâli" tam olarak
 * yayımlamak istediğimiz şey. Bu betik o öğeleri, tüm script'leri ve dış
 * bağımlılıkları söküp CSS'i gövdeye gömer; sonuç **tek ve kendi kendine
 * yeten bir HTML dosyasıdır**. `_next/` hiç yayımlanmaz, dolayısıyla uygulama
 * kodu da yayına çıkmaz.
 *
 * Çalıştırma: `npm run build` sonrası `tsx scripts/build-privacy-page.ts`
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "out");

/** Play'in beklediği adres; değiştirilirse Play Console da güncellenmelidir. */
const GIZLILIK_DIR = path.join(OUT, "gizlilik");

/**
 * Pages alt dizinde servis ediyor (`/kamu-sinav-app/`), Capacitor kökten.
 * Durak sayfası elle yazıldığı için Next'in `basePath`ini bilmiyor; aynı
 * değişkenden okunur. 404 sayfası derin bir adreste servis edilebildiği için
 * bağlantılar GÖRELİ OLAMAZ.
 */
const TABAN = process.env.PAGES_BASE_PATH ?? "";

const durakSayfasi = (): string => `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Kamu Sınav Akademi</title>
<link rel="icon" href="${TABAN}/icon.svg">
<style>
:root { color-scheme: light dark; }
body {
\tmargin: 0; min-height: 100vh; display: grid; place-items: center;
\tbackground: #17395e; color: #fff; text-align: center; padding: 24px;
\tfont: 16px/1.6 "Segoe UI", system-ui, -apple-system, sans-serif;
}
main { max-width: 34rem; }
h1 { font-size: 1.9rem; margin: 0 0 .75rem; }
p { opacity: .85; margin: 0 0 1.75rem; }
a.btn {
\tdisplay: inline-block; background: #fff; color: #17395e;
\tpadding: 14px 26px; border-radius: 999px; font-weight: 700;
\ttext-decoration: none;
}
a.alt { display: block; margin-top: 2rem; color: #fff; opacity: .7; font-size: .9rem; }
</style>
</head>
<body>
<main>
<h1>Kamu Sınav Akademi</h1>
<p>Görevde Yükselme ve Unvan Değişikliği sınavlarına hazırlık uygulaması Google Play'de yayında.</p>
<a class="btn" href="https://play.google.com/store/apps/details?id=tr.kamusinavakademi.app">Google Play'de aç</a>
<a class="alt" href="${TABAN}/gizlilik/">Kişisel Verilerin Korunması</a>
</main>
</body>
</html>
`;

/** Dizin içeriğini adlarıyla döndürür; yoksa boş. */
async function girisler(dir: string): Promise<string[]> {
	try {
		return await readdir(dir);
	} catch {
		return [];
	}
}

async function main(): Promise<void> {
	const kaynak = path.join(GIZLILIK_DIR, "index.html");
	const ham = await readFile(kaynak, "utf8");
	const dom = new JSDOM(ham);
	const belge = dom.window.document;

	// 1. Uygulama kabuğu. Zaten "yazdırma dışı" işaretli olan her şey gider:
	//    başlık, alt menü, alt bilgi, veritabanı uyarı şeridi.
	const kabuk = belge.querySelectorAll('[data-print="hide"]');

	for (const oge of kabuk) oge.remove();

	// 2. Script'ler. JS yayımlanmayacağı için hidrasyon da olmayacak; script
	//    etiketleri kalsaydı tarayıcı var olmayan parçaları istemeye çalışırdı.
	for (const oge of belge.querySelectorAll("script")) oge.remove();

	// 3. CSS gövdeye gömülür ve stil bağlantısı kaldırılır — böylece `_next/`
	//    klasörüne hiç ihtiyaç kalmaz.
	let gomulen = 0;

	for (const link of belge.querySelectorAll('link[rel="stylesheet"]')) {
		const href = link.getAttribute("href");

		if (!href) continue;

		const dosya = path.join(OUT, href.replace(/^\//, "").split("?")[0]);
		const css = await readFile(dosya, "utf8");
		const stil = belge.createElement("style");

		stil.textContent = css;
		link.replaceWith(stil);
		gomulen += 1;
	}

	if (gomulen === 0) {
		// Sessizce stilsiz bir sayfa yayımlamaktansa kırılmak yeğdir.
		// En sık sebebi: betik taze bir `npm run build` olmadan ikinci kez
		// çalıştırıldı ve stil zaten gövdeye gömülmüş durumda.
		throw new Error(
			"Stil bağlantısı bulunamadı; sayfa stilsiz çıkardı. " +
				"Bu betik taze bir `npm run build` çıktısı üzerinde çalışır.",
		);
	}

	// 4. Kalan dış bağımlılıklar: manifest, ikon ön yüklemeleri, prefetch.
	const kalanlar = belge.querySelectorAll(
		'link[rel="manifest"], link[rel="preload"], link[rel="prefetch"], link[as="script"]',
	);

	for (const oge of kalanlar) oge.remove();

	// 5. Uygulamaya giden bağlantı kalmamalı: hepsi 404 verirdi.
	for (const bag of belge.querySelectorAll("a[href^='/']")) {
		const href = bag.getAttribute("href") ?? "";

		if (href.startsWith("/gizlilik")) continue;

		// Bağlantıyı sökmek yerine metnini bırakıyoruz: gizlilik metninde
		// geçen bir gönderme cümlenin ortasından kaybolmasın.
		bag.replaceWith(...Array.from(bag.childNodes));
	}

	// 5b. Favicon bağlantısındaki parmak izli sorgu dizesi temizlenir; aksi
	//     hâlde sayfada 404 veren bir ikon bağlantısı kalıyordu. Dosyanın
	//     kendisi budamadan ÖNCE okunur, sonra geri yazılır.
	for (const link of belge.querySelectorAll('link[rel="icon"]')) {
		link.setAttribute("href", `${TABAN}/icon.svg`);
	}

	let ikon: Buffer | null = null;

	try {
		ikon = await readFile(path.join(OUT, "icon.svg"));
	} catch {
		ikon = null;
	}

	// 6. Gizlilik klasöründeki RSC yükleri (`__next.*.txt`) uygulama ağacını
	//    tarif ediyor; sayfa için gereksiz.
	for (const ad of await girisler(GIZLILIK_DIR)) {
		if (ad !== "index.html") {
			await rm(path.join(GIZLILIK_DIR, ad), { recursive: true, force: true });
		}
	}

	// 7. `out/` içinde gizlilik dışında ne varsa silinir.
	for (const ad of await girisler(OUT)) {
		if (ad === "gizlilik") continue;

		await rm(path.join(OUT, ad), { recursive: true, force: true });
	}

	const durak = durakSayfasi();

	await writeFile(path.join(OUT, "index.html"), durak);
	await writeFile(path.join(OUT, "404.html"), durak);
	await writeFile(path.join(OUT, ".nojekyll"), "");

	if (ikon) await writeFile(path.join(OUT, "icon.svg"), ikon);

	await writeFile(
		kaynak,
		`<!doctype html>
${belge.documentElement.outerHTML}
`,
	);

	const boyut = (await readFile(kaynak, "utf8")).length;

	console.log(
		`\n✔ Yalnızca gizlilik yayımlanacak — gizlilik/index.html ${Math.round(boyut / 1024)} KB (kendi kendine yeten)\n`,
	);
}

main().catch((hata: unknown) => {
	console.error(hata);
	process.exit(1);
});
