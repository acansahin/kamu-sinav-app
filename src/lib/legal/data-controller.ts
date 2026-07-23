/**
 * Veri sorumlusunun kimlik bilgileri — KVKK m.10/1-a zorunlu unsuru.
 *
 * ⚠️ BU DEĞERLER DOLDURULMADAN HESAP ÖZELLİĞİ GERÇEK KULLANICILARA AÇILAMAZ.
 * Aydınlatma metninde veri sorumlusunun kim olduğu ve kendisine nasıl
 * ulaşılacağı açıkça yazmak zorundadır; boş bırakılan bir metin yükümlülüğü
 * karşılamaz.
 *
 * Boş kaldıkları sürece `/gizlilik` sayfası görünür bir uyarı gösterir —
 * eksikliğin sessizce yayına çıkmaması için.
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

/** Aydınlatma metninin yayımlanabilir olması için gereken asgari alanlar dolu mu? */
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
 * Metnin en son ne zaman gözden geçirildiği.
 *
 * Konu özetlerindeki `lastVerifiedAt` rozetiyle aynı mantık: kullanıcı,
 * okuduğu metnin ne kadar güncel olduğunu görebilmeli. Metin her
 * değiştiğinde burası da güncellenir.
 */
export const PRIVACY_NOTICE_UPDATED_AT = "2026-07-23";
