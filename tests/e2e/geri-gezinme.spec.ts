import { expect, test } from "@playwright/test";
import { sikSec, testiAc } from "./yardimcilar";

/**
 * Ekran içi geri gezinme.
 *
 * İki ayrı kusuru birlikte sınar ve ikisi de APK'da ortaya çıkar:
 *
 *  1. Derin bağlantıyla açılan sayfada geçmiş boştur; `router.back()` orada
 *     ölü kalır ve donanım tuşuna bağlandığında uygulamadan çıkarır. Doğru
 *     davranış hiyerarşik üste gitmektir.
 *  2. Test çözerken başka bir sayfaya gidip dönmek cevapları kaybetmemelidir —
 *     kullanıcı emeğini kaybederse özelliğin kendisi güvenilmez olur.
 *
 * Birim testi (`tests/unit/use-back-navigation.test.tsx`) sayacın karar
 * tablosunu ölçer; burada ölçülen, gerçek yönlendirici ve gerçek depolama ile
 * uçtan uca sonuç.
 */

test("derin bağlantıdan geri, hiyerarşik üste gider", async ({ page }) => {
	// Doğrudan konu sayfası: uygulama içinde hiç gezinilmedi, geçmiş boş.
	await page.goto("/konular/657-dmk/disiplin-cezalari/");

	await page.getByRole("button", { name: "Geri", exact: true }).click();

	// Ana sayfaya değil, dersin konu listesine düşmeli.
	await expect(page).toHaveURL(/\/konular\/657-dmk\/$/);
});

test("test çözerken ayrılıp dönünce cevaplar durur", async ({ page }) => {
	await page.goto("/testler/657-dmk/disiplin-cezalari/");
	await testiAc(page, 1);

	// İlk soru cevaplanır, sonra ikinciye geçilir.
	await sikSec(page);
	await page.getByRole("button", { name: /Sonraki|Devam/ }).click();
	await expect(page.getByText(/2\s*\/\s*10/)).toBeVisible();

	// Ayarlar her sayfadan açılabilir; hiyerarşik üstü test sayfası DEĞİLDİR,
	// bu senaryoyu ancak geçmiş çözer.
	await page.getByRole("link", { name: "Ayarlar" }).click();
	await expect(page).toHaveURL(/\/ayarlar\/$/);

	await page.getByRole("button", { name: "Geri", exact: true }).click();

	// Teste dönülmeli ve yarım kalan oturum kaldığı sorudan sürmeli.
	await expect(page).toHaveURL(
		/\/testler\/657-dmk\/disiplin-cezalari\/test-1\/$/,
	);
	await expect(page.getByText(/2\s*\/\s*10/)).toBeVisible();
});

test("ana sayfada geri tuşu gösterilmez", async ({ page }) => {
	await page.goto("/");

	// Kökün üstü yoktur; tuşun orada durması kullanıcıya yalan söylerdi.
	await expect(page.getByRole("button", { name: "Geri", exact: true })).toHaveCount(0);
});
