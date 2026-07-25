/**
 * Senkronun gözlemlenebilir durumu — tek okuma noktası.
 *
 * `lib/auth/identity.ts` ile aynı deseni izler: React görmeyen saf bir
 * gözlemlenebilir depo, React'e `lib/stores/sync-status.ts` üzerinden
 * `useSyncExternalStore` ile bağlanır. Böylece durumu hem yaşam döngüsü kodu
 * (giriş/çıkış/açılış) hem de arayüz (elle "şimdi eşitle") aynı yerden okur.
 *
 * `phase` geçicidir (her açılışta `idle`); `lastSyncedAt` kalıcıdır çünkü
 * kullanıcıya "en son ne zaman eşitlendi" bilgisini vermek yeniden açılışta da
 * gerekir. Kalıcılık `localStorage`'dadır — görsel tercihlerle aynı gerekçe:
 * Dexie'den önce, senkron okunur.
 */

export type SyncPhase = "idle" | "syncing" | "error";

export interface SyncStatus {
	phase: SyncPhase;
	/** Son BAŞARILI eşitlemenin ISO zamanı; hiç eşitlenmediyse `null`. */
	lastSyncedAt: string | null;
}

const STORAGE_KEY = "kamu-sinav-son-esitleme";

/** Ön üretim (statik export) ve ilk render için nötr anlık görüntü. */
export const IDLE_STATUS: SyncStatus = { phase: "idle", lastSyncedAt: null };

let status: SyncStatus | null = null;
const listeners = new Set<(status: SyncStatus) => void>();

function hydrate(): SyncStatus {
	if (status) return status;

	// Prerender sırasında depo yoktur; hiç eşitlenmemiş sayılır.
	if (typeof window === "undefined") return IDLE_STATUS;

	const stored = window.localStorage.getItem(STORAGE_KEY);
	status = { phase: "idle", lastSyncedAt: stored && stored.length > 0 ? stored : null };
	return status;
}

export function getSyncStatus(): SyncStatus {
	return hydrate();
}

export function subscribeSyncStatus(
	listener: (status: SyncStatus) => void,
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function emit(next: SyncStatus): void {
	status = next;
	for (const listener of listeners) listener(next);
}

/** Eşitleme başladı — arayüz dönen bir gösterge ve devre dışı düğme çizer. */
export function markSyncing(): void {
	emit({ ...hydrate(), phase: "syncing" });
}

/**
 * Eşitleme başarıyla bitti — zaman damgasını kalıcı yazar.
 *
 * `at` enjekte edilebilir olması testin saati sabitleyebilmesi içindir.
 */
export function markSynced(at: string = new Date().toISOString()): void {
	if (typeof window !== "undefined") {
		window.localStorage.setItem(STORAGE_KEY, at);
	}
	emit({ phase: "idle", lastSyncedAt: at });
}

/** Eşitleme başarısız — `lastSyncedAt` KORUNUR (önceki başarı hâlâ geçerli). */
export function markSyncError(): void {
	emit({ ...hydrate(), phase: "error" });
}

/**
 * "Son eşitleme" için insan-dostu, göreli Türkçe metin.
 *
 * Saf ve `now` enjekte edilebilir olduğu için testte saat sabitlenebilir.
 * `numeric: "always"` bilinçlidir: "dün" yerine "1 gün önce" gibi öngörülebilir
 * ve deterministik çıktı verir. Bir haftadan eskiyse mutlak tarihe düşer.
 */
export function formatLastSynced(
	lastSyncedAt: string | null,
	now: Date = new Date(),
): string {
	if (!lastSyncedAt) return "Henüz eşitlenmedi";

	const then = new Date(lastSyncedAt);
	const diffSec = Math.round((now.getTime() - then.getTime()) / 1000);

	// Gelecekteki bir damga (saat kayması) da "az önce" sayılır.
	if (diffSec < 45) return "Az önce eşitlendi";

	const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "always" });
	if (diffSec < 3600) {
		return `${rtf.format(-Math.round(diffSec / 60), "minute")} eşitlendi`;
	}
	if (diffSec < 86_400) {
		return `${rtf.format(-Math.round(diffSec / 3600), "hour")} eşitlendi`;
	}

	const diffDay = Math.round(diffSec / 86_400);
	if (diffDay < 7) {
		return `${rtf.format(-diffDay, "day")} eşitlendi`;
	}

	const date = then.toLocaleDateString("tr-TR", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	return `${date} tarihinde eşitlendi`;
}
