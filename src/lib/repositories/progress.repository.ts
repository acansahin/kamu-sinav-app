import { getDb } from "@/lib/db/database";
import { computeMastery } from "@/lib/scoring/mastery";
import type { Difficulty } from "@/types/content";
import {
	type AnswerIndex,
	type AttemptContext,
	type Bookmark,
	type DailyStat,
	type ExamResult,
	type ExamSession,
	LOCAL_USER_ID,
	type QuestionAttempt,
	type StudySettings,
	type TestSession,
	type TopicProgress,
} from "@/types/progress";

/**
 * İlerleme verisi erişim sözleşmesi.
 *
 * UI ve özellik katmanı Dexie'yi asla doğrudan görmez; her şey buradan geçer.
 * Faz 3'te sunucu geldiğinde yalnızca bu arayüzün ikinci bir implementasyonu
 * yazılır — çağıran hiçbir bileşen değişmez (bkz. PROJECT_PLAN.md §7.2).
 */
export interface IProgressRepository {
	recordAttempt(input: RecordAttemptInput): Promise<void>;
	recordAttempts(inputs: readonly RecordAttemptInput[]): Promise<void>;
	getTopicProgress(topicId: string): Promise<TopicProgress | null>;
	getAllTopicProgress(): Promise<TopicProgress[]>;
	markSummaryRead(subjectId: string, topicId: string): Promise<void>;
	createTestSession(session: TestSession): Promise<void>;
	getTestSession(sessionId: string): Promise<TestSession | null>;
	completeTestSession(
		sessionId: string,
		answers: Record<string, AnswerIndex | null>,
		score: number,
	): Promise<void>;
	getRecentTestSessions(limit: number): Promise<TestSession[]>;
	createExamSession(session: ExamSession): Promise<void>;
	/** Yarıda kalmış sınav varsa döner — çökme sonrası kurtarma için. */
	getResumableExamSession(): Promise<ExamSession | null>;
	/** Sınav sürerken durumu diske yazar; çökme sonrası kayıp bu aralıkla sınırlı kalır. */
	saveExamProgress(
		sessionId: string,
		patch: Pick<ExamSession, "answers" | "flagged" | "remainingSeconds">,
	): Promise<void>;
	completeExamSession(sessionId: string, result: ExamResult): Promise<void>;
	abandonExamSession(sessionId: string): Promise<void>;
	getRecentExamSessions(limit: number): Promise<ExamSession[]>;
	getSettings(): Promise<StudySettings>;
	saveSettings(patch: Partial<StudySettings>): Promise<void>;
	getDailyStats(days: number): Promise<DailyStat[]>;
	toggleBookmark(refType: Bookmark["refType"], refId: string): Promise<boolean>;
	isBookmarked(refType: Bookmark["refType"], refId: string): Promise<boolean>;
	exportAll(): Promise<ExportBundle>;
	importAll(bundle: ExportBundle): Promise<void>;
	clearAll(): Promise<void>;
}

export interface RecordAttemptInput {
	questionId: string;
	subjectId: string;
	topicId: string;
	difficulty: Difficulty;
	selectedIndex: AnswerIndex | null;
	isCorrect: boolean;
	durationMs: number;
	context: AttemptContext;
	sessionId: string;
}

export interface ExportBundle {
	version: 1;
	exportedAt: string;
	attempts: QuestionAttempt[];
	topicProgress: TopicProgress[];
	testSessions: TestSession[];
	dailyStats: DailyStat[];
	settings: StudySettings | null;
	bookmarks: Bookmark[];
}

const DEFAULT_SETTINGS: Omit<StudySettings, "updatedAt"> = {
	userId: LOCAL_USER_ID,
	dailyGoalQuestions: 20,
	instantFeedback: true,
};

/** "2026-07-21" — yerel saat dilimine göre gün anahtarı. */
function todayKey(now = new Date()): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function newId(): string {
	return globalThis.crypto.randomUUID();
}

class DexieProgressRepository implements IProgressRepository {
	private readonly userId = LOCAL_USER_ID;

	async recordAttempt(input: RecordAttemptInput): Promise<void> {
		await this.recordAttempts([input]);
	}

	/**
	 * Denemeleri günlüğe ekler ve türetilmiş tabloları tazeler.
	 *
	 * Tamamı tek transaction içindedir: günlük yazılıp ilerleme yazılmadan
	 * çökerse istatistikler günlükle tutarsız kalırdı.
	 */
	async recordAttempts(inputs: readonly RecordAttemptInput[]): Promise<void> {
		if (inputs.length === 0) return;

		const db = getDb();
		const now = new Date();
		const nowIso = now.toISOString();
		const date = todayKey(now);

		await db.transaction(
			"rw",
			[db.attempts, db.topicProgress, db.dailyStats],
			async () => {
				// 1. Append-only günlük
				await db.attempts.bulkAdd(
					inputs.map((input) => ({
						id: newId(),
						userId: this.userId,
						createdAt: nowIso,
						...input,
					})),
				);

				// 2. Etkilenen konuların ilerlemesini günlükten yeniden hesapla
				const touchedTopics = new Set(inputs.map((i) => i.topicId));
				for (const topicId of touchedTopics) {
					const attempts = await db.attempts
						.where("[userId+topicId]")
						.equals([this.userId, topicId])
						.sortBy("createdAt");

					const existing = await db.topicProgress.get([this.userId, topicId]);
					// Girdideki subjectId her zaman tazedir; kayıtlı değer yalnızca
					// yedektir (eski kayıtlarda boş kalmış olabilir).
					const subjectId =
						inputs.find((i) => i.topicId === topicId)?.subjectId ??
						existing?.subjectId ??
						"";

					await db.topicProgress.put({
						userId: this.userId,
						topicId,
						subjectId,
						summaryRead: existing?.summaryRead ?? false,
						summaryReadAt: existing?.summaryReadAt,
						questionsAttempted: attempts.length,
						questionsCorrect: attempts.filter((a) => a.isCorrect).length,
						masteryScore: computeMastery(attempts.map((a) => a.isCorrect)),
						updatedAt: nowIso,
					});
				}

				// 3. Günlük istatistik
				const stat = (await db.dailyStats.get([this.userId, date])) ?? {
					userId: this.userId,
					date,
					questionsAnswered: 0,
					correctAnswers: 0,
					studySeconds: 0,
					topicsCompleted: 0,
				};
				stat.questionsAnswered += inputs.length;
				stat.correctAnswers += inputs.filter((i) => i.isCorrect).length;
				stat.studySeconds += Math.round(
					inputs.reduce((sum, i) => sum + i.durationMs, 0) / 1000,
				);
				await db.dailyStats.put(stat);
			},
		);
	}

	async getTopicProgress(topicId: string): Promise<TopicProgress | null> {
		return (await getDb().topicProgress.get([this.userId, topicId])) ?? null;
	}

	async getAllTopicProgress(): Promise<TopicProgress[]> {
		return getDb().topicProgress.where("userId").equals(this.userId).toArray();
	}

	async markSummaryRead(subjectId: string, topicId: string): Promise<void> {
		const db = getDb();
		const nowIso = new Date().toISOString();
		const existing = await db.topicProgress.get([this.userId, topicId]);

		await db.topicProgress.put({
			questionsAttempted: 0,
			questionsCorrect: 0,
			masteryScore: 0,
			...existing,
			userId: this.userId,
			topicId,
			subjectId,
			summaryRead: true,
			summaryReadAt: existing?.summaryReadAt ?? nowIso,
			updatedAt: nowIso,
		});
	}

	async createTestSession(session: TestSession): Promise<void> {
		await getDb().testSessions.add(session);
	}

	async getTestSession(sessionId: string): Promise<TestSession | null> {
		return (await getDb().testSessions.get(sessionId)) ?? null;
	}

	async completeTestSession(
		sessionId: string,
		answers: Record<string, AnswerIndex | null>,
		score: number,
	): Promise<void> {
		await getDb().testSessions.update(sessionId, {
			answers,
			score,
			status: "completed",
			completedAt: new Date().toISOString(),
		});
	}

	async getRecentTestSessions(limit: number): Promise<TestSession[]> {
		const sessions = await getDb()
			.testSessions.where("userId")
			.equals(this.userId)
			.reverse()
			.sortBy("startedAt");
		return sessions.slice(0, limit);
	}

	async createExamSession(session: ExamSession): Promise<void> {
		await getDb().examSessions.add(session);
	}

	async getResumableExamSession(): Promise<ExamSession | null> {
		const open = await getDb()
			.examSessions.where("[userId+status]")
			.equals([this.userId, "in-progress"])
			.sortBy("startedAt");
		return open.at(-1) ?? null;
	}

	async saveExamProgress(
		sessionId: string,
		patch: Pick<ExamSession, "answers" | "flagged" | "remainingSeconds">,
	): Promise<void> {
		await getDb().examSessions.update(sessionId, patch);
	}

	async completeExamSession(
		sessionId: string,
		result: ExamResult,
	): Promise<void> {
		await getDb().examSessions.update(sessionId, {
			result,
			status: "completed",
			completedAt: new Date().toISOString(),
			remainingSeconds: 0,
		});
	}

	async abandonExamSession(sessionId: string): Promise<void> {
		await getDb().examSessions.update(sessionId, { status: "abandoned" });
	}

	async getRecentExamSessions(limit: number): Promise<ExamSession[]> {
		const sessions = await getDb()
			.examSessions.where("userId")
			.equals(this.userId)
			.reverse()
			.sortBy("startedAt");
		return sessions.filter((s) => s.status === "completed").slice(0, limit);
	}

	async getSettings(): Promise<StudySettings> {
		const stored = await getDb().settings.get(this.userId);
		return stored ?? { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
	}

	async saveSettings(patch: Partial<StudySettings>): Promise<void> {
		const current = await this.getSettings();
		await getDb().settings.put({
			...current,
			...patch,
			userId: this.userId,
			updatedAt: new Date().toISOString(),
		});
	}

	async getDailyStats(days: number): Promise<DailyStat[]> {
		const all = await getDb()
			.dailyStats.where("userId")
			.equals(this.userId)
			.sortBy("date");
		return all.slice(-days);
	}

	async toggleBookmark(
		refType: Bookmark["refType"],
		refId: string,
	): Promise<boolean> {
		const db = getDb();
		const key: [string, string, string] = [this.userId, refType, refId];
		const existing = await db.bookmarks.get(key);

		if (existing) {
			await db.bookmarks.delete(key);
			return false;
		}
		await db.bookmarks.add({
			userId: this.userId,
			refType,
			refId,
			createdAt: new Date().toISOString(),
		});
		return true;
	}

	async isBookmarked(
		refType: Bookmark["refType"],
		refId: string,
	): Promise<boolean> {
		return (
			(await getDb().bookmarks.get([this.userId, refType, refId])) !== undefined
		);
	}

	/** Veri taşınabilirliği sözü — bkz. PROJECT_PLAN.md §4, taahhüt 6. */
	async exportAll(): Promise<ExportBundle> {
		const db = getDb();
		const [attempts, topicProgress, testSessions, dailyStats, settings, bookmarks] =
			await Promise.all([
				db.attempts.where("userId").equals(this.userId).toArray(),
				db.topicProgress.where("userId").equals(this.userId).toArray(),
				db.testSessions.where("userId").equals(this.userId).toArray(),
				db.dailyStats.where("userId").equals(this.userId).toArray(),
				db.settings.get(this.userId),
				db.bookmarks.where("userId").equals(this.userId).toArray(),
			]);

		return {
			version: 1,
			exportedAt: new Date().toISOString(),
			attempts,
			topicProgress,
			testSessions,
			dailyStats,
			settings: settings ?? null,
			bookmarks,
		};
	}

	async importAll(bundle: ExportBundle): Promise<void> {
		const db = getDb();
		await db.transaction(
			"rw",
			[
				db.attempts,
				db.topicProgress,
				db.testSessions,
				db.dailyStats,
				db.settings,
				db.bookmarks,
			],
			async () => {
				await db.attempts.bulkPut(bundle.attempts);
				await db.topicProgress.bulkPut(bundle.topicProgress);
				await db.testSessions.bulkPut(bundle.testSessions);
				await db.dailyStats.bulkPut(bundle.dailyStats);
				await db.bookmarks.bulkPut(bundle.bookmarks);
				if (bundle.settings) await db.settings.put(bundle.settings);
			},
		);
	}

	async clearAll(): Promise<void> {
		const db = getDb();
		await db.transaction(
			"rw",
			[
				db.attempts,
				db.topicProgress,
				db.testSessions,
				db.dailyStats,
				db.settings,
				db.bookmarks,
				db.reports,
			],
			async () => {
				await Promise.all([
					db.attempts.clear(),
					db.topicProgress.clear(),
					db.testSessions.clear(),
					db.dailyStats.clear(),
					db.settings.clear(),
					db.bookmarks.clear(),
					db.reports.clear(),
				]);
			},
		);
	}
}

export const progressRepository: IProgressRepository =
	new DexieProgressRepository();
