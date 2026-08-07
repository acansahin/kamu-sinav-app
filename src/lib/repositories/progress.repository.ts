import { restampBundle } from "@/lib/auth/claim";
import { currentUserId } from "@/lib/auth/identity";
import { getDb } from "@/lib/db/database";
import { computeMastery } from "@/lib/scoring/mastery";
import { computeStreak, dayKey } from "@/lib/scoring/streak";
import {
	dueDateFrom,
	gradeFromAttempt,
	scheduler,
} from "@/lib/scheduler/sm2";
import type { Difficulty } from "@/types/content";
import type {
	AnswerIndex,
	AttemptContext,
	Bookmark,
	DailyStat,
	ExamResult,
	ExamSession,
	ExportBundle,
	QuestionAttempt,
	QuestionReport,
	ReviewSchedule,
	StudySettings,
	TestSession,
	TopicProgress,
} from "@/types/progress";

/**
 * İlerleme verisi erişim sözleşmesi.
 *
 * UI ve özellik katmanı Dexie'yi asla doğrudan görmez; her şey buradan geçer.
 * Faz 3'te sunucu geldiğinde yalnızca bu arayüzün ikinci bir implementasyonu
 * yazılır — çağıran hiçbir bileşen değişmez (bkz. PROJECT_PLAN.md §7.2).
 *
 * Kimlik de bu sınırın içindedir: çağıran hiçbir yer `userId` vermez, satırları
 * repository damgalar. Oturum oluşturma metotlarının `Omit<…, "userId">`
 * almasının sebebi budur.
 */
export interface IProgressRepository {
	recordAttempt(input: RecordAttemptInput): Promise<void>;
	recordAttempts(inputs: readonly RecordAttemptInput[]): Promise<void>;
	getTopicProgress(topicId: string): Promise<TopicProgress | null>;
	getAllTopicProgress(): Promise<TopicProgress[]>;
	markSummaryRead(subjectId: string, topicId: string): Promise<void>;
	unmarkSummaryRead(topicId: string): Promise<void>;
	createTestSession(session: NewTestSession): Promise<void>;
	getTestSession(sessionId: string): Promise<TestSession | null>;
	completeTestSession(
		sessionId: string,
		answers: Record<string, AnswerIndex | null>,
		score: number,
	): Promise<void>;
	getRecentTestSessions(limit: number): Promise<TestSession[]>;
	/** Bir konunun tamamlanmış test oturumları — test listesinde skor rozetleri için. */
	getCompletedTestSessions(topicId: string): Promise<TestSession[]>;
	/**
	 * Belirli bir test setinde yarıda kalmış oturum varsa döner.
	 *
	 * Kullanıcı test sırasında Ayarlar'a gidip döndüğünde testin baştan
	 * başlamaması için gerekir; sınavdaki `getResumableExamSession` ile aynı işi
	 * yapar ama sete özgüdür — farklı bir testin açık oturumu döndürülmemeli.
	 */
	getResumableTestSession(
		topicId: string,
		setSlug: string,
	): Promise<TestSession | null>;
	/** Test sürerken cevapları diske yazar; sayfadan ayrılınca kayıp olmaz. */
	saveTestProgress(
		sessionId: string,
		patch: Pick<TestSession, "answers">,
	): Promise<void>;
	abandonTestSession(sessionId: string): Promise<void>;
	createExamSession(session: NewExamSession): Promise<void>;
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
	saveReport(
		report: Omit<QuestionReport, "id" | "userId" | "createdAt" | "updatedAt">,
	): Promise<void>;
	getReports(): Promise<QuestionReport[]>;
	getStatistics(activityDays: number): Promise<StatisticsSnapshot>;
	getSettings(): Promise<StudySettings>;
	saveSettings(patch: Partial<StudySettings>): Promise<void>;
	getDailyStats(days: number): Promise<DailyStat[]>;
	getStreakSummary(activityDays: number): Promise<StreakSummary>;
	toggleBookmark(refType: Bookmark["refType"], refId: string): Promise<boolean>;
	isBookmarked(refType: Bookmark["refType"], refId: string): Promise<boolean>;
	getBookmarks(refType: Bookmark["refType"]): Promise<Bookmark[]>;
	exportAll(): Promise<ExportBundle>;
	importAll(bundle: ExportBundle): Promise<void>;
	clearAll(): Promise<void>;
	/**
	 * Cihazdaki tüm veriyi yeni bir kimliğe damgalar.
	 *
	 * Kullanıcı hesap açtığında anonim ilerlemesi silinmez, hesabın parçası
	 * olur — PROJECT_PLAN.md §8'deki "veri kaybı olmadan yükseltme" sözü.
	 */
	reassignOwner(newUserId: string): Promise<void>;
	/**
	 * Birleştirilmiş yedeği yerele yazar ve türetilmiş tabloları yeniden üretir.
	 *
	 * Senkron çekme adımının yerel yarısı: `mergeBundles` çıktısı buraya gelir.
	 * `dailyStats` ve `reviewSchedule` sunucudan gelmez, `attempts`'ten yeniden
	 * kurulur; `topicProgress` sayaçları da öyle — ama `summaryRead` korunur.
	 */
	applyMerged(merged: ExportBundle): Promise<void>;
}

/** Oturumu açan kod kimliği bilmez; `userId` damgasını repository atar. */
export type NewTestSession = Omit<TestSession, "userId" | "updatedAt">;
export type NewExamSession = Omit<ExamSession, "userId" | "updatedAt">;

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

/** Son N günün aktivitesi, eskiden yeniye; boş günler de dâhil. */
export type ActivityDay = { date: string; answered: number; correct: number };

export interface StatisticsSnapshot {
	totalAttempts: number;
	totalCorrect: number;
	streakDays: number;
	bySubject: (CountPair & { subjectId: string })[];
	byDifficulty: (CountPair & { difficulty: Difficulty })[];
	byContext: (CountPair & { context: AttemptContext })[];
	activity: ActivityDay[];
}

/**
 * `StatisticsSnapshot`in seri + aktivite kısmı.
 *
 * Ayrı bir tipi ve ayrı bir sorgusu var çünkü ana sayfa bunu HER açılışta
 * okuyor: `getStatistics` tüm `attempts` tablosunu belleğe alır (aylar süren
 * kullanımda on binlerce satır), oysa seri şeridi yalnızca `dailyStats`
 * gerektiriyor — günde en fazla bir satır.
 */
export interface StreakSummary {
	streakDays: number;
	activity: ActivityDay[];
}

const DEFAULT_SETTINGS: Omit<StudySettings, "userId" | "updatedAt"> = {
	dailyGoalQuestions: 20,
	instantFeedback: true,
};

function newId(): string {
	return globalThis.crypto.randomUUID();
}

/**
 * Aktivite takvimini kurar. Çalışılmamış günler de ATLANMAZ, sıfır olarak
 * girer: grafikte boşluk görünmezse iki aktif gün arasındaki ara kapanır ve
 * seri kesintisiz gibi okunur.
 */
function buildActivity(
	daily: readonly DailyStat[],
	days: number,
	today: Date,
): ActivityDay[] {
	const byDate = new Map(daily.map((d) => [d.date, d]));
	const activity: ActivityDay[] = [];

	for (let i = days - 1; i >= 0; i -= 1) {
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

	return activity;
}

class DexieProgressRepository implements IProgressRepository {
	/**
	 * Aktif kimlik her çağrıda okunur — sabit değildir.
	 *
	 * Yerel veritabanı tek kullanıcılıktır: satırlar her zaman o an aktif olan
	 * kimliğe aittir (bkz. `lib/auth/identity.ts`). Kimlik değiştiğinde veri
	 * `reassignOwner` ile taşınır, bu yüzden burada filtreleme yeterlidir.
	 */
	private get userId(): string {
		return currentUserId();
	}

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

	/**
	 * Okundu işaretini geri alır.
	 *
	 * `summaryReadAt` DE SİLİNİR. `markSummaryRead` o alanı bilinçli olarak
	 * koruduğu (ilk okuma tarihi kaybolmasın) için yalnızca bayrağı çevirmek
	 * "okunmadı ama okunma tarihi var" diyen tutarsız bir satır bırakırdı.
	 *
	 * Satırın kendisi SİLİNMEZ: `questionsAttempted`/`questionsCorrect`/
	 * `masteryScore` attempt günlüğünden türer ve okuma işaretiyle ilgisi yoktur.
	 * Satır yoksa yapacak bir şey de yoktur.
	 */
	async unmarkSummaryRead(topicId: string): Promise<void> {
		const db = getDb();
		const existing = await db.topicProgress.get([this.userId, topicId]);
		if (!existing) return;

		const guncel: TopicProgress = {
			...existing,
			summaryRead: false,
			updatedAt: new Date().toISOString(),
		};
		delete guncel.summaryReadAt;
		await db.topicProgress.put(guncel);
	}

	async createTestSession(session: NewTestSession): Promise<void> {
		await getDb().testSessions.add({
			...session,
			userId: this.userId,
			updatedAt: new Date().toISOString(),
		});
	}

	async getTestSession(sessionId: string): Promise<TestSession | null> {
		return (await getDb().testSessions.get(sessionId)) ?? null;
	}

	async completeTestSession(
		sessionId: string,
		answers: Record<string, AnswerIndex | null>,
		score: number,
	): Promise<void> {
		const nowIso = new Date().toISOString();
		await getDb().testSessions.update(sessionId, {
			answers,
			score,
			status: "completed",
			completedAt: nowIso,
			updatedAt: nowIso,
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

	async getCompletedTestSessions(topicId: string): Promise<TestSession[]> {
		return getDb()
			.testSessions.where("topicId")
			.equals(topicId)
			.filter(
				(session) =>
					session.userId === this.userId && session.status === "completed",
			)
			.toArray();
	}

	/*
	 * `testSessions`te bileşik [userId+status] indeksi yok ve eklenmedi: sorgu
	 * zaten `topicId` indeksiyle daraltılıyor, kalan süzme bellekte ucuz. İndeks
	 * eklemenin bedeli her yazmada ödenirdi — bkz. database.ts'teki v4 notu.
	 */
	async getResumableTestSession(
		topicId: string,
		setSlug: string,
	): Promise<TestSession | null> {
		const open = await getDb()
			.testSessions.where("topicId")
			.equals(topicId)
			.filter(
				(session) =>
					session.userId === this.userId &&
					session.status === "in-progress" &&
					session.setSlug === setSlug,
			)
			.sortBy("startedAt");
		return open.at(-1) ?? null;
	}

	async saveTestProgress(
		sessionId: string,
		patch: Pick<TestSession, "answers">,
	): Promise<void> {
		await getDb().testSessions.update(sessionId, {
			...patch,
			updatedAt: new Date().toISOString(),
		});
	}

	async abandonTestSession(sessionId: string): Promise<void> {
		await getDb().testSessions.update(sessionId, {
			status: "abandoned",
			updatedAt: new Date().toISOString(),
		});
	}

	async createExamSession(session: NewExamSession): Promise<void> {
		await getDb().examSessions.add({
			...session,
			userId: this.userId,
			updatedAt: new Date().toISOString(),
		});
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
		await getDb().examSessions.update(sessionId, {
			...patch,
			updatedAt: new Date().toISOString(),
		});
	}

	async completeExamSession(
		sessionId: string,
		result: ExamResult,
	): Promise<void> {
		const nowIso = new Date().toISOString();
		await getDb().examSessions.update(sessionId, {
			result,
			status: "completed",
			completedAt: nowIso,
			remainingSeconds: 0,
			updatedAt: nowIso,
		});
	}

	async abandonExamSession(sessionId: string): Promise<void> {
		await getDb().examSessions.update(sessionId, {
			status: "abandoned",
			updatedAt: new Date().toISOString(),
		});
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
		report: Omit<QuestionReport, "id" | "userId" | "createdAt" | "updatedAt">,
	): Promise<void> {
		const nowIso = new Date().toISOString();
		await getDb().reports.add({
			id: newId(),
			userId: this.userId,
			createdAt: nowIso,
			updatedAt: nowIso,
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

		const today = new Date();

		return {
			totalAttempts: attempts.length,
			totalCorrect: attempts.filter((a) => a.isCorrect).length,
			streakDays: computeStreak(
				daily.filter((d) => d.questionsAnswered > 0).map((d) => d.date),
				dayKey(today),
			),
			activity: buildActivity(daily, activityDays, today),
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
		};
	}

	/**
	 * Seri şeridi için hafif sorgu — `attempts` tablosuna hiç dokunmaz.
	 * Gerekçe için `StreakSummary` tipine bakın.
	 */
	async getStreakSummary(activityDays: number): Promise<StreakSummary> {
		const daily = await getDb()
			.dailyStats.where("userId")
			.equals(this.userId)
			.toArray();
		const today = new Date();

		return {
			streakDays: computeStreak(
				daily.filter((d) => d.questionsAnswered > 0).map((d) => d.date),
				dayKey(today),
			),
			activity: buildActivity(daily, activityDays, today),
		};
	}

	async getSettings(): Promise<StudySettings> {
		const stored = await getDb().settings.get(this.userId);
		return (
			stored ?? {
				...DEFAULT_SETTINGS,
				userId: this.userId,
				updatedAt: new Date().toISOString(),
			}
		);
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

	/**
	 * Yer imini açar/kapatır.
	 *
	 * Kaldırma satırı SİLMEZ, mezar taşına çevirir (`deletedAt`). Hard-delete
	 * olsaydı union tabanlı senkron silmeyi taşıyamaz, başka bir cihaz yer imini
	 * geri diriltirdi. Yeniden ekleme mevcut mezar taşını canlandırır; özgün
	 * `createdAt` ve not korunur.
	 */
	async toggleBookmark(
		refType: Bookmark["refType"],
		refId: string,
	): Promise<boolean> {
		const db = getDb();
		const key: [string, string, string] = [this.userId, refType, refId];
		const existing = await db.bookmarks.get(key);
		const now = new Date().toISOString();

		if (existing && !existing.deletedAt) {
			await db.bookmarks.put({ ...existing, deletedAt: now, updatedAt: now });
			return false;
		}

		const revived: Bookmark = {
			userId: this.userId,
			refType,
			refId,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};
		if (existing?.note !== undefined) revived.note = existing.note;
		await db.bookmarks.put(revived);
		return true;
	}

	async isBookmarked(
		refType: Bookmark["refType"],
		refId: string,
	): Promise<boolean> {
		const row = await getDb().bookmarks.get([this.userId, refType, refId]);
		// Mezar taşı "kaldırılmış" demektir; kullanıcıya işaretli görünmez.
		return row !== undefined && !row.deletedAt;
	}

	/**
	 * Bir türdeki canlı yer imleri, en yeniden eskiye.
	 *
	 * Mezar taşları `isBookmarked` ile aynı kuralla elenir — listede süzmeyi
	 * unutmak kaldırılmış yer imlerini geri getirirdi.
	 */
	async getBookmarks(refType: Bookmark["refType"]): Promise<Bookmark[]> {
		const rows = await getDb()
			.bookmarks.where("userId")
			.equals(this.userId)
			.toArray();

		return rows
			.filter((row) => row.refType === refType && !row.deletedAt)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	/**
	 * Aktif kullanıcının tüm satırlarını tek pakette toplar.
	 *
	 * Okumalar bilinçli olarak SIRALIDIR (`Promise.all` değil): bu metot
	 * `reassignOwner` içinden, açık bir yazma transaction'ının içinde de
	 * çağrılıyor ve orada işlem sırası öngörülebilir olmalı.
	 */
	private async readBundle(): Promise<ExportBundle> {
		const db = getDb();

		return {
			version: 1,
			exportedAt: new Date().toISOString(),
			attempts: await db.attempts
				.where("userId")
				.equals(this.userId)
				.toArray(),
			topicProgress: await db.topicProgress
				.where("userId")
				.equals(this.userId)
				.toArray(),
			testSessions: await db.testSessions
				.where("userId")
				.equals(this.userId)
				.toArray(),
			examSessions: await db.examSessions
				.where("userId")
				.equals(this.userId)
				.toArray(),
			dailyStats: await db.dailyStats
				.where("userId")
				.equals(this.userId)
				.toArray(),
			bookmarks: await db.bookmarks
				.where("userId")
				.equals(this.userId)
				.toArray(),
			reviewSchedule: await db.reviewSchedule
				.where("userId")
				.equals(this.userId)
				.toArray(),
			reports: await db.reports.where("userId").equals(this.userId).toArray(),
			settings: (await db.settings.get(this.userId)) ?? null,
		};
	}

	/** Veri taşınabilirliği sözü — bkz. PROJECT_PLAN.md §4, taahhüt 6. */
	async exportAll(): Promise<ExportBundle> {
		return this.readBundle();
	}

	/**
	 * Dışa/içe aktarma, silme ve kimlik taşıma TÜM tabloları kapsamak zorundadır.
	 *
	 * Yeni bir tablo eklendiğinde buraya, `readBundle`'a ve `writeBundle`'a
	 * eklenmelidir; aksi hâlde kullanıcı "tüm verilerimi sildim" sanırken veri
	 * diskte kalır, yedeği eksik olur ve hesaba geçerken o tablo geride kalır.
	 * Bu metotlar bilinçli olarak aynı tablo listesini kullanır.
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

	/** Çağıran taraf transaction'ı açmış olmalıdır. */
	private async writeBundle(bundle: ExportBundle): Promise<void> {
		const db = getDb();
		await db.attempts.bulkPut(bundle.attempts);
		await db.topicProgress.bulkPut(bundle.topicProgress);
		await db.testSessions.bulkPut(bundle.testSessions);
		await db.dailyStats.bulkPut(bundle.dailyStats);
		await db.bookmarks.bulkPut(bundle.bookmarks);
		// Eski sürümde alınmış yedeklerde bu tablolar bulunmayabilir.
		await db.examSessions.bulkPut(bundle.examSessions ?? []);
		await db.reviewSchedule.bulkPut(bundle.reviewSchedule ?? []);
		await db.reports.bulkPut(bundle.reports ?? []);
		if (bundle.settings) await db.settings.put(bundle.settings);
	}

	async importAll(bundle: ExportBundle): Promise<void> {
		const db = getDb();
		await db.transaction("rw", this.allTables(), async () => {
			await this.writeBundle(backfillTimestamps(bundle));
		});
	}

	async clearAll(): Promise<void> {
		const tables = this.allTables();
		await getDb().transaction("rw", tables, async () => {
			await Promise.all(tables.map((table) => table.clear()));
		});
	}

	/**
	 * Cihazdaki tüm veriyi yeni bir kimliğe damgalar.
	 *
	 * Neden tek transaction: `topicProgress`, `dailyStats`, `bookmarks` ve
	 * `reviewSchedule` tablolarının BİRİNCİL ANAHTARI `userId` içerir. Bu
	 * satırlar `update` ile damgalanamaz — silinip yeniden eklenmeleri gerekir.
	 * Sil ile yaz arasında bir çökme olursa kullanıcı ilerlemesini kaybederdi.
	 *
	 * Çağrı sırası bağlayıcıdır: bu metot ESKİ kimlik hâlâ aktifken çağrılır,
	 * `setIdentity` ondan SONRA gelir. Tersi sırada okuma boş küme döner ve
	 * veri sahipsiz kalır.
	 */
	async reassignOwner(newUserId: string): Promise<void> {
		if (newUserId === this.userId) return;

		const db = getDb();
		const tables = this.allTables();

		await db.transaction("rw", tables, async () => {
			const restamped = restampBundle(await this.readBundle(), newUserId);
			// Yerel veritabanı tek kullanıcılıktır; tabloları tamamen boşaltmak
			// güvenlidir ve eski kimlikten artık satır kalmamasını garanti eder.
			await Promise.all(tables.map((table) => table.clear()));
			await this.writeBundle(restamped);
		});
	}

	async applyMerged(merged: ExportBundle): Promise<void> {
		const db = getDb();
		const userId = this.userId;
		// Aktif kimlikle damgala: birleştirme çıktısı zaten bu kimlikle gelmeli,
		// ama garantiyi tek yerde ver.
		const stamped = restampBundle(merged, userId);

		await db.transaction("rw", this.allTables(), async () => {
			// Senkronlanan tabloları yaz. Silme yok (tombstone henüz yok), bu
			// yüzden bulkPut yeterli: yalnızca ekler ve günceller.
			await db.attempts.bulkPut(stamped.attempts);
			await db.testSessions.bulkPut(stamped.testSessions);
			await db.examSessions.bulkPut(stamped.examSessions);
			await db.reports.bulkPut(stamped.reports);
			await db.topicProgress.bulkPut(stamped.topicProgress);
			// Yer imleri (mezar taşları dâhil) yazılır: silme bu satırlarla taşınır.
			await db.bookmarks.bulkPut(stamped.bookmarks);
			if (stamped.settings) await db.settings.put(stamped.settings);

			await this.rebuildDerived(userId);
		});
	}

	/**
	 * Türetilmiş tabloları `attempts` günlüğünden yeniden kurar.
	 *
	 * Çağıran taraf transaction açmış olmalıdır. Bu, `recordAttempts`'in
	 * artımlı güncellemesinin toplu karşılığıdır: birleştirme sonrası günlük
	 * değiştiği için sayaçlar, tekrar planı ve günlük istatistik yeniden
	 * hesaplanır.
	 *
	 * KRİTİK: `summaryRead`/`summaryReadAt` günlükten türetilemez. Sayaçları
	 * güncellerken bu iki alan ve `updatedAt` (senkron damgası) korunur; hiç
	 * denemesi olmayan ama özeti okunmuş bir konu bu yüzden bozulmadan kalır.
	 */
	private async rebuildDerived(userId: string): Promise<void> {
		const db = getDb();
		const attempts = await db.attempts
			.where("userId")
			.equals(userId)
			.sortBy("createdAt");

		// 1. topicProgress sayaçları — summaryRead ve updatedAt korunur.
		for (const topicId of new Set(attempts.map((a) => a.topicId))) {
			const rows = attempts.filter((a) => a.topicId === topicId);
			const existing = await db.topicProgress.get([userId, topicId]);
			await db.topicProgress.put({
				userId,
				topicId,
				subjectId: rows[0]?.subjectId ?? existing?.subjectId ?? "",
				summaryRead: existing?.summaryRead ?? false,
				summaryReadAt: existing?.summaryReadAt,
				questionsAttempted: rows.length,
				questionsCorrect: rows.filter((a) => a.isCorrect).length,
				masteryScore: computeMastery(rows.map((a) => a.isCorrect)),
				updatedAt: existing?.updatedAt ?? new Date().toISOString(),
			});
		}

		// 2. reviewSchedule — sil ve her soruyu sırayla oynatarak yeniden kur.
		//    Tekrar planı son cevaplama anına göredir; dueAt son denemenin
		//    tarihinden hesaplanır (kayıt anındaki "şimdi"den değil).
		await db.reviewSchedule.where("userId").equals(userId).delete();
		for (const questionId of new Set(attempts.map((a) => a.questionId))) {
			const rows = attempts.filter((a) => a.questionId === questionId);
			let state = scheduler.initial();
			let lastGrade = 0;
			for (const a of rows) {
				const grade = gradeFromAttempt(
					a.isCorrect,
					a.selectedIndex,
					a.durationMs,
				);
				state = scheduler.next(state, grade);
				lastGrade = grade;
			}
			const last = rows[rows.length - 1];
			if (!last) continue;
			await db.reviewSchedule.put({
				userId,
				questionId,
				subjectId: last.subjectId,
				topicId: last.topicId,
				...state,
				dueAt: dueDateFrom(state.intervalDays, new Date(last.createdAt)),
				lastGrade,
				updatedAt: last.createdAt,
			});
		}

		// 3. dailyStats — sil ve güne göre yeniden topla.
		await db.dailyStats.where("userId").equals(userId).delete();
		for (const date of new Set(attempts.map((a) => dayKey(new Date(a.createdAt))))) {
			const rows = attempts.filter(
				(a) => dayKey(new Date(a.createdAt)) === date,
			);
			await db.dailyStats.put({
				userId,
				date,
				questionsAnswered: rows.length,
				correctAnswers: rows.filter((a) => a.isCorrect).length,
				studySeconds: Math.round(
					rows.reduce((sum, a) => sum + a.durationMs, 0) / 1000,
				),
				topicsCompleted: 0,
			});
		}
	}
}

/**
 * Şema v4 öncesinde alınmış yedeklerde `updatedAt` yoktur.
 *
 * Eksik damgayı elde olan en yakın tarihten üretiriz; yedek sürümü 1'de kalır
 * çünkü alanlar toplamsaldır ve kullanıcının eski dosyası hâlâ geçerlidir.
 */
function backfillTimestamps(bundle: ExportBundle): ExportBundle {
	return {
		...bundle,
		testSessions: (bundle.testSessions ?? []).map((row) => ({
			...row,
			updatedAt: row.updatedAt ?? row.completedAt ?? row.startedAt,
		})),
		examSessions: (bundle.examSessions ?? []).map((row) => ({
			...row,
			updatedAt: row.updatedAt ?? row.completedAt ?? row.startedAt,
		})),
		reports: (bundle.reports ?? []).map((row) => ({
			...row,
			updatedAt: row.updatedAt ?? row.createdAt,
		})),
		bookmarks: (bundle.bookmarks ?? []).map((row) => ({
			...row,
			updatedAt: row.updatedAt ?? row.createdAt,
		})),
	};
}

export const progressRepository: IProgressRepository =
	new DexieProgressRepository();
