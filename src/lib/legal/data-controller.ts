/**
 * Veri sorumlusunun kimlik bilgileri — KVKK m.10/1-a zorunlu unsuru.
 *
 * ⚠️ BU DEĞERLER DOLDURULMADAN HESAP ÖZELLİĞİ GERÇEK KULLANICILARA AÇILAMAZ.
 * Aydınlatma metninde veri sorumlusunun kim olduğu ve kendisine nasıl
 * ulaşılacağı açıkça yazmak zorundadır; boş bırakılan bir metin yükümlülüğü
 * karşılamaz.
 *
 * Eksik kaldıkları sürece `/gizlilik` sayfası görünür bir uyarı gösterir —
 * eksikliğin sessizce yayına çıkmaması için. Neyin "eksik" sayıldığı hesap
 * özelliğinin açık olup olmamasına göre değişir; bkz.
 * `isPrivacyNoticePublishable`.
 *
 * Ad alanı gerçek kişi için "Ad Soyad", tüzel kişi için unvandır. Adres,
 * KVKK başvurularının yazılı olarak gönderilebileceği tebligata esas adres
 * olmalıdır (Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ m.5).
 */
export interface DataController {
	/** Gerçek kişide ad soyad, tüzel kişide ticaret unvanı. */
	name: string;
	/** Başvuruların gönderilebileceği e-posta adresi. */
	email: string;
	/** Yazılı başvurular için tebligata esas adres. */
	address: string;
	/** Varsa KEP adresi; yoksa boş bırakılabilir. */
	kep?: string;
	/** VERBİS kaydı varsa sicil numarası; muafiyet hâlinde boş bırakılır. */
	verbis?: string;
}

export const DATA_CONTROLLER: DataController = {
	name: "",
	email: "",
	address: "",
};

/**
 * Kullanıcıya gösterilebilecek iletişim adresi — yoksa `null`.
 *
 * Adres **tek bir yerden** okunur: `DATA_CONTROLLER.email` doldurulduğu anda
 * ona bağlı bütün yüzeyler (Hakkında, Kullanım Koşulları, Ayarlar'daki hata
 * bildirimi gönderme) kendiliğinden açılır; ikinci bir sabit tanımlanmaz.
 * Boşken hiçbir yüzey adres varmış gibi davranmaz — olmayan özelliği varmış
 * gibi göstermeme ilkesi (PROJECT_PLAN.md §3.2).
 *
 * `null` dönmesi bir hata değil, yayın öncesi normal durumdur; çağıran kod
 * her zaman boş hâli de karşılamak zorundadır.
 */
export function getContactEmail(
	controller: DataController = DATA_CONTROLLER,
): string | null {
	const email = controller.email.trim();
	return email.length > 0 ? email : null;
}

/** Veri sorumlusu künyesinin KVKK'nın saydığı unsurları eksiksiz mi? */
export function isDataControllerComplete(
	controller: DataController = DATA_CONTROLLER,
): boolean {
	return (
		controller.name.trim().length > 0 &&
		controller.email.trim().length > 0 &&
		controller.address.trim().length > 0
	);
}

/**
 * Aydınlatma metni bu derlemede yayımlanabilir mi?
 *
 * Eşik hesap özelliğine bağlıdır ve bu bilinçli bir ayrımdır:
 *
 *  - **Hesap kapalıyken** (Supabase anahtarı yok) uygulama hiçbir kişisel
 *    veriyi cihaz dışına çıkarmaz. Veri sorumlusu sıfatını doğuran bir işleme
 *    faaliyeti yoktur; tebligata esas adres istemek anlamsız olur. Yine de bir
 *    **iletişim kanalı** gerekir: hem içerik hatası/telif bildirimi için, hem
 *    de Google Play geliştirici e-postasını zorunlu tuttuğu için.
 *  - **Hesap açıldığında** e-posta adresi işlenmeye başlar; künyenin tamamı
 *    (ad/unvan ve tebligat adresi) zorunlu olur.
 *
 * Böylece hesapsız bir derleme yalnızca eksik adres yüzünden "yayına hazır
 * değil" uyarısı göstermez, ama anahtar eklendiği anda uyarı kendiliğinden
 * geri gelir.
 */
export function isPrivacyNoticePublishable(
	accountEnabled: boolean,
	controller: DataController = DATA_CONTROLLER,
): boolean {
	if (accountEnabled) return isDataControllerComplete(controller);
	return controller.email.trim().length > 0;
}

/**
 * Metnin en son ne zaman gözden geçirildiği.
 *
 * Konu özetlerindeki `lastVerifiedAt` rozetiyle aynı mantık: kullanıcı,
 * okuduğu metnin ne kadar güncel olduğunu görebilmeli. Metin her
 * değiştiğinde burası da güncellenir.
 */
export const PRIVACY_NOTICE_UPDATED_AT = "2026-07-24";
