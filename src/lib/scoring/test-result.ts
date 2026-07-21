import type { Question } from "@/types/content";
import type { AnswerIndex, TestResult } from "@/types/progress";

/**
 * Puanlama — saf fonksiyonlar.
 *
 * Bir sınav uygulamasında yanlış puan hesabı ürünü bitiren hatadır; bu yüzden
 * bu modül React'ten ve veritabanından tamamen bağımsız tutulur ve yoğun test
 * edilir (tests/unit/test-result.test.ts).
 *
 * Mevzuat kuralı: yanlış cevap doğruyu GÖTÜRMEZ. Boş ve yanlış aynı şekilde
 * puansızdır — bkz. PROJECT_PLAN.md §5.1.
 */

export interface AnsweredQuestion {
	question: Question;
	selectedIndex: AnswerIndex | null;
}

/** Tek bir cevabın doğru olup olmadığı. Boş bırakılan cevap doğru sayılmaz. */
export function isAnswerCorrect(
	question: Question,
	selectedIndex: AnswerIndex | null,
): boolean {
	return selectedIndex !== null && selectedIndex === question.correctIndex;
}

/**
 * 100 üzerinden puan. Yanlış doğruyu götürmediği için puan doğrudan
 * doğru/toplam oranıdır.
 */
export function computeScore(correct: number, total: number): number {
	if (total <= 0) return 0;
	return Math.round((correct / total) * 1000) / 10;
}

export function computeTestResult(
	sessionId: string,
	answered: readonly AnsweredQuestion[],
	durationMs: number,
): TestResult {
	let correct = 0;
	let wrong = 0;
	let empty = 0;
	const wrongQuestionIds: string[] = [];

	for (const { question, selectedIndex } of answered) {
		if (selectedIndex === null) {
			empty += 1;
			wrongQuestionIds.push(question.id);
		} else if (selectedIndex === question.correctIndex) {
			correct += 1;
		} else {
			wrong += 1;
			wrongQuestionIds.push(question.id);
		}
	}

	const total = answered.length;
	return {
		sessionId,
		total,
		correct,
		wrong,
		empty,
		score: computeScore(correct, total),
		accuracy: total > 0 ? correct / total : 0,
		durationMs,
		wrongQuestionIds,
	};
}

/** Sınav mevzuatındaki başarı eşiği: 100 üzerinden 60. */
export const PASSING_SCORE = 60;

export function isPassing(score: number, passingScore = PASSING_SCORE): boolean {
	return score >= passingScore;
}
