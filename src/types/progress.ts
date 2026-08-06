import type { Difficulty } from "./content";

/**
 * Kullanıcı verisi tipleri (IndexedDB).
 *
 * Üç kural her kayıt için geçerlidir ve sunucu senkronunu mümkün kılar
 * (bkz. PROJECT_PLAN.md §7.2):
 *   1. Her kayıtta `userId` vardır. Değeri `lib/auth/identity.ts` içindeki
 *      aktif kimlikten gelir; giriş yapılmamışsa LOCAL_USER_ID'dir.
 *   2. `QuestionAttempt` yalnızca eklenir, asla güncellenmez (append-only).
 *      Tüm istatistikler bu günlükten türetilir; diğer tablolar önbellektir.
 *   3. Append-only OLMAYAN her kayıtta `updatedAt` vardır; senkronda çakışma
 *      "son yazan kazanır" kuralıyla bu damgadan çözülür.
 */

/** Giriş yapılmamış cihazın kimliği. Gerçek kimlik için `currentUserId()`. */
export const LOCAL_USER_ID = "local";

/**
 * Seçilen şıkkın indeksi. 5 şıklı sorular için 4 de geçerlidir (bkz. içerik
 * şemasında `options` 4–5 arası). Birleşime değer eklemek geriye dönük
 * uyumludur: Dexie'de saklanan eski 0–3 değerleri geçerli kalır, göç gerekmez.
 */
export type AnswerIndex = 0 | 1 | 2 | 3 | 4;

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

/**
 * DİKKAT — bu tablo saf önbellek DEĞİLDİR.
 *
 * `questionsAttempted`, `questionsCorrect` ve `masteryScore` `attempts`
 * günlüğünden yeniden üretilebilir; `summaryRead` / `summaryReadAt` ise
 * ÜRETİLEMEZ — konu özetini okumak bir deneme kaydı doğurmuyor. Bu tabloyu
 * günlükten yeniden inşa eden herhangi bir kod (senkron çekme adımı dâhil) bu
 * iki alanı korumak zorundadır, aksi hâlde kullanıcının okuma işaretleri
 * sessizce silinir.
 */
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
	/**
	 * Çözülen sabit test setinin slug'ı ("test-3"). Konu testleri artık önceden
	 * bölünmüş setlerden gelir; hangi setin çözüldüğü test listesinde skor
	 * göstermek için gerekir. İNDEKSSİZ ve isteğe bağlıdır: eski oturumlarda
	 * yoktur ve Dexie'de şema göçü gerektirmez.
	 */
	setSlug?: string;
	questionIds: string[];
	answers: Record<string, AnswerIndex | null>;
	status: TestSessionStatus;
	startedAt: string;
	completedAt?: string;
	/** 100 üzerinden; yalnızca tamamlanmış oturumlarda dolu */
	score?: number;
	/** Senkronda "son yazan kazanır" damgası. */
	updatedAt: string;
}

export type ExamSessionStatus = "in-progress" | "completed" | "abandoned";

/**
 * Deneme sınavı oturumu.
 *
 * `remainingSeconds` düzenli aralıklarla yazılır: sekme kapanır veya uygulama
 * çökerse kullanıcı sınavı kaldığı yerden sürdürebilsin diye. Kalan süre yalnızca
 * sınava özgüdür; konu testinde geri sayım yoktur.
 *
 * Cevapların ara ara yazılması ise ARTIK İKİSİNDE DE var. Konu testi başta bunu
 * yapmıyordu ("test kısa sürer" gerekçesiyle) ama süre yanlış ölçüttü:
 * kullanıcı test sırasında Ayarlar'a gidip döndüğünde bütün cevaplar
 * siliniyordu. Bkz. `getResumableTestSession` / `saveTestProgress`.
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
	/** Senkronda "son yazan kazanır" damgası. */
	updatedAt: string;
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

/**
 * Bir sorunun aralıklı tekrar durumu.
 *
 * Her cevaplanan soru için bir kayıt tutulur: doğru bilinenler uzun aralıklara
 * itilir ve nadiren geri gelir, yanlışlar ertesi gün geri döner. Böylece
 * "yanlışlarım" listesi elle yönetilen bir kuyruk değil, unutma eğrisine göre
 * sıralanan bir çalışma planı hâline gelir.
 */
export interface ReviewSchedule {
	userId: string;
	questionId: string;
	subjectId: string;
	topicId: string;
	easeFactor: number;
	intervalDays: number;
	repetitions: number;
	lapses: number;
	/** ISO tarih — bu tarihten itibaren soru tekrar kuyruğuna girer. */
	dueAt: string;
	lastGrade: number;
	updatedAt: string;
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
/** Konu özetlerinin sesli okunma hızı. Motor karşılıkları `lib/speech/types.ts`. */
export type SpeechRate = "yavas" | "normal" | "hizli";

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
	/**
	 * Son değişiklik damgası. Yer imi artık senkronlanabilen, güncellenebilen bir
	 * kayıttır (§7.2 kuralı); çakışma "son yazan kazanır" ile buradan çözülür.
	 */
	updatedAt: string;
	/**
	 * Silme MEZAR TAŞI. Doluysa yer imi kaldırılmış demektir, ama satır silinmez —
	 * yoksa union tabanlı senkron silmeyi temsil edemez ve başka bir cihaz yer
	 * imini geri diriltir. Okuma tarafı (`isBookmarked`) mezar taşlarını gizler.
	 */
	deletedAt?: string;
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
	/** `status` sunucu tarafında da değişebilir; çakışma bu damgadan çözülür. */
	updatedAt: string;
}

/**
 * Taşınabilir yedek — dışa/içe aktarmanın ve hesaba bağlamanın veri birimi.
 *
 * Repository'de değil burada durur: hem `exportAll`/`importAll` hem de
 * `lib/auth/claim.ts` bu şekli kullanıyor ve ikincisi veri katmanına bağımlı
 * olmamalı.
 *
 * YENİ TABLO EKLERKEN: buraya da eklenmelidir. `restampBundle` ve
 * `progressRepository.allTables()` bu listeyle aynı kümeyi kapsamak zorundadır;
 * aksi hâlde kullanıcı "tüm verimi yedekledim" sanırken bir tablo dışarıda kalır.
 */
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
