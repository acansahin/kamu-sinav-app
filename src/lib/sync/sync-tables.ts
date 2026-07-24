import type { ExportBundle } from "@/types/progress";

/**
 * Senkronlanan tabloların tek doğruluk kaynağı.
 *
 * Sunucu şeması (supabase/schema.sql) ile aynı kümeyi kapsar ve her yerel
 * satırı sunucu satırına çevirir. Yeni bir senkron tablosu eklenecekse iki
 * yer birlikte güncellenir: buradaki liste ve SQL şeması.
 *
 * Sunucu satırı bilinçli olarak İKİ katmanlıdır: kimlik/senkron için gerçek
 * sütunlar (`user_id`, anahtar, zaman damgası) + `data` içinde istemci
 * nesnesinin tamamı. Böylece istemci tipi büyüdüğünde sunucu şeması göç
 * gerektirmez (bkz. schema.sql, "TASARIM").
 */

/** Sunucudaki bir satır — PostgREST'e gönderilen biçim. */
export interface ServerRow {
	user_id: string;
	id?: string;
	topic_id?: string;
	ref_type?: string;
	ref_id?: string;
	created_at?: string;
	updated_at?: string;
	data: unknown;
}

export interface SyncTableSpec {
	/** Sunucudaki tablo adı. */
	table: string;
	/** Upsert'in çakışmayı çözeceği sütun(lar). */
	onConflict: string;
	/** Yerel yedekten bu tablonun sunucu satırlarını üretir. */
	rowsFrom(bundle: ExportBundle, userId: string): ServerRow[];
}

/**
 * BİLİNÇLİ OLARAK EKSİK olanlar — bundle'da vardır ama sunucuya GİTMEZ:
 *   • dailyStats     → çekmede `attempts`'ten yeniden üretilir.
 *   • reviewSchedule → çekmede `attempts` oynatılarak yeniden üretilir.
 * Bu liste yalnızca gerçekten senkronlanan yedi tabloyu içerir; bir testin
 * doğruladığı gibi (bkz. tests/unit/sync-push.test.ts) yukarıdaki ikisi asla
 * transport'a ulaşmaz. `bookmarks` artık senkronlanır: silme mezar taşıyla
 * taşındığı için `data.deletedAt` dolu satırlar da gönderilir.
 */
export const SYNC_TABLES: readonly SyncTableSpec[] = [
	{
		table: "attempts",
		onConflict: "id",
		rowsFrom: (bundle, userId) =>
			bundle.attempts.map((row) => ({
				id: row.id,
				user_id: userId,
				created_at: row.createdAt,
				data: row,
			})),
	},
	{
		table: "topic_progress",
		onConflict: "user_id,topic_id",
		rowsFrom: (bundle, userId) =>
			bundle.topicProgress.map((row) => ({
				user_id: userId,
				topic_id: row.topicId,
				updated_at: row.updatedAt,
				data: row,
			})),
	},
	{
		table: "test_sessions",
		onConflict: "id",
		rowsFrom: (bundle, userId) =>
			bundle.testSessions.map((row) => ({
				id: row.id,
				user_id: userId,
				updated_at: row.updatedAt,
				data: row,
			})),
	},
	{
		table: "exam_sessions",
		onConflict: "id",
		rowsFrom: (bundle, userId) =>
			bundle.examSessions.map((row) => ({
				id: row.id,
				user_id: userId,
				updated_at: row.updatedAt,
				data: row,
			})),
	},
	{
		table: "reports",
		onConflict: "id",
		rowsFrom: (bundle, userId) =>
			bundle.reports.map((row) => ({
				id: row.id,
				user_id: userId,
				updated_at: row.updatedAt,
				data: row,
			})),
	},
	{
		table: "bookmarks",
		onConflict: "user_id,ref_type,ref_id",
		rowsFrom: (bundle, userId) =>
			// Mezar taşları (deletedAt dolu) dâhil hepsi gönderilir; silmenin
			// başka cihazlara inmesi buna bağlı.
			bundle.bookmarks.map((row) => ({
				user_id: userId,
				ref_type: row.refType,
				ref_id: row.refId,
				updated_at: row.updatedAt,
				data: row,
			})),
	},
	{
		table: "settings",
		onConflict: "user_id",
		rowsFrom: (bundle, userId) =>
			bundle.settings
				? [
						{
							user_id: userId,
							updated_at: bundle.settings.updatedAt,
							data: bundle.settings,
						},
					]
				: [],
	},
];
