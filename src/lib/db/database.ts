import Dexie, { type EntityTable, type Table } from "dexie";
import type {
	Bookmark,
	DailyStat,
	ExamSession,
	QuestionAttempt,
	QuestionReport,
	StudySettings,
	TestSession,
	TopicProgress,
} from "@/types/progress";

/**
 * Yerel veritabanı (IndexedDB).
 *
 * Şema kuralları — bkz. PROJECT_PLAN.md §9.3:
 *   - `attempts` append-only'dur. Buraya yazılan kayıt asla güncellenmez;
 *     istatistikler ve ilerleme bu günlükten türetilir.
 *   - `topicProgress` ve `dailyStats` yalnızca performans önbelleğidir;
 *     bozulurlarsa `attempts` günlüğünden yeniden inşa edilebilirler.
 *   - Her tabloda `userId` vardır (MVP'de LOCAL_USER_ID) — Faz 3'teki
 *     çoklu kullanıcı senkronu şema göçü gerektirmesin diye.
 *
 * Şema değişince `version()` numarası artırılır ve göç yazılır; mevcut
 * kullanıcıların verisi silinmez.
 */
export class AppDatabase extends Dexie {
	// Bileşik birincil anahtarlı tablolar `Table<T, AnahtarTipi>` ile tiplenir;
	// `EntityTable<T, "alan">` yalnızca tek alanlı anahtarlar içindir ve bileşik
	// anahtarla get/delete çağrılarını yanlış tipler.
	attempts!: EntityTable<QuestionAttempt, "id">;
	topicProgress!: Table<TopicProgress, [string, string]>;
	testSessions!: EntityTable<TestSession, "id">;
	examSessions!: EntityTable<ExamSession, "id">;
	dailyStats!: Table<DailyStat, [string, string]>;
	settings!: EntityTable<StudySettings, "userId">;
	bookmarks!: Table<Bookmark, [string, string, string]>;
	reports!: EntityTable<QuestionReport, "id">;

	constructor() {
		super("kamu-sinav-akademi");

		this.version(1).stores({
			attempts:
				"&id, userId, questionId, topicId, subjectId, createdAt, [userId+topicId], [userId+questionId]",
			topicProgress: "[userId+topicId], userId, subjectId, masteryScore, updatedAt",
			testSessions: "&id, userId, topicId, subjectId, status, startedAt",
			dailyStats: "[userId+date], userId, date",
			settings: "&userId",
			bookmarks: "[userId+refType+refId], userId, refType, createdAt",
			reports: "&id, userId, questionId, status",
		});

		// v2: deneme sınavı oturumları. Yeni tablo eklemek mevcut veriyi
		// etkilemez; Dexie eski sürümden gelen kullanıcılar için tabloyu
		// boş olarak oluşturur.
		this.version(2).stores({
			examSessions: "&id, userId, status, startedAt, [userId+status]",
		});
	}
}

let instance: AppDatabase | null = null;

/**
 * Veritabanına erişim. Tarayıcı dışında (SSG/prerender sırasında) çağrılırsa
 * hata verir — IndexedDB sunucuda yoktur, bu yüzden çağrı yerleri istemci
 * bileşeni olmak zorundadır.
 */
export function getDb(): AppDatabase {
	if (typeof window === "undefined") {
		throw new Error(
			"getDb() yalnızca tarayıcıda çağrılabilir. Çağıran bileşene 'use client' ekleyin.",
		);
	}
	instance ??= new AppDatabase();
	return instance;
}
