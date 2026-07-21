import type { Question } from "@/types/content";
import type { AnswerIndex, ExamResult, SubjectBreakdown } from "@/types/progress";
import { computeScore } from "./test-result";

/**
 * Deneme sınavı sonucu — saf fonksiyon.
 *
 * Konu testi sonucundan farkı, ders bazlı dağılım ve zayıf konu tespiti
 * üretmesidir: sınav sonrası kullanıcıya "nereye çalışmalıyım" cevabını veren
 * asıl çıktı budur (PROJECT_PLAN.md §11, ekran 10).
 */

export interface ExamAnsweredQuestion {
	question: Question;
	selectedIndex: AnswerIndex | null;
}

/** Bir konunun zayıf sayılması için gereken en az soru sayısı. */
const MIN_QUESTIONS_FOR_WEAKNESS = 2;

/** Bu doğruluk oranının altındaki konular zayıf kabul edilir. */
const WEAK_ACCURACY_THRESHOLD = 0.6;

export function computeExamResult(
	answered: readonly ExamAnsweredQuestion[],
	durationMs: number,
	passingScore: number,
	subjectNames: Readonly<Record<string, string>>,
): ExamResult {
	let correct = 0;
	let wrong = 0;
	let empty = 0;
	const wrongQuestionIds: string[] = [];

	const bySubjectMap = new Map<string, SubjectBreakdown>();
	const byTopic = new Map<string, { correct: number; total: number }>();

	for (const { question, selectedIndex } of answered) {
		const subject =
			bySubjectMap.get(question.subjectId) ??
			({
				subjectId: question.subjectId,
				subjectName: subjectNames[question.subjectId] ?? question.subjectId,
				correct: 0,
				wrong: 0,
				empty: 0,
				total: 0,
				accuracy: 0,
			} satisfies SubjectBreakdown);

		const topic = byTopic.get(question.topicId) ?? { correct: 0, total: 0 };

		subject.total += 1;
		topic.total += 1;

		if (selectedIndex === null) {
			empty += 1;
			subject.empty += 1;
			wrongQuestionIds.push(question.id);
		} else if (selectedIndex === question.correctIndex) {
			correct += 1;
			subject.correct += 1;
			topic.correct += 1;
		} else {
			wrong += 1;
			subject.wrong += 1;
			wrongQuestionIds.push(question.id);
		}

		bySubjectMap.set(question.subjectId, subject);
		byTopic.set(question.topicId, topic);
	}

	const bySubject = [...bySubjectMap.values()].map((subject) => ({
		...subject,
		accuracy: subject.total > 0 ? subject.correct / subject.total : 0,
	}));

	// Zayıf konular: yeterli soru görmüş ve eşiğin altında kalanlar, zayıftan güçlüye.
	const weakTopicIds = [...byTopic.entries()]
		.filter(
			([, stat]) =>
				stat.total >= MIN_QUESTIONS_FOR_WEAKNESS &&
				stat.correct / stat.total < WEAK_ACCURACY_THRESHOLD,
		)
		.sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
		.map(([topicId]) => topicId);

	const total = answered.length;
	const score = computeScore(correct, total);

	return {
		total,
		correct,
		wrong,
		empty,
		score,
		passed: score >= passingScore,
		durationMs,
		bySubject,
		weakTopicIds,
		wrongQuestionIds,
	};
}

/** 4530 → "1:15:30" · 930 → "15:30" */
export function formatDuration(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const seconds = safe % 60;
	const pad = (n: number) => String(n).padStart(2, "0");

	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${minutes}:${pad(seconds)}`;
}
