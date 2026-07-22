import Dexie, { type EntityTable, type Table } from "dexie";
import type {
	Bookmark,
	DailyStat,
	ExamSession,
	QuestionAttempt,
	QuestionReport,
	ReviewSchedule,
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
 *   - `dailyStats` yalnızca performans önbelleğidir; bozulursa `attempts`
 *     günlüğünden yeniden inşa edilebilir. `topicProgress` için bu YALNIZCA
 *     sayaç alanlarında geçerlidir — `summaryRead`/`summaryReadAt` günlükten
 *     türetilemez, ayrıntı için bkz. `types/progress.ts`.
 *   - Her tabloda `userId` vardır — çoklu kullanıcı senkronu şema göçü
 *     gerektirmesin diye. Değer `lib/auth/identity.ts` tarafından belirlenir.
 *   - Append-only olmayan tablolarda `updatedAt` vardır; senkron çakışması
 *     "son yazan kazanır" ile bu damgadan çözülür (PROJECT_PLAN.md §7.2).
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
	reviewSchedule!: Table<ReviewSchedule, [string, string]>;

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

		// v3: aralıklı tekrar. `dueAt` indeksi "bugün vadesi gelenler"
		// sorgusunun tamamını karşılar.
		this.version(3).stores({
			reviewSchedule:
				"[userId+questionId], userId, dueAt, topicId, [userId+dueAt]",
		});

		/*
		 * v4: senkron damgası. Oturumlar ve hata bildirimleri güncellenebilen
		 * kayıtlardır, ama `updatedAt` taşımıyorlardı — sunucu senkronu
		 * çakışmayı çözemezdi. Mevcut satırlar silinmez; damga elde olan en
		 * yakın tarihten üretilir.
		 *
		 * `updatedAt` bilinçli olarak İNDEKSLENMEDİ. "Şu tarihten sonra
		 * değişenler" sorgusunu (senkron gönderim imleci) hızlandırırdı, ama
		 * bugün onu soran kimse yok ve indeksin bedeli her yazmada ödenir —
		 * sınav ekranı 5 saniyede bir `examSessions` satırını güncelliyor.
		 * İmleç sorgusu yazıldığında indeks de onunla birlikte eklenir.
		 */
		this.version(4).upgrade(async (tx) => {
			await tx
				.table<Partial<TestSession>>("testSessions")
				.toCollection()
				.modify((row) => {
					row.updatedAt ??= row.completedAt ?? row.startedAt;
				});

			await tx
				.table<Partial<ExamSession>>("examSessions")
				.toCollection()
				.modify((row) => {
					row.updatedAt ??= row.completedAt ?? row.startedAt;
				});

			await tx
				.table<Partial<QuestionReport>>("reports")
				.toCollection()
				.modify((row) => {
					row.updatedAt ??= row.createdAt;
				});
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
