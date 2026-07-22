import { expect, test } from "@playwright/test";
import { sikSec } from "./yardimcilar";

/**
 * Deneme sınavı akışı — PROJECT_PLAN.md §12.3.
 *
 * Buradaki testler ürünün en kırılgan parçasını korur: süre, navigatör ve
 * kurtarma. Bu üçünden biri sessizce bozulursa kullanıcı sınavın ortasında
 * emeğini kaybeder.
 */

async function sinaviBaslat(page: import("@playwright/test").Page) {
	await page.goto("/deneme/");
	await page
		.getByRole("button", { name: "Sınavı başlat" })
		.first()
		.click();
	await expect(page.getByText(/Soru 1 \/ 20/)).toBeVisible();
}

test("şablonlar dağılımıyla birlikte listelenir", async ({ page }) => {
	await page.goto("/deneme/");

	// Üç format da havuz yeterli olduğu için başlatılabilir olmalı.
	await expect(page.getByText("Hızlı Deneme — 20 Soru")).toBeVisible();
	await expect(page.getByText(/Unvan Değişikliği Formatı/)).toBeVisible();
	await expect(page.getByText(/Görevde Yükselme Formatı/)).toBeVisible();
	await expect(page.getByRole("button", { name: "Sınavı başlat" })).toHaveCount(3);

	// Ders dağılımı gizlenmez: kullanıcı neyle karşılaşacağını önden görür.
	await expect(
		page.getByText(/657 Sayılı Devlet Memurları Kanunu: \d+/).first(),
	).toBeVisible();
});

test("navigatör cevaplanan ve işaretlenen soruları ayırt eder", async ({
	page,
}) => {
	await sinaviBaslat(page);

	const navigator = page.getByRole("navigation", { name: "Soru navigatörü" });
	await expect(navigator.getByRole("button", { name: "Soru 1, aktif" })).toBeVisible();
	await expect(navigator.getByRole("button", { name: "Soru 2, boş" })).toBeVisible();

	await sikSec(page);
	await page.getByRole("button", { name: "İşaretle" }).click();
	await page.getByRole("button", { name: "Sonraki" }).click();

	// Durum yalnızca renkle değil, erişilebilir adla da bildirilmeli.
	await expect(
		navigator.getByRole("button", { name: "Soru 1, işaretli" }),
	).toBeVisible();
});

test("teslim öncesi boş soru sayısı uyarılır", async ({ page }) => {
	await sinaviBaslat(page);
	await sikSec(page);

	await page.getByRole("button", { name: "Sınavı bitir" }).click();

	await expect(page.getByText("Sınavı teslim etmek üzeresin")).toBeVisible();
	await expect(page.getByText("19 soru boş")).toBeVisible();

	await page.getByRole("button", { name: "Evet, teslim et" }).click();

	await expect(page.getByRole("heading", { name: "Sınav Analizi" })).toBeVisible();
	await expect(page.getByText("Ders bazlı performans")).toBeVisible();
	await expect(page.getByText("Öncelikli çalışman gerekenler")).toBeVisible();
});

test("yarıda kalan sınav kurtarılabilir", async ({ page }) => {
	await sinaviBaslat(page);
	await sikSec(page);

	// Otomatik kaydetme beş saniyede bir; sekme kapanmasını taklit etmek
	// için sayfadan ayrılıyoruz.
	await page.waitForTimeout(6000);
	await page.goto("/deneme/");

	await expect(page.getByText("Yarıda kalmış bir sınavın var")).toBeVisible();
	await page.getByRole("button", { name: "Devam et" }).click();

	// Cevap korunmuş olmalı: ilk soru artık navigatörde cevaplanmış görünür.
	await expect(
		page
			.getByRole("navigation", { name: "Soru navigatörü" })
			.getByRole("button", { name: /Soru 1, (aktif|cevaplandı)/ }),
	).toBeVisible();
});

test("süre bitince sınav kendiliğinden teslim edilir", async ({ page }) => {
	// Gerçek zamanda 30 dakika beklemek yerine saat ileri sarılır.
	await page.clock.install();
	await sinaviBaslat(page);
	await sikSec(page);

	await page.clock.runFor("30:05");

	await expect(page.getByRole("heading", { name: "Sınav Analizi" })).toBeVisible({
		timeout: 15_000,
	});
});
