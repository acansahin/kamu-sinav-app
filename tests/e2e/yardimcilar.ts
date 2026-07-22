import type { Page } from "@playwright/test";

/**
 * Ortak test yardımcıları.
 *
 * Soru şıkları ve sayı seçenekleri, tasarım gereği görsel olarak gizlenmiş
 * radio girdileri kullanır (etiketin kendisi tıklanabilir kart görevi görür).
 * Gizli girdiyi doğrudan işaretlemek gerçek kullanımı taklit etmez ve
 * Playwright'ın tıklanabilirlik denetimine takılır; bu yüzden her yerde
 * etikete tıklanır.
 */

/** Test kurulumunda soru sayısını seçer. */
export async function soruSayisiSec(page: Page, etiket: string) {
	await page.getByText(etiket, { exact: true }).click();
}

/** Görünen ilk şıkkı seçer. */
export async function sikSec(page: Page) {
	await page
		.locator("label")
		.filter({ has: page.getByRole("radio") })
		.first()
		.click();
}
