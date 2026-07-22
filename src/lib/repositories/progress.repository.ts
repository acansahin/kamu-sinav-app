import { getDb } from "@/lib/db/database";
import { computeMastery } from "@/lib/scoring/mastery";
import { computeStreak, dayKey } from "@/lib/scoring/streak";
import {
	dueDateFrom,
	gradeFromAttempt,
	scheduler,
} from "@/lib/scheduler/sm2";
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
	type QuestionReport,
	type ReviewSchedule,
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
	/** Vadesi gelmiş tekrarlar, en gecikmişten başlayarak. */
	getDueReviews(limit: number): Promise<ReviewSchedule[]>;
	getReviewSummary(): Promise<ReviewSummary>;
	/**
	 * Son denemesi yanlış olan sorular, en yeniden eskiye.
	 *
	 * Zamanlayıcıdan bağımsızdır: SM-2'nin en kısa aralığı bir gün olduğu için
	 * az önce yanlış yapılan soru "bugün vadesi gelenler" listesinde çıkmaz.
	 * Kullanıcı ise hatalarını hemen çözmek ister; bu iki ihtiyaç ayrı.
	 */
	getRecentMistakes(limit: number): Promise<QuestionAttempt[]>;
	/** En çok unutulan sorular — "zorlandıkların" listesi için. */
	getStrugglingReviews(limit: number): Promise<ReviewSchedule[]>;
	saveReport(report: Omit<QuestionReport, "id" | "userId" | "createdAt">): Promise<void>;
	getReports(): Promise<QuestionReport[]>;
	getStatistics(activityDays: number): Promise<StatisticsSnapshot>;
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

export interface ReviewSummary {
	/** Bugün vadesi gelen tekrar sayısı. */
	due: number;
	/** Takip edilen toplam soru sayısı. */
	tracked: number;
	/** En az bir kez unutulmuş soru sayısı. */
	struggling: number;
	/** Bir sonraki tekrarın tarihi; kuyruk boşsa null. */
	nextDueAt: string | null;
}

export interface CountPair {
	correct: number;
	total: number;
}

export interface StatisticsSnapshot {
	totalAttempts: number;
	totalCorrect: number;
	streakDays: number;
	bySubject: (CountPair & { subjectId: string })[];
	byDifficulty: (CountPair & { difficulty: Difficulty })[];
	byContext: (CountPair & { context: AttemptContext })[];
	/** Son N günün aktivitesi, eskiden yeniye; boş günler de dâhil. */
	activity: { date: string; answered: number; correct: number }[];
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
	examSessions: ExamSession[];
	reviewSchedule: ReviewSchedule[];
	reports: QuestionReport[];
}

const DEFAULT_SETTINGS: Omit<StudySettings, "updatedAt"> = {
	userId: LOCAL_USER_ID,
	dailyGoalQuestions: 20,
	instantFeedback: true,
};

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
		const date = dayKey(now);

		await db.transaction(
			"rw",
			[db.attempts, db.topicProgress, db.dailyStats, db.reviewSchedule],
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

				// 3. Aralıklı tekrar planı — her cevap kuyruğu besler.
				//    Doğru bilinenler uzun aralığa itilir, yanlışlar yarına döner.
				for (const input of inputs) {
					const key: [string, string] = [this.userId, input.questionId];
					const existing = await db.reviewSchedule.get(key);
					const state = existing ?? scheduler.initial();
					const grade = gradeFromAttempt(
						input.isCorrect,
						input.selectedIndex,
						input.durationMs,
					);
					const nextState = scheduler.next(state, grade);

					await db.reviewSchedule.put({
						userId: this.userId,
						questionId: input.questionId,
						subjectId: input.subjectId,
						topicId: input.topicId,
						...nextState,
						dueAt: dueDateFrom(nextState.intervalDays, now),
						lastGrade: grade,
						updatedAt: nowIso,
					});
				}

				// 4. Günlük istatistik
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

	async getDueReviews(limit: number): Promise<ReviewSchedule[]> {
		const nowIso = new Date().toISOString();
		const due = await getDb()
			.reviewSchedule.where("[userId+dueAt]")
			.between([this.userId, ""], [this.userId, nowIso])
			.toArray();

		// En gecikmiş olan en önce: unutma riski en yüksek soru başa gelir.
		return due.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, limit);
	}

	async getReviewSummary(): Promise<ReviewSummary> {
		const all = await getDb()
			.reviewSchedule.where("userId")
			.equals(this.userId)
			.toArray();

		const nowIso = new Date().toISOString();
		const upcoming = all
			.filter((r) => r.dueAt > nowIso)
			.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

		return {
			due: all.filter((r) => r.dueAt <= nowIso).length,
			tracked: all.length,
			struggling: all.filter((r) => r.lapses > 0).length,
			nextDueAt: upcoming[0]?.dueAt ?? null,
		};
	}

	async getRecentMistakes(limit: number): Promise<QuestionAttempt[]> {
		const attempts = await getDb()
			.attempts.where("userId")
			.equals(this.userId)
			.sortBy("createdAt");

		// Soru başına yalnızca EN SON deneme sayılır: sonradan doğru bilinen bir
		// soru "yanlışlarım" listesinde kalmamalıdır.
		const latest = new Map<string, QuestionAttempt>();
		for (const attempt of attempts) latest.set(attempt.questionId, attempt);

		return [...latest.values()]
			.filter((a) => !a.isCorrect)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.slice(0, limit);
	}

	async getStrugglingReviews(limit: number): Promise<ReviewSchedule[]> {
		const all = await getDb()
			.reviewSchedule.where("userId")
			.equals(this.userId)
			.toArray();

		return all
			.filter((r) => r.lapses > 0)
			.sort((a, b) => b.lapses - a.lapses || a.easeFactor - b.easeFactor)
			.slice(0, limit);
	}

	async saveReport(
		report: Omit<QuestionReport, "id" | "userId" | "createdAt">,
	): Promise<void> {
		await getDb().reports.add({
			id: newId(),
			userId: this.userId,
			createdAt: new Date().toISOString(),
			...report,
		});
	}

	async getReports(): Promise<QuestionReport[]> {
		const all = await getDb()
			.reports.where("userId")
			.equals(this.userId)
			.toArray();
		return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	/**
	 * İstatistikler doğrudan append-only `attempts` günlüğünden hesaplanır.
	 * `dailyStats` yalnızca önbellek olduğu için burada kaynak olarak
	 * kullanılmaz; tek istisna, aktivite takvimi ve seri hesabıdır.
	 */
	async getStatistics(activityDays: number): Promise<StatisticsSnapshot> {
		const db = getDb();
		const [attempts, daily] = await Promise.all([
			db.attempts.where("userId").equals(this.userId).toArray(),
			db.dailyStats.where("userId").equals(this.userId).toArray(),
		]);

		function tally<K extends string>(
			key: (a: QuestionAttempt) => K,
		): Map<K, CountPair> {
			const map = new Map<K, CountPair>();
			for (const attempt of attempts) {
				const bucket = map.get(key(attempt)) ?? { correct: 0, total: 0 };
				bucket.total += 1;
				if (attempt.isCorrect) bucket.correct += 1;
				map.set(key(attempt), bucket);
			}
			return map;
		}

		// Aktivite takvimi boş günleri de içerir; grafikte boşluk görünsün.
		const byDate = new Map(daily.map((d) => [d.date, d]));
		const activity: StatisticsSnapshot["activity"] = [];
		const today = new Date();

		for (let i = activityDays - 1; i >= 0; i -= 1) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			const key = dayKey(date);
			const stat = byDate.get(key);
			activity.push({
				date: key,
				answered: stat?.questionsAnswered ?? 0,
				correct: stat?.correctAnswers ?? 0,
			});
		}

		return {
			totalAttempts: attempts.length,
			totalCorrect: attempts.filter((a) => a.isCorrect).length,
			streakDays: computeStreak(
				daily.filter((d) => d.questionsAnswered > 0).map((d) => d.date),
				dayKey(today),
			),
			bySubject: [...tally((a) => a.subjectId)].map(([subjectId, counts]) => ({
				subjectId,
				...counts,
			})),
			byDifficulty: [...tally((a) => a.difficulty)].map(
				([difficulty, counts]) => ({ difficulty, ...counts }),
			),
			byContext: [...tally((a) => a.context)].map(([context, counts]) => ({
				context,
				...counts,
			})),
			activity,
		};
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
		const [
			attempts,
			topicProgress,
			testSessions,
			dailyStats,
			settings,
			bookmarks,
			examSessions,
			reviewSchedule,
			reports,
		] = await Promise.all([
			db.attempts.where("userId").equals(this.userId).toArray(),
			db.topicProgress.where("userId").equals(this.userId).toArray(),
			db.testSessions.where("userId").equals(this.userId).toArray(),
			db.dailyStats.where("userId").equals(this.userId).toArray(),
			db.settings.get(this.userId),
			db.bookmarks.where("userId").equals(this.userId).toArray(),
			db.examSessions.where("userId").equals(this.userId).toArray(),
			db.reviewSchedule.where("userId").equals(this.userId).toArray(),
			db.reports.where("userId").equals(this.userId).toArray(),
		]);

		return {
			version: 1,
			exportedAt: new Date().toISOString(),
			examSessions,
			reviewSchedule,
			reports,
			attempts,
			topicProgress,
			testSessions,
			dailyStats,
			settings: settings ?? null,
			bookmarks,
		};
	}

	/**
	 * Dışa/içe aktarma ve silme, TÜM tabloları kapsamak zorundadır.
	 *
	 * Yeni bir tablo eklendiğinde buraya da eklenmelidir; aksi hâlde kullanıcı
	 * "tüm verilerimi sildim" sanırken veri diskte kalır ve yedeği eksik olur.
	 * Bu üç metot bilinçli olarak aynı tablo listesini kullanır.
	 */
	private allTables() {
		const db = getDb();
		return [
			db.attempts,
			db.topicProgress,
			db.testSessions,
			db.examSessions,
			db.dailyStats,
			db.settings,
			db.bookmarks,
			db.reports,
			db.reviewSchedule,
		];
	}

	async importAll(bundle: ExportBundle): Promise<void> {
		const db = getDb();
		await db.transaction("rw", this.allTables(), async () => {
			await db.attempts.bulkPut(bundle.attempts);
			await db.topicProgress.bulkPut(bundle.topicProgress);
			await db.testSessions.bulkPut(bundle.testSessions);
			await db.dailyStats.bulkPut(bundle.dailyStats);
			await db.bookmarks.bulkPut(bundle.bookmarks);
			// Eski sürümde alınmış yedeklerde bu alanlar bulunmayabilir.
			await db.examSessions.bulkPut(bundle.examSessions ?? []);
			await db.reviewSchedule.bulkPut(bundle.reviewSchedule ?? []);
			await db.reports.bulkPut(bundle.reports ?? []);
			if (bundle.settings) await db.settings.put(bundle.settings);
		});
	}

	async clearAll(): Promise<void> {
		const tables = this.allTables();
		await getDb().transaction("rw", tables, async () => {
			await Promise.all(tables.map((table) => table.clear()));
		});
	}
}

export const progressRepository: IProgressRepository =
	new DexieProgressRepository();
