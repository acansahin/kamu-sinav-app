import type { Entitlement } from "@/lib/billing/entitlement";

/**
 * Hakkın yerel önbelleği.
 *
 * ⚠️ Bu bir KAYNAK değil, önbellektir. Hakkın kaynağı her zaman Google Play'in
 * `getPurchases()` cevabıdır; buradaki değer yalnızca Play'e ulaşılamadığında
 * (çevrimdışı, Play Store yok) kullanılır ve her başarılı sorguda —
 * `false` bile olsa — üzerine yazılır. İade edilen bir satın alma böylece
 * kendiliğinden geri alınır.
 *
 * NEDEN Dexie DEĞİL de localStorage:
 *
 *  1. `progressRepository.exportAll()` tüm Dexie tablolarını JSON'a yazar,
 *     `importAll()` geri okur. Hak orada dursaydı, satın almış bir kullanıcının
 *     Ayarlar'dan aldığı yedek dosyası çalışan bir lisans anahtarına dönüşürdü.
 *  2. "Depolama yokluğu uygulamayı kilitlemez" (AGENTS.md). IndexedDB
 *     açılamazsa `useLiveQuery` sonsuza kadar `undefined` döner — parasını
 *     ödemiş kullanıcı kilitli kalırdı. Mümkün olan en kötü hata.
 *  3. Dexie satırları `userId` damgalıdır ve kimlik değişiminde taşınır. Bir
 *     Play satın alması ise Google hesabına bağlıdır, uygulamanın yerel
 *     kimliğine değil; senkron geldiğinde bu kayıt sunucuya GİTMEMELİDİR.
 *  4. Kilit kararı ilk boyamayı belirler; asenkron bir okuma içerik
 *     yanıp sönmesine yol açardı (`preferences.ts` ile aynı gerekçe).
 *
 * Değer kurcalanabilir — root'lu bir cihazda bayrak elle yazılabilir.
 * Şifrelemek işe yaramaz (anahtar da pakettedir) ve zaten içerik pakette açık
 * duruyor; bu bilinçli olarak kabul edilmiş bir sınırdır.
 */

export const ENTITLEMENT_STORAGE_KEY = "kamu-sinav-erisim";

export interface CachedEntitlement {
	/** Son başarılı Play sorgusunun sonucu. */
	fullAccess: boolean;
	/**
	 * Bu kurulum bir Android paketi mi?
	 *
	 * Ortam tespiti (`Capacitor.isNativePlatform()`) dinamik içe aktarma
	 * gerektirdiği için asenkrondur. Sonucu önbelleğe almak, ilk açılıştan
	 * sonraki her açılışta kilit kararının SENKRON verilmesini sağlar; aksi
	 * hâlde her sayfa açılışında bir kare iskelet görünürdü.
	 */
	native: boolean;
	/** ISO tarih — teşhis için; karar bu alana bakmaz. */
	checkedAt: string;
}

/**
 * Depodaki değer kullanıcı tarafından düzenlenebilir. Şekli doğrulanmadan
 * kabul edilirse bozuk bir kayıt arayüzü tanımsız bir hâle sokabilir; bu
 * yüzden `identity.ts`'teki `parse()` ile aynı savunmacı okuma uygulanır.
 */
export function parseCachedEntitlement(
	raw: string | null,
): CachedEntitlement | null {
	if (!raw) return null;
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value !== "object" || value === null) return null;

		const { fullAccess, native, checkedAt } = value as Record<string, unknown>;
		if (typeof fullAccess !== "boolean") return null;
		if (typeof native !== "boolean") return null;

		return {
			fullAccess,
			native,
			checkedAt: typeof checkedAt === "string" ? checkedAt : "",
		};
	} catch {
		return null;
	}
}

/** Önbelleği okur; yoksa veya bozuksa `null`. */
export function readEntitlementCache(): CachedEntitlement | null {
	if (typeof window === "undefined") return null;
	try {
		return parseCachedEntitlement(
			window.localStorage.getItem(ENTITLEMENT_STORAGE_KEY),
		);
	} catch {
		// Gizli modda localStorage erişimi de fırlatabilir; hak yoksayılır,
		// kullanıcı "Satın alımları geri yükle" ile ilerleyebilir.
		return null;
	}
}

/** Önbelleği yazar. Yazma başarısız olursa sessizce geçilir — karar zaten bellekte. */
export function writeEntitlementCache(entry: CachedEntitlement): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			ENTITLEMENT_STORAGE_KEY,
			JSON.stringify(entry),
		);
	} catch {
		/* kota dolu veya depo kapalı — önbellek isteğe bağlıdır */
	}
}

/**
 * Önbellekten türetilen başlangıç hakkı.
 *
 * `null` dönmesi "henüz bilinmiyor" demektir ve arayüz o hâlde iskelet
 * gösterir. Sunucuda (statik ön üretim) her zaman `null`dur.
 */
export function entitlementFromCache(
	cached: CachedEntitlement | null,
): Entitlement | null {
	if (!cached) return null;
	return { paywallActive: cached.native, fullAccess: cached.fullAccess };
}
