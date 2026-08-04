/**
 * Google Play mağaza listesi için telefon ekran görüntülerini üretir.
 *
 * Görüntüler elle alınmaz: Play listesi ürünün vitrini ve her sürümde
 * arayüz değişince yenilenmesi gerekir. Elle alınan görüntüler eskir,
 * yeniden üretilebilir olanlar eskimez.
 *
 * Çıktı `store/assets/screenshots/` altına yazılır. Play telefon görüntüleri
 * için en az 2, en çok 8 görsel ister; kenar uzunluğu 320-3840 piksel
 * aralığında olmalıdır. Ölçüler aşağıdaki VIEWPORT ve SCALE'den gelir.
 *
 * Çalıştırma: npm run store:screenshots  (önce `npm run build` ve
 * `npx serve out -p 4173` gerekir)
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "store", "assets", "screenshots");
const BASE = process.env.STORE_SHOT_BASE ?? "http://localhost:4173";

/**
 * Tuval 360×640 ve piksel oranı 3 → 1080×1920, yani tam 9:16.
 * Play telefon görüntülerinde en-boy oranını 16:9 ile 9:16 arasında ister;
 * 1080×2400 gibi daha uzun oranlar bazı hesaplarda reddedilir.
 */
const VIEWPORT = { width: 360, height: 640 };
const SCALE = 3;

/** Kadraj kurulurken bir öğenin üstünde bırakılan pay (CSS pikseli). */
const TOP_PADDING = 88;

interface Shot {
	file: string;
	url: string;
	/** Sayfa açıldıktan sonra ekranı "dolu" hâle getiren adımlar. */
	prepare?: (page: import("@playwright/test").Page) => Promise<void>;
}

const SHOTS: Shot[] = [
	{ file: "01-ana-sayfa.png", url: "/" },
	{ file: "02-konu-ozeti.png", url: "/konular/657-dmk/disiplin-cezalari/" },
	{
		file: "03-test-cozme.png",
		url: "/testler/657-dmk/disiplin-cezalari/test-1/",
		prepare: async (page) => {
			/*
			 * Bir şık seçilir: ürünün farklılaşma tezi olan "her soruda mevzuat
			 * dayanağı ve açıklama" ancak cevap verildikten sonra görünür. Boş
			 * bir soru ekranı vitrinde bunu göstermez.
			 */
			await page
				.locator("label")
				.filter({ has: page.getByRole("radio") })
				.first()
				.click();

			/*
			 * Açıklama ve mevzuat dayanağı şıkların ALTINDA açılır; kaydırılmazsa
			 * vitrinde yalnızca sıradan bir çoktan seçmeli ekran görünür.
			 *
			 * Gerekçe paneli tek ekrana sığmayacak kadar uzun olabilir; kadraj
			 * bu yüzden panelin BAŞLIĞINA göre kurulur. Kaydırma miktarı ölçülür,
			 * tahmin edilmez: başlık kutusunun viewport içindeki yeri okunup
			 * üstten sabit bir paya çekilir, böylece açıklama ve altındaki
			 * mevzuat dayanağı satırı kadrajda kalır.
			 */
			const sonuc = page.getByText(/^(Doğru|Yanlış)$/).first();
			await sonuc.waitFor();
			const kutu = await sonuc.boundingBox();
			if (kutu) await page.mouse.wheel(0, kutu.y - TOP_PADDING);
			await page.waitForTimeout(400);
		},
	},
	{ file: "04-deneme-sinavi.png", url: "/deneme/" },
	{ file: "05-hakkinda.png", url: "/hakkinda/" },
];

async function main(): Promise<void> {
	await mkdir(OUT_DIR, { recursive: true });

	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: SCALE,
		isMobile: true,
		hasTouch: true,
		locale: "tr-TR",
		timezoneId: "Europe/Istanbul",
	});

	for (const { file, url, prepare } of SHOTS) {
		const page = await context.newPage();
		await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
		if (prepare) await prepare(page);

		await page.screenshot({ path: path.join(OUT_DIR, file) });
		await page.close();
		console.log(`    ${file.padEnd(24)} ${VIEWPORT.width*SCALE}×${VIEWPORT.height*SCALE}`);
	}

	await context.close();
	await browser.close();
}

console.log("\n✔ Mağaza ekran görüntüleri üretiliyor:\n");
main()
	.then(() => console.log(""))
	.catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
