import { currentIdentity } from "@/lib/auth/identity";
import { getSupabaseClient } from "@/lib/auth/supabase-client";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { mergeBundles } from "./merge";
import { pullServerBundle } from "./pull";
import { pushBundle } from "./push";
import { SupabaseSyncTransport, type SyncTransport } from "./transport";

/**
 * Tam senkron döngüsü: çek → birleştir → yerele uygula → gönder.
 *
 * Sıra bağlayıcıdır. Önce sunucu çekilip yerelle birleştirilir (son yazan
 * kazanır), sonuç yerele yazılır ve AYNI sonuç sunucuya geri gönderilir.
 * Böylece iki uç da aynı birleşime oturur: yalnızca gönderseydik daha yeni bir
 * sunucu satırının üzerine yazabilir, yalnızca çekseydik yerel değişiklikler
 * sunucuya hiç ulaşmazdı.
 *
 * Transport parametreli olması test içindir; üretimde `fullSync` gerçek
 * Supabase transport'unu geçer.
 */
export async function runSync(
	userId: string,
	transport: SyncTransport,
): Promise<void> {
	const local = await progressRepository.exportAll();
	const server = await pullServerBundle(userId, transport);
	const merged = mergeBundles(local, server);

	await progressRepository.applyMerged(merged);
	await pushBundle(merged, userId, transport);
}

/**
 * Oturum açık ve Supabase yapılandırılmışsa tam senkronu çalıştırır.
 *
 * Sessizce çıkılan durumlar birer karar:
 *   • Anonim kimlik → anonim veri sunucuya gitmez (hesap gerekmez sözü).
 *   • Supabase yok → yapılandırılmamış derlemede senkron yoktur.
 * İkisi de hata değil; çağıran yerlerin (giriş, açılış) ayrı ayrı ele alması
 * gerekmesin diye burada yutulur.
 */
export async function fullSync(): Promise<void> {
	const identity = currentIdentity();
	if (identity.kind !== "account") return;

	const client = await getSupabaseClient();
	if (!client) return;

	await runSync(identity.userId, new SupabaseSyncTransport(client));
}
