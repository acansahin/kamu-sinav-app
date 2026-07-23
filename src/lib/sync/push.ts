import type { ExportBundle } from "@/types/progress";
import { SYNC_TABLES } from "./sync-tables";
import type { SyncTransport } from "./transport";

/**
 * Bir yedeği sunucuya yükler.
 *
 * Saf ve transport'tan bağımsızdır: hangi tablonun nasıl eşleneceği
 * `SYNC_TABLES`'ta, sunucuyla konuşma `transport`'ta. Burası yalnızca sırayı
 * yürütür. Boş tablolar için istek atılmaz — yeni bir cihazın tek bir ayarı
 * varsa yalnızca o gider.
 *
 * `userId` her satırın `user_id` sütununu doldurur; RLS `auth.uid() = user_id`
 * beklediği için bu değer oturum sahibinin kimliğiyle aynı olmak zorundadır.
 * Çağıran (`runSync`) bunu aktif kimlikten alır.
 */
export async function pushBundle(
	bundle: ExportBundle,
	userId: string,
	transport: SyncTransport,
): Promise<void> {
	for (const spec of SYNC_TABLES) {
		const rows = spec.rowsFrom(bundle, userId);
		if (rows.length > 0) {
			await transport.upsert(spec.table, spec.onConflict, rows);
		}
	}
}
