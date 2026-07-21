import type { Difficulty } from "./content";

/**
 * Kullanıcı verisi tipleri (IndexedDB).
 *
 * İki kural her kayıt için geçerlidir ve Faz 3'teki sunucu senkronunu
 * bugünden mümkün kılar (bkz. PROJECT_PLAN.md §7.2):
 *   1. Her kayıtta `userId` vardır. MVP'de sabit LOCAL_USER_ID.
 *   2. `QuestionAttempt` yalnızca eklenir, asla güncellenmez (append-only).
 *      Tüm istatistikler bu günlükten türetilir; diğer tablolar önbellektir.
 */

/** MVP'de tek, anonim kullanıcı. Faz 3'te gerçek kullanıcı kimliğiyle değişir. */
export const LOCAL_USER_ID = "local";

export type AnswerIndex = 0 | 1 | 2 | 3;

export type AttemptContext = "practice" | "exam" | "review";

/** Append-only olay günlüğü — tüm türetilmiş verilerin kaynağı. */
export interface QuestionAttempt {
	id: string;
	userId: string;
	questionId: string;
	subjectId: string;
	topicId: string;
	difficulty: Difficulty;
	/** null = boş bırakıldı */
	selectedIndex: AnswerIndex | null;
	isCorrect: boolean;
	durationMs: number;
	context: AttemptContext;
	sessionId: string;
	createdAt: string;
}

export interface TopicProgress {
	userId: string;
	topicId: string;
	subjectId: string;
	summaryRead: boolean;
	summaryReadAt?: string;
	questionsAttempted: number;
	questionsCorrect: number;
	/** 0-100. Son denemelere daha çok ağırlık verir; bkz. lib/scoring/mastery.ts */
	masteryScore: number;
	updatedAt: string;
}

export type TestSessionStatus = "in-progress" | "completed" | "abandoned";

export interface TestSession {
	id: string;
	userId: string;
	kind: "topic-test";
	subjectId: string;
	topicId: string;
	difficulty: Difficulty | "karisik";
	questionIds: string[];
	answers: Record<string, AnswerIndex | null>;
	status: TestSessionStatus;
	startedAt: string;
	completedAt?: string;
	/** 100 üzerinden; yalnızca tamamlanmış oturumlarda dolu */
	score?: number;
}

export type ExamSessionStatus = "in-progress" | "completed" | "abandoned";

/**
 * Deneme sınavı oturumu.
 *
 * `remainingSeconds` düzenli aralıklarla yazılır: sekme kapanır veya uygulama
 * çökerse kullanıcı sınavı kaldığı yerden sürdürebilsin diye. Bu, konu
 * testinden farklı olarak sınavın uzun sürmesinden kaynaklanan bir gerekliliktir.
 */
export interface ExamSession {
	id: string;
	userId: string;
	templateId: string;
	templateName: string;
	questionIds: string[];
	answers: Record<string, AnswerIndex | null>;
	/** Kullanıcının "sonra dönerim" diye işaretlediği sorular */
	flagged: string[];
	status: ExamSessionStatus;
	startedAt: string;
	durationSeconds: number;
	remainingSeconds: number;
	passingScore: number;
	completedAt?: string;
	result?: ExamResult;
}

export interface ExamResult {
	total: number;
	correct: number;
	wrong: number;
	empty: number;
	/** 100 üzerinden */
	score: number;
	passed: boolean;
	durationMs: number;
	bySubject: SubjectBreakdown[];
	/** En düşük doğruluk oranına sahip konular, zayıftan güçlüye */
	weakTopicIds: string[];
	wrongQuestionIds: string[];
}

export interface DailyStat {
	userId: string;
	/** "2026-07-21" */
	date: string;
	questionsAnswered: number;
	correctAnswers: number;
	studySeconds: number;
	topicsCompleted: number;
}

export type FontScale = "normal" | "buyuk" | "cok-buyuk";
export type ThemeChoice = "sistem" | "acik" | "koyu";

/**
 * Çalışma tercihleri (Dexie'de).
 * Görsel tercihler (tema, yazı boyutu, kontrast) burada DEĞİL,
 * `lib/stores/preferences.ts` içinde localStorage'da tutulur — ilk boyamadan
 * önce senkron okunabilmeleri gerekiyor.
 */
export interface StudySettings {
	userId: string;
	dailyGoalQuestions: number;
	/** ISO tarih; geri sayım için */
	examDate?: string;
	/** true: her soruda anında geri bildirim, false: test sonunda */
	instantFeedback: boolean;
	updatedAt: string;
}

export interface Bookmark {
	userId: string;
	refType: "question" | "topic";
	refId: string;
	note?: string;
	createdAt: string;
}

export type ReportReason =
	| "yanlis-cevap"
	| "guncel-degil"
	| "belirsiz-ifade"
	| "yazim-hatasi"
	| "diger";

/** Kullanıcı hata bildirimi — rakiplerin en büyük açığı (PROJECT_PLAN.md §3.2). */
export interface QuestionReport {
	id: string;
	userId: string;
	questionId: string;
	reason: ReportReason;
	note?: string;
	status: "yerel" | "gonderildi" | "cozuldu";
	createdAt: string;
}

// --- Türetilmiş görünümler --------------------------------------------------

export interface SubjectBreakdown {
	subjectId: string;
	subjectName: string;
	correct: number;
	wrong: number;
	empty: number;
	total: number;
	accuracy: number;
}

export interface TestResult {
	sessionId: string;
	total: number;
	correct: number;
	wrong: number;
	empty: number;
	/** 100 üzerinden */
	score: number;
	accuracy: number;
	durationMs: number;
	wrongQuestionIds: string[];
}
