import type { CachedEntitlement } from "@/lib/billing/entitlement-cache";
import type { Entitlement } from "@/lib/billing/entitlement";

/**
 * Play cevabı ile önbelleği tek bir hakka indirger — saf.
 *
 * Sağlayıcıdan ayrı durmasının sebebi test edilebilirlik: iade, çevrimdışı ve
 * ilk açılış senaryolarının tamamı eklenti mock'lamadan doğrulanabilir.
 */

export interface ResolveInput {
	/** Ortam tespiti. `false` ise paywall hiç uygulanmaz (tarayıcı). */
	native: boolean;
	/** Son okunan önbellek; yoksa `null`. */
	cached: CachedEntitlement | null;
	/**
	 * Play sorgusunun sonucu:
	 *   `true`/`false` → sorgu BAŞARILI, cevap bu
	 *   `null`         → sorgu yapılamadı (çevrimdışı, Play yok, hata)
	 */
	playResult: boolean | null;
}

export interface ResolveOutput {
	entitlement: Entitlement;
	/** Yazılacak önbellek; `null` ise önbellek olduğu gibi bırakılır. */
	cacheUpdate: CachedEntitlement | null;
}

export function resolveEntitlement(
	input: ResolveInput,
	now: Date = new Date(),
): ResolveOutput {
	const { native, cached, playResult } = input;

	// Tarayıcı: paywall yok. Önbellekteki eski bir `true` bile kilitleri
	// etkilemez, ama `native: false` olarak tazelenir ki sonraki açılışta
	// senkron karar doğru çıksın.
	if (!native) {
		return {
			entitlement: { paywallActive: false, fullAccess: false },
			cacheUpdate: {
				fullAccess: cached?.fullAccess ?? false,
				native: false,
				checkedAt: now.toISOString(),
			},
		};
	}

	// Sorgu başarılı: cevap ne olursa olsun otorite odur. `false` dönmesi
	// iade/iptal anlamına gelir ve önbellekteki `true` SİLİNMEK zorundadır —
	// aksi hâlde iade edilen kullanıcı süresiz erişim korurdu.
	if (playResult !== null) {
		return {
			entitlement: { paywallActive: true, fullAccess: playResult },
			cacheUpdate: {
				fullAccess: playResult,
				native: true,
				checkedAt: now.toISOString(),
			},
		};
	}

	// Sorgu yapılamadı: önbelleğe düşülür. Çevrimdışı bir kullanıcının satın
	// aldığı erişimi kaybetmemesi, iade edilmiş bir hakkın bir süre daha
	// açık kalmasından daha önemlidir.
	return {
		entitlement: { paywallActive: true, fullAccess: cached?.fullAccess ?? false },
		cacheUpdate: null,
	};
}
