import { describe, expect, it } from "vitest";
import { computeExamResult, formatDuration } from "@/lib/scoring/exam-result";
import { buildExam, isTemplateSolvable } from "@/lib/selector/exam-selector";
import type { MockExamTemplate, Question } from "@/types/content";
import type { AnswerIndex } from "@/types/progress";

function makeQuestion(
	id: string,
	subjectId: string,
	topicId: string,
	correctIndex: AnswerIndex = 0,
): Question {
	return {
		id,
		subjectId,
		topicId,
		scope: "ortak",
		difficulty: "orta",
		stem: `Örnek soru kökü ${id}`,
		options: ["A", "B", "C", "D"],
		correctIndex,
		explanation: "Bu bir test açıklamasıdır ve yeterince uzundur.",
		legalRef: { law: "657 sayılı Devlet Memurları Kanunu" },
		source: { kind: "original", origin: "test", license: "own-work" },
		status: "published",
		tags: [],
		version: 1,
		updatedAt: "2026-07-21",
	};
}

const pool: Question[] = [
	...Array.from({ length: 12 }, (_, i) =>
		makeQuestion(`d${i}`, "657-dmk", "657-dmk/disiplin"),
	),
	...Array.from({ length: 10 }, (_, i) =>
		makeQuestion(`a${i}`, "anayasa", "anayasa/genel"),
	),
	...Array.from({ length: 8 }, (_, i) =>
		makeQuestion(`e${i}`, "etik", "etik/ilkeler"),
	),
];

const template: MockExamTemplate = {
	id: "test-20",
	name: "Test Denemesi",
	examKind: "gorevde-yukselme",
	questionCount: 20,
	durationSeconds: 1800,
	passingScore: 60,
	negativeMarking: false,
	distribution: [
		{ subjectId: "657-dmk", count: 10 },
		{ subjectId: "anayasa", count: 6 },
		{ subjectId: "etik", count: 4 },
	],
};

const SUBJECT_NAMES = {
	"657-dmk": "657 Sayılı Devlet Memurları Kanunu",
	anayasa: "Türkiye Cumhuriyeti Anayasası",
	etik: "Etik Davranış İlkeleri",
};

describe("buildExam", () => {
	it("şablondaki ders dağılımına birebir uyar", () => {
		const { questions, shortfalls } = buildExam(template, pool, "tohum");

		expect(shortfalls).toEqual([]);
		expect(questions).toHaveLength(20);
		expect(questions.filter((q) => q.subjectId === "657-dmk")).toHaveLength(10);
		expect(questions.filter((q) => q.subjectId === "anayasa")).toHaveLength(6);
		expect(questions.filter((q) => q.subjectId === "etik")).toHaveLength(4);
	});

	it("aynı tohumla aynı sınavı üretir", () => {
		const a = buildExam(template, pool, "sabit").questions.map((q) => q.id);
		const b = buildExam(template, pool, "sabit").questions.map((q) => q.id);
		expect(a).toEqual(b);
	});

	it("aynı soruyu iki kez koymaz", () => {
		const { questions } = buildExam(template, pool, "tohum");
		expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
	});

	it("dersleri blok blok değil karışık sıralar", () => {
		const { questions } = buildExam(template, pool, "tohum");
		const subjectOrder = questions.map((q) => q.subjectId);
		const blockOrder = [
			...Array<string>(10).fill("657-dmk"),
			...Array<string>(6).fill("anayasa"),
			...Array<string>(4).fill("etik"),
		];
		expect(subjectOrder).not.toEqual(blockOrder);
	});

	it("havuz yetmiyorsa eksiği bildirir ve başka dersten doldurmaz", () => {
		// Etik havuzunu 4'ün altına düşür.
		const eksikHavuz = pool.filter(
			(q) => q.subjectId !== "etik" || Number(q.id.slice(1)) < 2,
		);
		const { questions, shortfalls } = buildExam(template, eksikHavuz, "t");

		expect(shortfalls).toEqual([
			{ subjectId: "etik", requested: 4, available: 2 },
		]);
		// Eksik ders sessizce başka dersten tamamlanmaz.
		expect(questions.filter((q) => q.subjectId === "etik")).toHaveLength(2);
		expect(questions).toHaveLength(18);
	});

	it("yayımlanmamış soruları havuza almaz", () => {
		const taslakli: Question[] = [
			...pool,
			{ ...makeQuestion("taslak", "etik", "etik/ilkeler"), status: "draft" },
		];
		const { questions } = buildExam(template, taslakli, "t");
		expect(questions.some((q) => q.id === "taslak")).toBe(false);
	});
});

describe("isTemplateSolvable", () => {
	it("havuz yeterliyse true, değilse false döner", () => {
		expect(isTemplateSolvable(template, pool)).toBe(true);
		expect(isTemplateSolvable(template, pool.slice(0, 5))).toBe(false);
	});
});

describe("computeExamResult", () => {
	const questions = buildExam(template, pool, "tohum").questions;

	function answerAll(
		pick: (q: Question, index: number) => AnswerIndex | null,
	) {
		return questions.map((question, index) => ({
			question,
			selectedIndex: pick(question, index),
		}));
	}

	it("tamamı doğruda 100 puan ve başarılı verir", () => {
		const result = computeExamResult(
			answerAll((q) => q.correctIndex),
			600_000,
			60,
			SUBJECT_NAMES,
		);

		expect(result.score).toBe(100);
		expect(result.passed).toBe(true);
		expect(result.correct).toBe(20);
	});

	it("başarı eşiğini tam karşılayan puan başarılı sayılır", () => {
		// 20 sorunun 12'si doğru = 60 puan, eşik 60.
		const result = computeExamResult(
			answerAll((q, i) => (i < 12 ? q.correctIndex : 1)),
			600_000,
			60,
			SUBJECT_NAMES,
		);

		expect(result.score).toBe(60);
		expect(result.passed).toBe(true);
	});

	it("boş bırakmak yanlış yapmakla aynı puanı verir", () => {
		const yanlis = computeExamResult(
			answerAll((q, i) => (i < 10 ? q.correctIndex : 1)),
			1000,
			60,
			SUBJECT_NAMES,
		);
		const bos = computeExamResult(
			answerAll((q, i) => (i < 10 ? q.correctIndex : null)),
			1000,
			60,
			SUBJECT_NAMES,
		);

		expect(yanlis.score).toBe(bos.score);
		expect(yanlis.wrong).toBe(10);
		expect(bos.empty).toBe(10);
	});

	it("ders bazlı dağılımı doğru üretir ve toplamları tutar", () => {
		const result = computeExamResult(
			answerAll((q) => q.correctIndex),
			1000,
			60,
			SUBJECT_NAMES,
		);

		const toplam = result.bySubject.reduce((sum, s) => sum + s.total, 0);
		expect(toplam).toBe(20);
		expect(result.bySubject).toHaveLength(3);

		const dmk = result.bySubject.find((s) => s.subjectId === "657-dmk");
		expect(dmk?.total).toBe(10);
		expect(dmk?.subjectName).toBe("657 Sayılı Devlet Memurları Kanunu");
		expect(dmk?.accuracy).toBe(1);
	});

	it("zayıf konuları en zayıftan sıralar", () => {
		// Anayasa sorularının tamamı yanlış, diğerleri doğru.
		const result = computeExamResult(
			answerAll((q) => (q.subjectId === "anayasa" ? 1 : q.correctIndex)),
			1000,
			60,
			SUBJECT_NAMES,
		);

		expect(result.weakTopicIds[0]).toBe("anayasa/genel");
		expect(result.weakTopicIds).not.toContain("657-dmk/disiplin");
	});

	it("yanlış ve boşları birlikte tekrar listesine koyar", () => {
		const result = computeExamResult(
			answerAll((q, i) => (i === 0 ? 1 : i === 1 ? null : q.correctIndex)),
			1000,
			60,
			SUBJECT_NAMES,
		);
		expect(result.wrongQuestionIds).toHaveLength(2);
	});
});

describe("formatDuration", () => {
	it("bir saatin altını dakika:saniye olarak biçimler", () => {
		expect(formatDuration(930)).toBe("15:30");
		expect(formatDuration(59)).toBe("0:59");
	});

	it("bir saat ve üstünü saat:dakika:saniye olarak biçimler", () => {
		expect(formatDuration(4530)).toBe("1:15:30");
		expect(formatDuration(7200)).toBe("2:00:00");
	});

	it("negatif değerde sıfırlar — süre bittiğinde eksi göstermez", () => {
		expect(formatDuration(-5)).toBe("0:00");
	});
});
