import { LOCAL_USER_ID } from "@/types/progress";

/**
 * Cihazda aktif olan kimlik — tek okuma noktası.
 *
 * Bu modül React görmez ve ağ istemez; `lib/` altındaki diğer saf mantıkla
 * (puanlama, seçici, zamanlayıcı) aynı kuralı izler.
 *
 * ÖNEMLİ SÖZLEŞME — yerel veritabanı tek kullanıcılıktır.
 * IndexedDB'deki satırlar her zaman o an aktif olan TEK kimliğe aittir.
 * Kullanıcı ayrımı sunucuda (RLS) yapılır, burada değil. Bunun iki sonucu var:
 *
 *   1. Kimlik her değiştiğinde beraberinde bir Dexie yazması olur
 *      (bağlama = satırları yeniden damgalama, hesap değiştirme = temizle +
 *      yeniden çek). Dexie dokunulan tabloları izlediği için `useLiveQuery`
 *      abonelikleri kendiliğinden tazelenir — çağrı yerlerine `userId`
 *      bağımlılığı eklemek gerekmez.
 *   2. Aynı cihazda iki hesap aynı anda veri tutamaz. Bilinçli bir karardır;
 *      gizlilik açısından da doğru davranıştır.
 *
 * Kimlik `localStorage`'dan SENKRON okunur. Asenkron bir hidrasyon, ilk
 * yazmanın yanlış kimlikle damgalanma riskini doğururdu; Faz 3'te Supabase
 * oturumu da aynı depodan senkron okunabildiği için bu sözleşme korunacak.
 */

export type Identity =
	| { kind: "local"; userId: string }
	| { kind: "account"; userId: string; email: string };

/** Giriş yapılmamış cihazın kimliği. */
export const LOCAL_IDENTITY: Identity = {
	kind: "local",
	userId: LOCAL_USER_ID,
};

export const IDENTITY_STORAGE_KEY = "kamu-sinav-kimlik";

let identity: Identity | null = null;
const listeners = new Set<(identity: Identity) => void>();

/**
 * Depodaki değer kullanıcı tarafından düzenlenebilir; şekli doğrulanmadan
 * kabul edilirse bozuk bir `userId` tüm satırları damgalayabilir.
 */
function parse(raw: string | null): Identity | null {
	if (!raw) return null;
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value !== "object" || value === null) return null;

		const { kind, userId, email } = value as Record<string, unknown>;
		if (typeof userId !== "string" || userId.length === 0) return null;

		if (kind === "local") return { kind: "local", userId };
		if (kind === "account" && typeof email === "string" && email.length > 0) {
			return { kind: "account", userId, email };
		}
		return null;
	} catch {
		return null;
	}
}

function hydrate(): Identity {
	if (identity) return identity;

	// Prerender sırasında (statik export) depo yoktur; kimlik anonimdir.
	if (typeof window === "undefined") return LOCAL_IDENTITY;

	identity = parse(window.localStorage.getItem(IDENTITY_STORAGE_KEY))
		?? LOCAL_IDENTITY;
	return identity;
}

export function currentIdentity(): Identity {
	return hydrate();
}

/** Repository'nin her satırı damgalarken kullandığı kimlik. */
export function currentUserId(): string {
	return hydrate().userId;
}

/**
 * Kimliği değiştirir ve dinleyicileri uyarır.
 *
 * Yalnızca kimlik sağlayıcısı (`lib/auth/auth.provider.ts`) çağırır. Veriyi
 * yeni kimliğe taşımak ayrı bir adımdır — `progressRepository.reassignOwner`.
 * İkisi bilinçli olarak ayrıdır: damgalama sırasında bir hata olursa kimlik
 * değişmemiş olur ve kullanıcı verisi sahipsiz kalmaz.
 */
export function setIdentity(next: Identity): void {
	identity = next;

	if (typeof window !== "undefined") {
		if (next.kind === "local") {
			window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
		} else {
			window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(next));
		}
	}

	for (const listener of listeners) listener(next);
}

export function subscribeIdentity(
	listener: (identity: Identity) => void,
): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
