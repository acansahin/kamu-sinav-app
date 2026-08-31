import { type RedeemRecord, isRedemptionValid } from "@/lib/billing/redeem";

/**
 * Kullanılmış erişim kodunun cihazdaki kaydı.
 *
 * ⚠️ **Hak önbelleğinden AYRI bir anahtarda durur.** Aynı kayda yazılamaz:
 * `resolveEntitlement` her başarılı Play sorgusunda hak önbelleğinin üzerine
 * yazıyor — `false` bile olsa, çünkü iade edilen bir satın alma böyle geri
 * alınıyor. Kod hakkı oraya karışsaydı, kodu kullanmış bir cihazda ilk
 * `getPurchases()` cevabı kodu SESSİZCE siler ve kullanıcı erişimini
 * kaybederdi. İkincisi: `needsLossConfirmation` önbellekteki `true`ya bakıp
 * fazladan bir Play sorgusu tetikliyor; kod hakkı oraya sızsaydı hiç satın
 * alma yapmamış her kullanıcı her açılışta iki kez sorgu üretirdi.
 *
 * Dexie DEĞİL, `localStorage`:
 * `entitlement-cache.ts`teki dört gerekçenin aynısı geçerli — özellikle
 * `exportAll()`/`importAll()`: kod Dexie'de dursaydı Ayarlar'dan alınan yedek
 * dosyası, herkese dağıtılabilir bir lisans anahtarına dönüşürdü.
 */

export const REDEEM_STORAGE_KEY = "kamu-sinav-kod";

/** Depodaki değer kullanıcı tarafından düzenlenebilir; şekli doğrulanmadan kabul edilmez. */
export function parseRedeemRecord(raw: string | null): RedeemRecord | null {
	if (!raw) return null;
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value !== "object" || value === null) return null;

		const { hash, redeemedAt } = value as Record<string, unknown>;
		if (typeof hash !== "string") return null;

		return {
			hash,
			redeemedAt: typeof redeemedAt === "string" ? redeemedAt : "",
		};
	} catch {
		return null;
	}
}

export function readRedeemRecord(): RedeemRecord | null {
	if (typeof window === "undefined") return null;
	try {
		return parseRedeemRecord(window.localStorage.getItem(REDEEM_STORAGE_KEY));
	} catch {
		// Gizli modda erişim de fırlatabilir; kod yoksayılır, kilitler kalır.
		return null;
	}
}

/**
 * Kaydı yazar. Başarısız olursa `false` döner — ve bu SESSİZCE GEÇİLEMEZ:
 * hak önbelleğinden farklı olarak burada geri düşülecek bir kaynak yoktur
 * (Play'e sorulamaz), yani yazma başarısızsa kod uygulama kapanınca kaybolur.
 * Arayüz bunu kullanıcıya söylemek zorunda.
 */
export function writeRedeemRecord(record: RedeemRecord): boolean {
	if (typeof window === "undefined") return false;
	try {
		window.localStorage.setItem(REDEEM_STORAGE_KEY, JSON.stringify(record));
		return true;
	} catch {
		return false;
	}
}

/**
 * Cihazda GEÇERLİ bir kod kayıtlı mı?
 *
 * Kayıt her okunduğunda listeye karşı yeniden doğrulanır; iptal edilen bir kod
 * böylece bir sonraki sürümde kendiliğinden hükümsüz kalır.
 */
export function hasValidRedemption(): boolean {
	return isRedemptionValid(readRedeemRecord());
}
