import { describe, expect, it } from "vitest";
import {
	computeScore,
	computeTestResult,
	isAnswerCorrect,
	isPassing,
} from "@/lib/scoring/test-result";
import type { Question } from "@/types/content";
import type { AnswerIndex } from "@/types/progress";

function makeQuestion(id: string, correctIndex: 0 | 1 | 2 | 3): Question {
	return {
		id,
		subjectId: "657-dmk",
		topicId: "657-dmk/disiplin-cezalari",
		scope: "ortak",
		difficulty: "orta",
		stem: `Örnek soru kökü ${id}`,
		options: ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı"],
		correctIndex,
		explanation: "Bu bir test açıklamasıdır ve yeterince uzundur.",
		legalRef: { law: "657 sayılı Devlet Memurları Kanunu", article: "125" },
		source: { kind: "original", origin: "test", license: "own-work" },
		status: "published",
		tags: [],
		version: 1,
		updatedAt: "2026-07-21",
	};
}

function answer(
	question: Question,
	selectedIndex: AnswerIndex | null,
): { question: Question; selectedIndex: AnswerIndex | null } {
	return { question, selectedIndex };
}

describe("isAnswerCorrect", () => {
	it("boş bırakılan cevabı doğru saymaz", () => {
		expect(isAnswerCorrect(makeQuestion("q1", 0), null)).toBe(false);
	});

	it("0 indeksli doğru cevabı tanır", () => {
		// 0 falsy olduğu için burada bir tipik hata sınıfı gizlenir.
		expect(isAnswerCorrect(makeQuestion("q1", 0), 0)).toBe(true);
	});
});

describe("computeScore", () => {
	it("boş testte sıfırdır ve bölme hatası vermez", () => {
		expect(computeScore(0, 0)).toBe(0);
	});

	it("tam doğruda 100 verir", () => {
		expect(computeScore(20, 20)).toBe(100);
	});

	it("ondalığı tek basamağa yuvarlar", () => {
		expect(computeScore(1, 3)).toBe(33.3);
	});
});

describe("computeTestResult", () => {
	it("doğru, yanlış ve boşu ayrı ayrı sayar", () => {
		const result = computeTestResult(
			"oturum-1",
			[
				answer(makeQuestion("q1", 0), 0), // doğru
				answer(makeQuestion("q2", 1), 3), // yanlış
				answer(makeQuestion("q3", 2), null), // boş
				answer(makeQuestion("q4", 3), 3), // doğru
			],
			60_000,
		);

		expect(result.correct).toBe(2);
		expect(result.wrong).toBe(1);
		expect(result.empty).toBe(1);
		expect(result.total).toBe(4);
	});

	it("yanlış cevap doğruyu götürmez — puan yalnızca doğru oranıdır", () => {
		// Mevzuat kuralı (PROJECT_PLAN.md §5.1): negatif puanlama yoktur.
		const hepsiYanlis = computeTestResult(
			"a",
			[
				answer(makeQuestion("q1", 0), 1),
				answer(makeQuestion("q2", 0), 1),
				answer(makeQuestion("q3", 0), 0),
			],
			1000,
		);
		const biriBos = computeTestResult(
			"b",
			[
				answer(makeQuestion("q1", 0), null),
				answer(makeQuestion("q2", 0), null),
				answer(makeQuestion("q3", 0), 0),
			],
			1000,
		);

		// Üç soruda bir doğru: yanlış yapmak ile boş bırakmak aynı puanı verir.
		expect(hepsiYanlis.score).toBe(biriBos.score);
		expect(hepsiYanlis.score).toBe(33.3);
	});

	it("yanlış ve boş soruları birlikte tekrar listesine koyar", () => {
		const result = computeTestResult(
			"oturum-1",
			[
				answer(makeQuestion("dogru", 0), 0),
				answer(makeQuestion("yanlis", 1), 2),
				answer(makeQuestion("bos", 2), null),
			],
			1000,
		);

		expect(result.wrongQuestionIds).toEqual(["yanlis", "bos"]);
	});

	it("boş testte çökmez", () => {
		const result = computeTestResult("bos-oturum", [], 0);
		expect(result.score).toBe(0);
		expect(result.accuracy).toBe(0);
	});
});

describe("isPassing", () => {
	it("60 puan başarılıdır, 59.9 değildir", () => {
		expect(isPassing(60)).toBe(true);
		expect(isPassing(59.9)).toBe(false);
	});
});
