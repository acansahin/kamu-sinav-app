import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import {
	FREE_TEST_SLUG,
	FREE_TOPIC_BY_SUBJECT,
} from "@/lib/billing/entitlement";
import { buildTestSets } from "@/lib/selector/test-sets";
import {
	contentManifestSchema,
	questionSchema,
	summaryDocSchema,
} from "@/types/content";

/**
 * Gerçek içeriğin bütünlüğü.
 *
 * `build-content.ts` zaten bir CI kapısıdır; bu testler o kapının kurallarını
 * ikinci kez, bağımsız olarak doğrular. Ürünün tezi içeriğe güven olduğu için
 * bu kuralların sessizce gevşemesi kabul edilemez.
 *
 * Önkoşul: `npm run content:build` çalışmış olmalı (test betiği öncesinde
 * pretest ile bağlanmıştır).
 */

const CONTENT_ROOT = path.join(process.cwd(), "public", "content");

async function loadManifest() {
	const raw = JSON.parse(
		await readFile(path.join(CONTENT_ROOT, "manifest.json"), "utf8"),
	);
	return contentManifestSchema.parse(raw);
}

async function loadAllQuestions() {
	const root = path.join(CONTENT_ROOT, "questions");
	const subjects = await readdir(root, { withFileTypes: true });
	const questions = [];

	for (const subject of subjects.filter((e) => e.isDirectory())) {
		const dir = path.join(root, subject.name);
		for (const file of await readdir(dir)) {
			const raw = JSON.parse(await readFile(path.join(dir, file), "utf8"));
			questions.push(...questionSchema.array().parse(raw));
		}
	}
	return questions;
}

describe("derlenmiş içerik", () => {
	it("manifest şemaya uyar", async () => {
		const manifest = await loadManifest();
		expect(manifest.subjects.length).toBeGreaterThan(0);
	});

	it("manifestteki soru sayısı gerçek dosyalarla tutarlıdır", async () => {
		const [manifest, questions] = await Promise.all([
			loadManifest(),
			loadAllQuestions(),
		]);
		expect(questions).toHaveLength(manifest.totals.publishedQuestions);
	});

	it("konu özetleri şemaya uyar ve güven damgası taşır", async () => {
		const root = path.join(CONTENT_ROOT, "summaries");
		const subjects = await readdir(root, { withFileTypes: true });

		for (const subject of subjects.filter((e) => e.isDirectory())) {
			const dir = path.join(root, subject.name);
			for (const file of await readdir(dir)) {
				const raw = JSON.parse(await readFile(path.join(dir, file), "utf8"));
				const summary = summaryDocSchema.parse(raw);

				expect(summary.legislationVersion.length).toBeGreaterThan(3);
				expect(summary.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
				expect(summary.keyPoints.length).toBeGreaterThanOrEqual(2);
			}
		}
	});
});

/**
 * Ücretsiz ön gösterimin gerçekten var olduğu.
 *
 * Paywall'ın her derste açık bıraktığı konu ve test,
 * `lib/billing/entitlement.ts` içinde SLUG olarak sabittir. O slug'lar bir gün
 * yeniden adlandırılırsa kilit mantığı hatasız çalışmaya devam eder ama hiçbir
 * şeyi açmaz: uygulama sessizce "hiçbir şey ücretsiz değil" hâline gelir ve bu
 * ancak mağaza yorumlarından öğrenilir. Bu yüzden eşleşme bir derleme kapısıdır.
 *
 * Kapı iki yönlüdür ve ikincisi daha sinsidir: haritadaki slug içerikte
 * bulunmayabileceği gibi, içerikteki bir DERS de haritada bulunmayabilir. Yeni
 * ders eklendiğinde harita güncellenmezse o ders bütünüyle kilitli doğar —
 * hata mesajı olmadan, yalnızca satmayan bir ders olarak.
 */
describe("ücretsiz ön gösterim içerikte karşılığı olan konulardır", () => {
	it("her dersin haritada bir ücretsiz konusu vardır", async () => {
		const manifest = await loadManifest();

		for (const subject of manifest.subjects) {
			expect(
				FREE_TOPIC_BY_SUBJECT.get(subject.id),
				`“${subject.id}” dersi FREE_TOPIC_BY_SUBJECT haritasında yok — ders bütünüyle kilitli doğar`,
			).toBeDefined();
		}

		// Ters yön: haritada içerikte karşılığı olmayan ders kalmasın.
		const known = new Set(manifest.subjects.map((s) => s.id));
		for (const subjectId of FREE_TOPIC_BY_SUBJECT.keys()) {
			expect(known.has(subjectId), `“${subjectId}” dersi içerikte yok`).toBe(
				true,
			);
		}
	});

	it("ücretsiz konu dersin gerçekten İLK konusudur ve özeti vardır", async () => {
		const manifest = await loadManifest();

		for (const subject of manifest.subjects) {
			const slug = FREE_TOPIC_BY_SUBJECT.get(subject.id);
			const topic = subject.topics.find((t) => t.slug === slug);
			expect(topic, `“${subject.id}/${slug}” konusu bulunamadı`).toBeDefined();
			if (!topic) continue;

			// Ürün kararı "her dersin ilk konusu"dur; harita elle yazıldığı için
			// sıra değişince sessizce ortadaki bir konu ücretsiz kalabilirdi.
			const first = [...subject.topics].sort((a, b) => a.order - b.order)[0];
			expect(
				topic.slug,
				`“${subject.id}” dersinin ilk konusu “${first?.slug}” ama harita “${topic.slug}” diyor`,
			).toBe(first?.slug);

			expect(topic.questionCount).toBeGreaterThan(0);
			expect(topic.hasSummary).toBe(true);
		}
	});

	it("her ücretsiz konuda ilk test seti gerçekten üretilir", async () => {
		for (const [subjectId, topicSlug] of FREE_TOPIC_BY_SUBJECT) {
			const raw = JSON.parse(
				await readFile(
					path.join(CONTENT_ROOT, "questions", subjectId, `${topicSlug}.json`),
					"utf8",
				),
			);
			const questions = questionSchema.array().parse(raw);
			const sets = buildTestSets(questions, `${subjectId}/${topicSlug}`);

			expect(
				sets.some((set) => set.slug === FREE_TEST_SLUG),
				`“${subjectId}/${topicSlug}” için “${FREE_TEST_SLUG}” üretilmedi`,
			).toBe(true);
		}
	});
});

describe("yayımlanmış sorular", () => {
	it("hepsi 'published' durumundadır", async () => {
		const questions = await loadAllQuestions();
		expect(questions.every((q) => q.status === "published")).toBe(true);
	});

	it("kimlikler benzersizdir", async () => {
		const questions = await loadAllQuestions();
		const ids = questions.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("her sorunun mevzuat dayanağı vardır", async () => {
		// Farklılaşma tezi (PROJECT_PLAN.md §4, taahhüt 1): referanssız soru olamaz.
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(question.legalRef.law.length).toBeGreaterThan(3);
		}
	});

	it("kaynağı doğrulanmamış hiçbir soru yayımlanmamıştır", async () => {
		// Telif kapısı (PROJECT_PLAN.md §14.1).
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(question.source.license).not.toBe("unknown");
		}
	});

	it("AI taslağı insan onayından geçmeden yayımlanmamıştır", async () => {
		const questions = await loadAllQuestions();
		expect(questions.some((q) => q.source.kind === "ai-draft")).toBe(false);
	});

	it("şıklar birbirinden farklıdır ve doğru cevap geçerlidir", async () => {
		const questions = await loadAllQuestions();
		for (const question of questions) {
			// Şık sayısı 4 veya 5 olabilir; hepsi birbirinden farklı olmalı.
			expect(new Set(question.options.map((o) => o.trim())).size).toBe(
				question.options.length,
			);
			expect(question.correctIndex).toBeLessThan(question.options.length);
			expect(question.options[question.correctIndex]).toBeTruthy();
		}
	});

	it("her sorunun açıklaması vardır", async () => {
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(question.explanation.length).toBeGreaterThanOrEqual(20);
		}
	});
});

describe("questionSchema — şık sayısı kuralları", () => {
	const base = {
		id: "test-soru",
		subjectId: "657-dmk",
		topicId: "657-dmk/temel-ilkeler",
		difficulty: "kolay",
		stem: "Yeterince uzun bir soru gövdesi metni buraya gelir?",
		explanation: "Yeterince uzun bir açıklama metni buraya yazılır.",
		legalRef: { law: "657 sayılı Devlet Memurları Kanunu" },
		source: { kind: "original", origin: "Deneme kaynağı", license: "own-work" },
		status: "published",
		updatedAt: "2026-07-25",
	};

	it("5 şıklı ve correctIndex 4 olan soruyu kabul eder", () => {
		const result = questionSchema.safeParse({
			...base,
			options: ["A", "B", "C", "D", "E"],
			correctIndex: 4,
		});
		expect(result.success).toBe(true);
	});

	it("4 şıklı soruyu (mevcut içerik) kabul eder", () => {
		const result = questionSchema.safeParse({
			...base,
			options: ["A", "B", "C", "D"],
			correctIndex: 3,
		});
		expect(result.success).toBe(true);
	});

	it("correctIndex şık sayısını aşarsa reddeder", () => {
		// 4 şıklı soruda correctIndex 4 (5. şık) sessiz bir hatadır.
		const result = questionSchema.safeParse({
			...base,
			options: ["A", "B", "C", "D"],
			correctIndex: 4,
		});
		expect(result.success).toBe(false);
	});

	it("3 şıktan az soruyu reddeder", () => {
		const result = questionSchema.safeParse({
			...base,
			options: ["A", "B", "C"],
			correctIndex: 0,
		});
		expect(result.success).toBe(false);
	});

	it("6 şıktan fazla soruyu reddeder", () => {
		const result = questionSchema.safeParse({
			...base,
			options: ["A", "B", "C", "D", "E", "F"],
			correctIndex: 0,
		});
		expect(result.success).toBe(false);
	});
});
