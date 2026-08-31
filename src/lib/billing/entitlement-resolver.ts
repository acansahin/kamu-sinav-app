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
	/**
	 * Cihazda geçerli bir erişim kodu kayıtlı mı? (`lib/billing/redeem.ts`)
	 *
	 * Play cevabıyla VEYA'lanır ama önbelleğe ASLA yazılmaz — gerekçesi
	 * `redeem-store.ts` başlığında: hak önbelleği her sorguda üzerine
	 * yazıldığı için kod hakkı oraya girseydi ilk `getPurchases()` cevabı
	 * onu silerdi.
	 */
	promo: boolean;
}

export interface ResolveOutput {
	entitlement: Entitlement;
	/** Yazılacak önbellek; `null` ise önbellek olduğu gibi bırakılır. */
	cacheUpdate: CachedEntitlement | null;
}

/**
 * Hakkın KAYBEDİLDİĞİ cevabı bir kez daha doğrulamalı mıyız?
 *
 * Eklentinin Android tarafı `queryPurchasesAsync` başarısız olduğunda çağrıyı
 * reddetmez, BOŞ LİSTEYLE çözer (`NativePurchasesPlugin.java`, `getPurchases`).
 * Yani "sorgu yapılamadı = `null`" sözleşmesi yalnızca bağlantı hiç
 * kurulamadığında işler; bağlantı kurulup sorgu düşerse cevap `false` gibi
 * görünür. `resolveEntitlement` bunu otorite sayar, önbellekteki `true`yu siler
 * ve satın almış kullanıcı erişimini kalıcı olarak kaybeder.
 *
 * Asıl önlem `native.provider.ts` içindeki sıralamadır (yarışı ortadan
 * kaldırır); bu ikinci savunma hattıdır: hakkı OLAN bir kullanıcıdan onu
 * almadan önce bir kez daha sorulur. Bedeli yalnızca bu dar durumda fazladan
 * tek bir Play çağrısıdır — hakkı olmayan kullanıcı (asıl yaygın hâl) ikinci
 * sorguyu hiç tetiklemez. İade gerçekten yapılmışsa ikinci sorgu da `false`
 * döner ve hak yine kaldırılır.
 */
export function needsLossConfirmation(
	cached: CachedEntitlement | null,
	playResult: boolean | null,
): boolean {
	return playResult === false && cached?.fullAccess === true;
}

export function resolveEntitlement(
	input: ResolveInput,
	now: Date = new Date(),
): ResolveOutput {
	const { native, cached, playResult, promo } = input;

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
			entitlement: { paywallActive: true, fullAccess: playResult || promo },
			cacheUpdate: {
				// Önbellek YALNIZCA Play'in cevabını taşır; kod hakkı buraya
				// karışırsa iade tespiti ve `needsLossConfirmation` bozulur.
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
		entitlement: {
			paywallActive: true,
			fullAccess: (cached?.fullAccess ?? false) || promo,
		},
		cacheUpdate: null,
	};
}
