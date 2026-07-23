import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerRow } from "./sync-tables";

/**
 * Senkronun sunucuyla konuşma yüzeyi.
 *
 * Soyut olmasının sebebi test edilebilirlik: gönderim mantığı bu arayüzün
 * arkasında durduğu için sahte bir transport'la ağsız test edilebilir,
 * gerçek Supabase transport'u ise yalnızca PostgREST çağrısını sarar.
 */
export interface SyncTransport {
	/** Satırları tabloya yazar; çakışmayı `onConflict` sütun(lar)ına göre çözer. */
	upsert(
		table: string,
		onConflict: string,
		rows: readonly ServerRow[],
	): Promise<void>;
	/** Kullanıcının bir tablodaki tüm satırlarını çeker. */
	fetchAll(table: string, userId: string): Promise<ServerRow[]>;
}

/** Senkron sırasında sunucudan dönen hata. */
export class SyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SyncError";
	}
}

/** Gerçek sunucu: PostgREST upsert'ini sarar. */
export class SupabaseSyncTransport implements SyncTransport {
	constructor(private readonly client: SupabaseClient) {}

	async upsert(
		table: string,
		onConflict: string,
		rows: readonly ServerRow[],
	): Promise<void> {
		const { error } = await this.client
			.from(table)
			// `rows` salt-okunur; Supabase tipleri mutable dizi beklediği için kopya.
			.upsert([...rows], { onConflict });

		if (error) {
			throw new SyncError(`"${table}" tablosuna yazılamadı: ${error.message}`);
		}
	}

	async fetchAll(table: string, userId: string): Promise<ServerRow[]> {
		// RLS zaten kullanıcının satırlarıyla sınırlar; açık `eq` hem savunmacı
		// hem de sorguyu indeksli sütuna oturtur.
		const { data, error } = await this.client
			.from(table)
			.select("*")
			.eq("user_id", userId);

		if (error) {
			throw new SyncError(`"${table}" tablosu okunamadı: ${error.message}`);
		}
		return (data ?? []) as ServerRow[];
	}
}
