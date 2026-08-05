/**
 * Kilit kararları — saf mantık.
 *
 * Bu modül React görmez, ağ istemez ve depoya dokunmaz; `lib/` altındaki diğer
 * saf mantıkla (puanlama, seçici, hakimiyet) aynı kuralı izler. Hakkın NEREDEN
 * geldiği (`billing.provider.ts`) ile hakkın NE AÇTIĞI (burası) bilinçli olarak
 * ayrıdır: ikincisi tamamen testlenebilir kalır.
 *
 * ⚠️ Bu kilitler bir GÖRÜNÜRLÜK kararıdır, güvenlik sınırı değildir. Statik
 * export'ta sorular, şıklar ve açıklamalar sayfalara gömülüdür; pakete erişen
 * biri içeriğe her hâlükârda ulaşır. Sunucu tarafı bir kapı `output: "export"`
 * altında mimari olarak imkânsızdır (bkz. AGENTS.md).
 */

export interface Entitlement {
	/**
	 * Paywall bu ÇALIŞMA ORTAMINDA etkin mi?
	 *
	 * Yalnızca Android paketinde `true`. Tarayıcıda (GitHub Pages, geliştirme
	 * sunucusu, Playwright) `false`tur ve o zaman hiçbir kilit uygulanmaz —
	 * kilit rozeti bile gösterilmez, çünkü satın alınamayan bir şeyi kilitli
	 * göstermek olmayan bir özelliği varmış gibi göstermek olur
	 * (PROJECT_PLAN.md §3.2).
	 *
	 * `fullAccess`ten ayrı tutulmasının sebebi budur: tek bir `unlocked`
	 * bayrağı "kilit yok" ile "kilit var ama açık" durumlarını birbirine
	 * karıştırırdı ve arayüz hangisini göstereceğini bilemezdi.
	 */
	paywallActive: boolean;
	/** Tam erişim satın alınmış mı? */
	fullAccess: boolean;
}

/** Kilitlerin hiç uygulanmadığı hâl — tarayıcı ve ön üretim için. */
export const OPEN_ENTITLEMENT: Entitlement = {
	paywallActive: false,
	fullAccess: false,
};

/**
 * Ücretsiz ön gösterim: tek bir konu.
 *
 * Bu konunun özeti ve ilk testi satın alma olmadan açıktır. Kullanıcı ürünün
 * özet biçimini, soru kalitesini ve mevzuat dayanağı sunumunu gerçek içerikle
 * görür; kalanı satın alma kararına kalır.
 *
 * ⚠️ Bu slug'lar `content/subjects/**` altındaki gerçek kimliklerdir. Konu
 * yeniden adlandırılırsa ücretsiz kapsam SESSİZCE sıfıra düşer ve uygulama
 * "hiçbir şey ücretsiz değil" hâline gelir. `tests/unit/content-integrity`
 * bu eşleşmeyi derleme kapısı olarak doğrular.
 */
export const FREE_SUBJECT_ID = "657-dmk";
export const FREE_TOPIC_SLUG = "genel-hukumler";
export const FREE_TEST_SLUG = "test-1";

/** Ücretsiz konu mu? Karşılaştırma birebir dizedir — `toLowerCase()` YOK. */
function isFreeTopic(subjectId: string, topicSlug: string): boolean {
	return subjectId === FREE_SUBJECT_ID && topicSlug === FREE_TOPIC_SLUG;
}

/**
 * Kısıtlama uygulanıyor mu?
 *
 * Tek bir yerde toplanır ki her kural fonksiyonu aynı iki kapıdan geçsin:
 * paywall etkin değilse ya da tam erişim varsa hiçbir şey kilitli değildir.
 */
function restricted(entitlement: Entitlement): boolean {
	return entitlement.paywallActive && !entitlement.fullAccess;
}

/** Konu özeti okunabilir mi? */
export function isTopicUnlocked(
	subjectId: string,
	topicSlug: string,
	entitlement: Entitlement,
): boolean {
	if (!restricted(entitlement)) return true;
	return isFreeTopic(subjectId, topicSlug);
}

/** Belirli bir test seti çözülebilir mi? */
export function isTestSetUnlocked(
	subjectId: string,
	topicSlug: string,
	testSlug: string,
	entitlement: Entitlement,
): boolean {
	if (!restricted(entitlement)) return true;
	return isFreeTopic(subjectId, topicSlug) && testSlug === FREE_TEST_SLUG;
}

/**
 * Dersin tamamını yazdırma sayfası açık mı?
 *
 * Ücretsiz derste bile kapalıdır: sayfa dersin TÜM konu özetlerini tek belgede
 * basar, yani ücretsiz konunun yanında kilitli olanları da içerir.
 */
export function isSubjectPrintUnlocked(entitlement: Entitlement): boolean {
	return !restricted(entitlement);
}

/**
 * Deneme sınavı açık mı?
 *
 * Ücretsiz dilim tanımlanamaz: deneme havuzun tamamından çeker ve en küçük
 * şablon 20 sorudur — ücretsiz kapsamın iki katı.
 */
export function isExamUnlocked(entitlement: Entitlement): boolean {
	return !restricted(entitlement);
}

/**
 * Aramada soru sonuçları gösterilebilir mi?
 *
 * Arama indeksi her sorunun kökünü, TÜM şıklarını ve açıklamasını taşır
 * (`scripts/build-content.ts`). Açık kalırsa paywall arama kutusundan
 * tamamen atlanır.
 */
export function isQuestionSearchUnlocked(entitlement: Entitlement): boolean {
	return !restricted(entitlement);
}

/**
 * Arama sonucunda konunun metin parçacığı gösterilebilir mi?
 *
 * Konu başlığı zaten konu listesinde açıktır ve gezinme için gereklidir; ama
 * parçacık `keyPoints` ile özet başlıklarından üretilir, yani kilitli özetin
 * içeriğidir. Bu yüzden başlık kalır, parçacık düşer.
 */
export function isTopicSnippetUnlocked(
	subjectId: string,
	topicSlug: string,
	entitlement: Entitlement,
): boolean {
	return isTopicUnlocked(subjectId, topicSlug, entitlement);
}
