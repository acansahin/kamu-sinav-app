import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { sikSec } from "./yardimcilar";

/**
 * Erişilebilirlik kapısı — PROJECT_PLAN.md §13.2.
 *
 * Hedef kitlenin yaş profili nedeniyle erişilebilirlik "sonra bakarız"
 * değil kabul kriteridir. Bu testler CI'da çalışır ve ihlal build'i kırar;
 * aksi hâlde taahhüt yalnızca belgede kalır.
 *
 * Otomatik tarama her şeyi yakalamaz (klavye akışı, ekran okuyucu deneyimi
 * elle denenmelidir) ama sessiz gerilemeleri durdurur.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const SAYFALAR = [
	{ ad: "Ana sayfa", yol: "/" },
	{ ad: "Ders listesi", yol: "/konular/" },
	{ ad: "Konu listesi", yol: "/konular/657-dmk/" },
	{ ad: "Konu özeti", yol: "/konular/657-dmk/disiplin-cezalari/" },
	{ ad: "Konunun test listesi", yol: "/testler/657-dmk/disiplin-cezalari/" },
	{ ad: "Deneme sınavı", yol: "/deneme/" },
	{ ad: "Tekrar merkezi", yol: "/yanlislarim/" },
	{ ad: "İlerleme", yol: "/ilerleme/" },
	{ ad: "İstatistikler", yol: "/istatistik/" },
	{ ad: "Arama", yol: "/arama/" },
	{ ad: "Ayarlar", yol: "/ayarlar/" },
	{ ad: "Hesap", yol: "/hesap/" },
	{ ad: "Kişisel verilerin korunması", yol: "/gizlilik/" },
	{ ad: "Hakkında", yol: "/hakkinda/" },
];

for (const { ad, yol } of SAYFALAR) {
	test(`${ad} erişilebilirlik ihlali içermez`, async ({ page }) => {
		await page.goto(yol);
		// İstemci tarafı veriler (Dexie) yüklenmeden taramak boş iskeletleri
		// denetler; gerçek arayüzü görmek için ana başlığı bekliyoruz.
		await page.getByRole("heading", { level: 1 }).first().waitFor();

		const sonuc = await new AxeBuilder({ page }).withTags(WCAG).analyze();

		expect(
			sonuc.violations,
			sonuc.violations
				.map((v) => `${v.id}: ${v.help} (${v.nodes.length} öğe)`)
				.join("\n"),
		).toEqual([]);
	});
}

test("test çözme ekranı erişilebilirlik ihlali içermez", async ({ page }) => {
	// Soru kartı asıl etkileşimli arayüzdür; test listesini taramak onu kaçırır.
	await page.goto("/testler/657-dmk/disiplin-cezalari/test-1/");
	await page.getByText("Soru 1 / 10").waitFor();

	const kurulum = await new AxeBuilder({ page }).withTags(WCAG).analyze();
	expect(
		kurulum.violations,
		kurulum.violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
	).toEqual([]);

	// Cevap verildikten sonra açıklama ve geri bildirim alanı da taranmalı.
	await sikSec(page);
	const cevaplanmis = await new AxeBuilder({ page }).withTags(WCAG).analyze();
	expect(
		cevaplanmis.violations,
		cevaplanmis.violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
	).toEqual([]);
});

test("büyük yazı ve yüksek kontrast modunda ihlal oluşmaz", async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => {
		document.documentElement.setAttribute("data-font-scale", "cok-buyuk");
		document.documentElement.setAttribute("data-contrast", "yuksek");
	});

	const sonuc = await new AxeBuilder({ page }).withTags(WCAG).analyze();
	expect(
		sonuc.violations,
		sonuc.violations.map((v) => `${v.id}: ${v.help}`).join("\n"),
	).toEqual([]);
});
