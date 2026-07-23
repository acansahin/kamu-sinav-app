import { currentIdentity } from "@/lib/auth/identity";
import { getSupabaseClient } from "@/lib/auth/supabase-client";
import { progressRepository } from "@/lib/repositories/progress.repository";
import type { ExportBundle } from "@/types/progress";
import { SYNC_TABLES } from "./sync-tables";
import { SupabaseSyncTransport, type SyncTransport } from "./transport";

/**
 * Yerel yedeği sunucuya yükler.
 *
 * Saf ve transport'tan bağımsızdır: hangi tablonun nasıl eşleneceği
 * `SYNC_TABLES`'ta, sunucuyla konuşma `transport`'ta. Burası yalnızca sırayı
 * yürütür. Boş tablolar için istek atılmaz — yeni bir cihazın tek bir ayarı
 * varsa yalnızca o gider.
 *
 * `userId` her satırın `user_id` sütununu doldurur; RLS `auth.uid() = user_id`
 * beklediği için bu değer oturum sahibinin kimliğiyle aynı olmak zorundadır.
 * Çağıran (`pushLocalData`) bunu aktif kimlikten alır.
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

/**
 * Cihazdaki veriyi, oturum açık ve yapılandırma varsa sunucuya gönderir.
 *
 * Sessizce çıkılan durumlar birer karar:
 *   • Anonim kimlik → anonim veri sunucuya GİTMEZ (hesap gerekmez sözü).
 *   • Supabase yok → yapılandırılmamış derlemede senkron yoktur.
 * İkisi de hata değil; çağıran yerlerin (giriş, açılış) bunları ayrı ayrı
 * ele alması gerekmesin diye burada yutulur.
 */
export async function pushLocalData(): Promise<void> {
	const identity = currentIdentity();
	if (identity.kind !== "account") return;

	const client = await getSupabaseClient();
	if (!client) return;

	const bundle = await progressRepository.exportAll();
	await pushBundle(bundle, identity.userId, new SupabaseSyncTransport(client));
}
