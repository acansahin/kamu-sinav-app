import { readFileSync } from "node:fs";
import path from "node:path";
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

/**
 * Test kurulumunda soru sayısını seçer.
 *
 * Arama, legend'i "Soru sayısı" olan fieldset ile sınırlanır. Sayfada aynı
 * metni üretebilen ikinci bir kaynak var: "Zorluk seviyesi" fieldset'i her
 * seviyenin yanına havuzdaki soru sayısını rozet olarak basar. Bir konuda o
 * sayı seçeneklerden birine eşitlenince (havuz büyüdükçe kaçınılmaz)
 * sayfa geneli arama iki öğe bulup strict mode ihlali veriyordu.
 */
export async function soruSayisiSec(page: Page, etiket: string) {
	await page
		.getByRole("group", { name: "Soru sayısı" })
		.getByText(etiket, { exact: true })
		.click();
}

/** Görünen ilk şıkkı seçer. */
export async function sikSec(page: Page) {
	await page
		.locator("label")
		.filter({ has: page.getByRole("radio") })
		.first()
		.click();
}

function regexKacir(metin: string): string {
	return metin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bir konunun sorularında geçebilecek mevzuat adlarını eşleyen kalıp.
 *
 * Kalıp elle yazılmaz, havuzdan türetilir. Sebebi somut: test hangi sorunun
 * çekileceğini bilmez (seçici rastgeledir) ve tek bir konunun soruları birden
 * fazla mevzuata dayanabilir — "disiplin-cezalari"nin 65 sorusundan 18'i
 * kanuna değil yönetmeliğe dayanır. Tek bir kanun adı sabitlenirse test
 * çekilen soruya göre rastgele kırılır. Havuz genelinde 11 farklı mevzuat adı
 * var ve içerik eklendikçe artıyor; listeyi elle güncel tutmak sürdürülemez.
 *
 * Ölçülen şey adın kendisi değil: her sorunun ekranda BİR dayanak gösterdiği
 * (PROJECT_PLAN.md §4, taahhüt 1).
 */
export function mevzuatDayanagiKalibi(
	dersId: string,
	konuSlug: string,
): RegExp {
	const dosya = path.join(
		process.cwd(),
		"content",
		"subjects",
		dersId,
		"questions",
		`${konuSlug}.json`,
	);
	const sorular = JSON.parse(readFileSync(dosya, "utf8")) as {
		legalRef: { law: string };
	}[];

	const adlar = [...new Set(sorular.map((s) => s.legalRef.law))];
	if (adlar.length === 0) {
		throw new Error(`${dersId}/${konuSlug} havuzunda soru yok`);
	}

	return new RegExp(adlar.map(regexKacir).join("|"));
}
