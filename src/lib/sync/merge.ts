import type { ExportBundle, StudySettings } from "@/types/progress";

/**
 * İki yedeği "son yazan kazanır" ile birleştirir. Saf; Dexie görmez.
 *
 * Faz 3'ün veri kaybı riski en yüksek adımı budur: iki cihazın verisi
 * çakışmadan tek bir doğruya inmelidir. Saf olması, o doğruyu ağ ve veritabanı
 * olmadan tam olarak sınayabilmek içindir (bkz. tests/unit/sync-merge.test.ts).
 *
 * Kurallar tablo tipine göre değişir:
 *   • attempts        → append-only. İki tarafın BİRLEŞİMİ; `id` tekilleştirir.
 *                       Kayıt hiç güncellenmediği için çakışma da yoktur.
 *   • updatedAt'liler  → aynı anahtarda `updatedAt` büyük olan kazanır.
 *   • bookmarks       → aynı kural; silme MEZAR TAŞIYLA (deletedAt) taşınır,
 *                       yani daha yeni bir "kaldırıldı" satırı canlı satırı yener.
 *   • settings        → tek satır; yine `updatedAt` büyük olan.
 *
 * Türetilen ve yerelde kalan tablolar (dailyStats, reviewSchedule) bu birleşimin
 * DIŞINDADIR: her ikisi de çağıran tarafında `attempts`'ten yeniden üretilir.
 */
export function mergeBundles(
	local: ExportBundle,
	server: ExportBundle,
): ExportBundle {
	return {
		version: 1,
		exportedAt: new Date().toISOString(),
		attempts: unionById(local.attempts, server.attempts),
		topicProgress: lastWriteWins(
			local.topicProgress,
			server.topicProgress,
			(row) => row.topicId,
		),
		testSessions: lastWriteWins(
			local.testSessions,
			server.testSessions,
			(row) => row.id,
		),
		examSessions: lastWriteWins(
			local.examSessions,
			server.examSessions,
			(row) => row.id,
		),
		reports: lastWriteWins(local.reports, server.reports, (row) => row.id),
		bookmarks: lastWriteWins(
			local.bookmarks,
			server.bookmarks,
			(row) => `${row.refType}:${row.refId}`,
		),
		settings: newerSettings(local.settings, server.settings),
		// Birleşimin dışında — çağıran `attempts`'ten yeniden türetir.
		dailyStats: local.dailyStats,
		reviewSchedule: local.reviewSchedule,
	};
}

/**
 * Append-only satırların birleşimi.
 *
 * Aynı `id` iki tarafta da varsa içerikleri özdeştir (kayıt hiç değişmez);
 * hangisinin tutulduğu önemsizdir. Yerel önceliklidir.
 */
function unionById<T extends { id: string }>(
	local: readonly T[],
	server: readonly T[],
): T[] {
	const byId = new Map<string, T>();
	for (const row of server) byId.set(row.id, row);
	for (const row of local) byId.set(row.id, row);
	return [...byId.values()];
}

/**
 * Aynı anahtardaki iki satırdan `updatedAt` büyük olanı seçer.
 *
 * Eşitlikte yerel korunur: sonuç deterministiktir ve gereksiz yazma üretmez.
 */
function lastWriteWins<T extends { updatedAt: string }>(
	local: readonly T[],
	server: readonly T[],
	keyOf: (row: T) => string,
): T[] {
	const winners = new Map<string, T>();
	for (const row of local) winners.set(keyOf(row), row);
	for (const row of server) {
		const key = keyOf(row);
		const current = winners.get(key);
		if (!current || row.updatedAt > current.updatedAt) {
			winners.set(key, row);
		}
	}
	return [...winners.values()];
}

function newerSettings(
	local: StudySettings | null,
	server: StudySettings | null,
): StudySettings | null {
	if (!local) return server;
	if (!server) return local;
	return server.updatedAt > local.updatedAt ? server : local;
}
