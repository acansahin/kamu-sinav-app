import { describe, expect, it } from "vitest";
import { mergeBundles } from "@/lib/sync/merge";
import type {
	ExportBundle,
	QuestionAttempt,
	TopicProgress,
} from "@/types/progress";

/**
 * "Son yazan kazanır" birleştirmesi.
 *
 * Bu testler iki cihaz senaryosunun tamamını kapsar: her iki tarafta da olan
 * satır, yalnızca bir tarafta olan satır, çakışan güncellemeler. Amaç, hiçbir
 * durumda veri kaybolmadığını ve kazananın her zaman daha yeni `updatedAt`
 * olduğunu kanıtlamak.
 */

function attempt(id: string, createdAt: string): QuestionAttempt {
	return {
		id,
		userId: "u1",
		questionId: `q-${id}`,
		subjectId: "657-dmk",
		topicId: "657-dmk/yasaklar",
		difficulty: "orta",
		selectedIndex: 1,
		isCorrect: true,
		durationMs: 10_000,
		context: "practice",
		sessionId: "s1",
		createdAt,
	};
}

function progress(topicId: string, updatedAt: string, mastery: number): TopicProgress {
	return {
		userId: "u1",
		topicId,
		subjectId: "657-dmk",
		summaryRead: false,
		questionsAttempted: 1,
		questionsCorrect: 1,
		masteryScore: mastery,
		updatedAt,
	};
}

function bundle(overrides: Partial<ExportBundle> = {}): ExportBundle {
	return {
		version: 1,
		exportedAt: "2026-07-23T10:00:00.000Z",
		attempts: [],
		topicProgress: [],
		testSessions: [],
		examSessions: [],
		reports: [],
		settings: null,
		dailyStats: [],
		bookmarks: [],
		reviewSchedule: [],
		...overrides,
	};
}

describe("mergeBundles — attempts (append-only)", () => {
	it("iki tarafın birleşimini alır, id ile tekilleştirir", () => {
		const local = bundle({
			attempts: [attempt("a1", "2026-07-23T09:00:00Z"), attempt("a2", "2026-07-23T09:05:00Z")],
		});
		const server = bundle({
			attempts: [attempt("a2", "2026-07-23T09:05:00Z"), attempt("a3", "2026-07-23T09:10:00Z")],
		});

		const merged = mergeBundles(local, server);
		expect(merged.attempts.map((a) => a.id).sort()).toEqual(["a1", "a2", "a3"]);
	});

	it("yalnızca sunucuda olan denemeyi kaybetmez", () => {
		const local = bundle({ attempts: [attempt("a1", "2026-07-23T09:00:00Z")] });
		const server = bundle({ attempts: [attempt("a9", "2026-07-23T09:00:00Z")] });

		const merged = mergeBundles(local, server);
		expect(merged.attempts.map((a) => a.id).sort()).toEqual(["a1", "a9"]);
	});
});

describe("mergeBundles — son yazan kazanır", () => {
	it("sunucu daha yeniyse sunucu kazanır", () => {
		const local = bundle({
			topicProgress: [progress("t1", "2026-07-23T09:00:00Z", 50)],
		});
		const server = bundle({
			topicProgress: [progress("t1", "2026-07-23T10:00:00Z", 80)],
		});

		const merged = mergeBundles(local, server);
		expect(merged.topicProgress).toHaveLength(1);
		expect(merged.topicProgress[0]?.masteryScore).toBe(80);
	});

	it("yerel daha yeniyse yerel kazanır", () => {
		const local = bundle({
			topicProgress: [progress("t1", "2026-07-23T11:00:00Z", 90)],
		});
		const server = bundle({
			topicProgress: [progress("t1", "2026-07-23T10:00:00Z", 80)],
		});

		const merged = mergeBundles(local, server);
		expect(merged.topicProgress[0]?.masteryScore).toBe(90);
	});

	it("zaman damgası eşitse yereli korur (gereksiz yazma yok)", () => {
		const local = bundle({
			topicProgress: [progress("t1", "2026-07-23T10:00:00Z", 90)],
		});
		const server = bundle({
			topicProgress: [progress("t1", "2026-07-23T10:00:00Z", 80)],
		});

		const merged = mergeBundles(local, server);
		expect(merged.topicProgress[0]?.masteryScore).toBe(90);
	});

	it("iki tarafta da farklı konular varsa ikisini de tutar", () => {
		const local = bundle({
			topicProgress: [progress("t1", "2026-07-23T10:00:00Z", 90)],
		});
		const server = bundle({
			topicProgress: [progress("t2", "2026-07-23T10:00:00Z", 70)],
		});

		const merged = mergeBundles(local, server);
		expect(merged.topicProgress.map((p) => p.topicId).sort()).toEqual(["t1", "t2"]);
	});
});

describe("mergeBundles — settings", () => {
	const base = { userId: "u1", dailyGoalQuestions: 20, instantFeedback: true };

	it("daha yeni ayarı seçer", () => {
		const local = bundle({
			settings: { ...base, dailyGoalQuestions: 20, updatedAt: "2026-07-23T09:00:00Z" },
		});
		const server = bundle({
			settings: { ...base, dailyGoalQuestions: 50, updatedAt: "2026-07-23T10:00:00Z" },
		});

		const merged = mergeBundles(local, server);
		expect(merged.settings?.dailyGoalQuestions).toBe(50);
	});

	it("bir taraf boşsa dolu olanı alır", () => {
		const withSettings = bundle({
			settings: { ...base, updatedAt: "2026-07-23T09:00:00Z" },
		});
		const empty = bundle();

		expect(mergeBundles(empty, withSettings).settings?.userId).toBe("u1");
		expect(mergeBundles(withSettings, empty).settings?.userId).toBe("u1");
		expect(mergeBundles(empty, empty).settings).toBeNull();
	});
});

describe("mergeBundles — birleşim dışı tablolar", () => {
	it("dailyStats, reviewSchedule ve bookmarks yereli olduğu gibi korur", () => {
		// Bunlar sunucudan gelmez; sunucu tarafı boş olsa bile yerel kalmalı.
		const local = bundle({
			dailyStats: [
				{
					userId: "u1",
					date: "2026-07-23",
					questionsAnswered: 5,
					correctAnswers: 4,
					studySeconds: 60,
					topicsCompleted: 0,
				},
			],
			bookmarks: [
				{ userId: "u1", refType: "topic", refId: "t1", createdAt: "2026-07-23T08:00:00Z" },
			],
			reviewSchedule: [
				{
					userId: "u1",
					questionId: "q1",
					subjectId: "657-dmk",
					topicId: "t1",
					easeFactor: 2.5,
					intervalDays: 1,
					repetitions: 1,
					lapses: 0,
					dueAt: "2026-07-24T00:00:00Z",
					lastGrade: 5,
					updatedAt: "2026-07-23T09:00:00Z",
				},
			],
		});

		const merged = mergeBundles(local, bundle());
		expect(merged.dailyStats).toHaveLength(1);
		expect(merged.bookmarks).toHaveLength(1);
		expect(merged.reviewSchedule).toHaveLength(1);
	});
});
