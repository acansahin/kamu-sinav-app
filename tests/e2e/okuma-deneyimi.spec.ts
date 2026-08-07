import { expect, test } from "@playwright/test";

/**
 * Konu özetinin okuma yardımları: içindekiler, ilerleme şeridi, sona varınca
 * otomatik "okundu" ve yer imi.
 *
 * Bu davranışların tamamı kaydırmaya, `IntersectionObserver`a ve
 * `requestAnimationFrame`e bağlı; birim testiyle değil ancak gerçek bir
 * tarayıcıda ölçülebilir.
 */

const KONU = "/konular/657-dmk/disiplin-cezalari/";

test.describe("okuma deneyimi", () => {
	test("içindekiler bölümleri listeler ve tıklanan bölüme götürür", async ({
		page,
	}) => {
		await page.goto(KONU);

		// Dar ekranda katlanır liste, geniş ekranda yan sütun — ikisi de
		// aynı bölümleri gösterir.
		const genis = page.getByRole("navigation", { name: "İçindekiler" });
		const dar = page.getByRole("group").filter({ hasText: "İçindekiler" });

		const viewport = page.viewportSize();
		const hedef = (viewport?.width ?? 0) >= 1024 ? genis : dar;

		if ((viewport?.width ?? 0) < 1024) await dar.click();
		await expect(hedef.getByRole("link").first()).toBeVisible();

		const ilkBolum = hedef.getByRole("link").nth(1);
		const baslikMetni = (await ilkBolum.textContent())?.replace(/^\d+\.\s*/, "");
		await ilkBolum.click();

		/*
		 * Başlık yapışkan başlığın ARKASINDA kalmamalı. Tıklama payı
		 * `--baslik-yuksekligi`den okunuyor; sabit piksel verildiğinde büyük
		 * yazı boyutunda hedef başlığın altına gizleniyordu.
		 */
		const hedefBaslik = page
			.getByRole("heading", { name: baslikMetni?.trim() ?? "" })
			.first();
		await expect(hedefBaslik).toBeInViewport();

		const ust = await hedefBaslik.evaluate(
			(el) => el.getBoundingClientRect().top,
		);
		const baslikAlti = await page.locator("header").evaluate((el) => {
			return el.getBoundingClientRect().bottom;
		});
		expect(ust).toBeGreaterThanOrEqual(baslikAlti);
	});

	test("okuma ilerleme şeridi kaydırdıkça dolar ve başlıkla örtüşmez", async ({
		page,
	}) => {
		await page.goto(KONU);

		const serit = page.getByRole("progressbar", {
			name: "Konu özetinde okuma ilerlemesi",
		});
		await expect(serit).toHaveAttribute("aria-valuenow", "0");

		await page.mouse.wheel(0, 4000);
		await expect
			.poll(async () => Number(await serit.getAttribute("aria-valuenow")))
			.toBeGreaterThan(0);

		// İkisi de yapışkan; şerit başlığın altında kalmamalı.
		const kutular = await serit.evaluate((el) => ({
			seritUst: el.getBoundingClientRect().top,
			baslikAlt: document.querySelector("header")?.getBoundingClientRect()
				.bottom,
		}));
		expect(kutular.seritUst).toBeGreaterThanOrEqual(
			(kutular.baslikAlt ?? 0) - 0.5,
		);
	});

	test("sona varınca okundu işaretlenir ve geri alınabilir", async ({
		page,
	}) => {
		await page.goto(KONU);
		await expect(
			page.getByRole("button", { name: "Okudum olarak işaretle" }),
		).toBeVisible();

		await page.keyboard.press("End");

		// Nirengi 2 saniye görünür kalınca işaretlenir.
		await expect(page.getByText("Bu konuyu okudun")).toBeVisible({
			timeout: 10_000,
		});

		await page.getByRole("button", { name: "Geri al" }).click();
		await expect(
			page.getByRole("button", { name: "Okudum olarak işaretle" }),
		).toBeVisible();

		/*
		 * `summaryReadAt` DE silinmeli. `markSummaryRead` o alanı bilinçli
		 * koruduğu için yalnızca bayrağı çevirmek "okunmadı ama okunma tarihi
		 * var" diyen tutarsız bir satır bırakırdı.
		 */
		const satir = await page.evaluate(async () => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const istek = indexedDB.open("kamu-sinav-akademi");
				istek.onsuccess = () => resolve(istek.result);
				istek.onerror = () => reject(istek.error);
			});
			return new Promise<{ summaryRead: boolean; summaryReadAt?: string } | null>(
				(resolve) => {
					const istek = db
						.transaction("topicProgress")
						.objectStore("topicProgress")
						.get(["local", "657-dmk/disiplin-cezalari"]);
					istek.onsuccess = () => resolve(istek.result ?? null);
					istek.onerror = () => resolve(null);
				},
			);
		});

		expect(satir?.summaryRead).toBe(false);
		expect(satir?.summaryReadAt).toBeUndefined();
	});

	test("okuma kromu kâğıda basılmaz", async ({ page }) => {
		await page.goto(KONU);
		// Yer imi düğmesi Dexie cevabını bekliyor; görünmeden ölçüm anlamsız.
		await expect(
			page.getByRole("button", { name: /Yer im/ }),
		).toBeVisible();

		await page.emulateMedia({ media: "print" });

		/*
		 * İçindekiler, ilerleme şeridi ve yer imi düğmesi uygulamanın kendi
		 * kromudur; çıktıda yer almamalı. Hepsi `data-print="hide"` taşır ve
		 * kural `globals.css`te tek yerdedir — düğme için ayrıca ölçülüyor,
		 * çünkü niteliğin `Button` bileşeninden geçmesi gerekiyor.
		 */
		await expect(
			page.getByRole("navigation", { name: "İçindekiler" }),
		).toBeHidden();
		await expect(
			page.getByRole("progressbar", {
				name: "Konu özetinde okuma ilerlemesi",
			}),
		).toBeHidden();
		await expect(page.getByRole("button", { name: /Yer im/ })).toBeHidden();

		// Ama özetin kendisi basılmalı.
		await expect(
			page.getByRole("heading", { name: "Disiplin Cezaları" }).first(),
		).toBeVisible();
	});

	test("yer imi eklenince konu listesinde görünür", async ({ page }) => {
		await page.goto(KONU);

		await page.getByRole("button", { name: "Yer imine ekle" }).click();
		await expect(
			page.getByRole("button", { name: "Yer imlerinde" }),
		).toBeVisible();

		await page.goto("/konular/");
		const bolum = page.getByRole("heading", { name: "Yer imlerin" });
		await expect(bolum).toBeVisible();
		await expect(
			page.getByRole("link", { name: /Disiplin Cezaları/ }).first(),
		).toBeVisible();

		// Kaldırınca bölüm tamamen kaybolmalı — boş bir "yer imin yok" kartı yok.
		await page.goto(KONU);
		await page.getByRole("button", { name: "Yer imlerinde" }).click();
		await expect(
			page.getByRole("button", { name: "Yer imine ekle" }),
		).toBeVisible();

		await page.goto("/konular/");
		await expect(bolum).toHaveCount(0);
	});
});
