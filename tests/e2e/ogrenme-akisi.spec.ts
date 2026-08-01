import { expect, test } from "@playwright/test";
import { mevzuatDayanagiKalibi, sikSec, testiAc } from "./yardimcilar";

/**
 * Öğrenme döngüsü: konu özeti → test → sonuç → ilerleme.
 *
 * PROJECT_PLAN.md §12.2'deki ana akış. Bu akış kırılırsa ürünün çekirdeği
 * çalışmıyor demektir.
 */

/** Sabit testlerin standart boyu — `lib/selector/test-sets.ts` ile aynı. */
const TEST_BOYU = 10;

test("ana sayfa bir sonraki adımı önerir", async ({ page }) => {
	await page.goto("/");

	await expect(
		page.getByRole("heading", { name: "Merhaba" }),
	).toBeVisible();

	// Ana sayfanın tek baskın çağrısı: ne çalışacağını söylemeli.
	await expect(
		page.getByRole("link", { name: /Okumaya başla|Tekrar çöz/ }),
	).toBeVisible();
});

test("konu özetinden testine geçilir ve sonuç kaydedilir", async ({ page }) => {
	await page.goto("/konular/657-dmk/disiplin-cezalari/");

	// Güven damgası: hangi mevzuat sürümü olduğu görünmeli (§4, taahhüt 4).
	await expect(page.getByText(/Son doğrulama:/)).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Bir bakışta" }).first(),
	).toBeVisible();

	await page.getByRole("link", { name: "Bu konuyu test et" }).click();
	await expect(page).toHaveURL(/\/testler\/657-dmk\/disiplin-cezalari\/$/);

	// Kurulum ekranı yok: listeden test seçilir, test hemen başlar.
	await testiAc(page, 1);
	await expect(page).toHaveURL(/\/testler\/657-dmk\/disiplin-cezalari\/test-1\//);

	// Anında geri bildirim varsayılan olarak açık: her soruda önce şık,
	// sonra ilerleme.
	for (let i = 0; i < TEST_BOYU; i += 1) {
		await expect(page.getByText(`Soru ${i + 1} / ${TEST_BOYU}`)).toBeVisible();
		await sikSec(page);
		await page
			.getByRole("button", { name: i === TEST_BOYU - 1 ? "Testi bitir" : "Sonraki" })
			.click();
	}

	await expect(
		page.getByRole("heading", { name: "Test 1 sonucu" }),
	).toBeVisible();
	await expect(page.getByText("100 üzerinden puan")).toBeVisible();

	// Skor test listesine rozet olarak dönmeli.
	await page.goto("/testler/657-dmk/disiplin-cezalari/");
	await expect(
		page.getByRole("link", { name: /^Test 1:.*En iyi puanın/ }),
	).toBeVisible();

	// Sonuç ilerlemeye yansımalı.
	await page.goto("/ilerleme/");
	await expect(page.getByText("Çözülen soru")).toBeVisible();
	await expect(page.getByText("Disiplin Cezaları")).toBeVisible();
});

test("her test dört zorluk seviyesini birlikte içerir", async ({ page }) => {
	// Ürün kararı: kullanıcı zorluk seçmez, her test kolaydan uzmana yayılır.
	await page.goto("/testler/657-dmk/disiplin-cezalari/");

	const ilkTest = page.getByRole("link", { name: /^Test 1:/ });
	for (const seviye of ["kolay", "orta", "zor", "uzman"]) {
		await expect(ilkTest).toContainText(seviye);
	}
	await expect(ilkTest).toContainText(`${TEST_BOYU} soru`);
});

test("her soruda mevzuat dayanağı ve hata bildirimi görünür", async ({
	page,
}) => {
	await page.goto("/testler/657-dmk/disiplin-cezalari/test-1/");
	await sikSec(page);

	// Farklılaşma tezi: dayanak her zaman görünür (§4, taahhüt 1).
	// Hangi soru çekilirse çekilsin geçerli olsun diye kalıp havuzdan türetilir.
	await expect(
		page.getByText(mevzuatDayanagiKalibi("657-dmk", "disiplin-cezalari")).first(),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Bu soruda sorun var" }),
	).toBeVisible();
});

test("yanlış cevap tekrar planına girer", async ({ page }) => {
	await page.goto("/testler/anayasa/genel-esaslar/test-1/");

	for (let i = 0; i < TEST_BOYU; i += 1) {
		await sikSec(page);
		await page
			.getByRole("button", { name: i === TEST_BOYU - 1 ? "Testi bitir" : "Sonraki" })
			.click();
	}

	await page.goto("/yanlislarim/");
	// SM-2'nin en kısa aralığı bir gün olduğu için bugün planlı tekrar
	// çıkmaz; yanlış bankası bundan bağımsız çalışmalıdır.
	await expect(page.getByText("soru takipte")).toBeVisible();
});
