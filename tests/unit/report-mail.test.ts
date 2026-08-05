import { describe, expect, it } from "vitest";
import {
	type DataController,
	getContactEmail,
} from "@/lib/legal/data-controller";
import {
	REPORT_MAIL_MAX_BODY,
	buildReportMailBody,
	buildReportMailto,
} from "@/lib/legal/report-mail";
import type { QuestionReport, ReportReason } from "@/types/progress";

/**
 * Hata bildiriminin uygulamadan çıkış yolu.
 *
 * Statik export'ta sunucu yok; bildirimi bize ulaştıran tek sunucusuz kanal
 * `mailto:` taslağı. Buradaki testler kanalın sessizce bozulmasını engeller:
 * adres yokken kanalın hiç açılmaması ve uzun listelerin istemcide kırpılacak
 * kadar şişmemesi.
 */

const LABELS: Record<ReportReason, string> = {
	"yanlis-cevap": "Doğru cevap yanlış görünüyor",
	"guncel-degil": "Bilgi güncel değil",
	"belirsiz-ifade": "Soru veya şık belirsiz",
	"yazim-hatasi": "Yazım hatası",
	diger: "Diğer",
};

const labelFor = (reason: ReportReason) => LABELS[reason];

function report(overrides: Partial<QuestionReport> = {}): QuestionReport {
	return {
		id: "r1",
		userId: "local",
		questionId: "657-dmk-genel-hukumler-001",
		reason: "yanlis-cevap",
		status: "yerel",
		createdAt: "2026-08-05T10:00:00.000Z",
		updatedAt: "2026-08-05T10:00:00.000Z",
		...overrides,
	};
}

function controller(overrides: Partial<DataController> = {}): DataController {
	return { name: "", email: "", address: "", ...overrides };
}

describe("iletişim adresi", () => {
	it("adres boşken null döner", () => {
		// Yayın öncesi normal durum: hiçbir yüzey adres varmış gibi davranmamalı.
		expect(getContactEmail(controller())).toBeNull();
	});

	it("yalnızca boşluk içeren adres dolu sayılmaz", () => {
		expect(getContactEmail(controller({ email: "   " }))).toBeNull();
	});

	it("adres doluysa kırpılmış hâlini döner", () => {
		expect(getContactEmail(controller({ email: " bilgi@ornek.com " }))).toBe(
			"bilgi@ornek.com",
		);
	});
});

describe("bildirim e-postası", () => {
	it("bildirim yoksa bağlantı üretilmez", () => {
		// Boş bir taslak açmak kullanıcıyı yanıltır.
		expect(
			buildReportMailto({ email: "bilgi@ornek.com", reports: [], labelFor }),
		).toBeNull();
	});

	it("soru numarasını, sorunu ve notu gövdeye koyar", () => {
		const body = buildReportMailBody({
			reports: [report({ note: "B şıkkı da doğru görünüyor" })],
			labelFor,
		});

		expect(body).toContain("657-dmk-genel-hukumler-001");
		expect(body).toContain("Doğru cevap yanlış görünüyor");
		expect(body).toContain("B şıkkı da doğru görünüyor");
	});

	it("notu olmayan bildirimde boş Not satırı bırakmaz", () => {
		const body = buildReportMailBody({ reports: [report()], labelFor });
		expect(body).not.toContain("Not:");
	});

	it("adresi ve konuyu bağlantıya kodlar", () => {
		const url = buildReportMailto({
			email: "bilgi@ornek.com",
			reports: [report()],
			labelFor,
		});

		expect(url).toMatch(/^mailto:bilgi@ornek\.com\?subject=/);
		// Türkçe karakterler ve satır sonları kodlanmadan bağlantı bozulur.
		expect(url).not.toContain("\n");
		expect(url).toContain("&body=");
	});

	it("tek ve çoklu bildirimde konu satırı farklıdır", () => {
		const tek = buildReportMailto({
			email: "b@o.com",
			reports: [report()],
			labelFor,
		});
		const coklu = buildReportMailto({
			email: "b@o.com",
			reports: [report(), report({ id: "r2" })],
			labelFor,
		});

		expect(decodeURIComponent(tek ?? "")).toContain("soru hata bildirimi");
		expect(decodeURIComponent(coklu ?? "")).toContain("2 soru hata bildirimi");
	});

	describe("uzunluk sınırı", () => {
		// `mailto:` uzunluğu istemciye bağlıdır ve aşılırsa bağlantı sessizce
		// kırpılır ya da hiç açılmaz. Sığmayan bildirimler atılmaz, sayılır.
		const cok = Array.from({ length: 200 }, (_, i) =>
			report({
				id: `r${i}`,
				questionId: `657-dmk-konu-${String(i).padStart(3, "0")}`,
				note: "Bu bildirimin gövdeyi şişirmesi için yazılmış uzun bir not.",
			}),
		);

		it("gövde üst sınırı aşmaz", () => {
			const body = buildReportMailBody({ reports: cok, labelFor });
			// Sığmayanları anlatan kapanış cümlesi sınırın dışındadır; onsuz ölçülür.
			const govde = body.split("\n\n(Bu e-postaya")[0];
			expect(govde.length).toBeLessThanOrEqual(REPORT_MAIL_MAX_BODY);
		});

		it("sığmayan bildirimlerin sayısını ve tam listenin yerini söyler", () => {
			const body = buildReportMailBody({ reports: cok, labelFor });
			expect(body).toMatch(/\(Bu e-postaya \d+ bildirim daha sığmadı\./);
			expect(body).toContain("dışa aktar");
		});

		it("sığan bildirimlerde sıra korunur, araya atlama girmez", () => {
			const body = buildReportMailBody({ reports: cok, labelFor });
			const numaralar = [...body.matchAll(/^(\d+)\) /gm)].map((m) =>
				Number(m[1]),
			);
			expect(numaralar.length).toBeGreaterThan(0);
			expect(numaralar).toEqual(
				Array.from({ length: numaralar.length }, (_, i) => i + 1),
			);
		});

		it("kısa listede kapanış cümlesi hiç çıkmaz", () => {
			const body = buildReportMailBody({ reports: [report()], labelFor });
			expect(body).not.toContain("sığmadı");
		});
	});
});
