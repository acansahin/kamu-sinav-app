/**
 * Satın alma hataları ve kullanıcı diline çevrilmeleri.
 *
 * Bu modül HİÇBİR ŞEY İÇE AKTARMAZ ve öyle kalmalıdır — hem sağlayıcı
 * sözleşmesi hem native uygulama buradan besleniyor (`auth-errors.ts` ile
 * aynı gerekçe: aralarında çalışma anı döngüsü oluşmasın).
 *
 * Play Billing hataları İngilizce ve kod numaralıdır ("BILLING_UNAVAILABLE",
 * "ITEM_ALREADY_OWNED"). Hedef kitle kamu personeli; ekranda gördüğü metin
 * ne olduğunu ve NE YAPACAĞINI söylemeli (PROJECT_PLAN.md §2, Persona 1).
 */

/** Kullanıcı Play ekranını kapattı. Hata DEĞİLDİR; arayüz uyarı tonu kullanmaz. */
export class PurchaseCancelledError extends Error {
	constructor(message = "Satın alma tamamlanmadı.") {
		super(message);
		this.name = "PurchaseCancelledError";
	}
}

/**
 * Satın alma onay bekliyor (nakit ödeme, aile onayı).
 *
 * Ayrı bir tip olması şart: para henüz alınmamıştır ve erişim AÇILMAMALIDIR,
 * ama bu bir başarısızlık da değildir — kullanıcıya ne olacağı anlatılır.
 */
export class PurchasePendingError extends Error {
	constructor(
		message = "Satın almanız onay bekliyor. Onaylandığında uygulamayı açıp “Satın alımları geri yükle”ye dokunun.",
	) {
		super(message);
		this.name = "PurchasePendingError";
	}
}

/** Bu cihazda/derlemede Play üzerinden satın alma yapılamıyor. */
export class BillingUnavailableError extends Error {
	constructor(
		message = "Bu cihazda Google Play üzerinden satın alma kullanılamıyor. Uygulamayı Google Play'den kurduğunuzdan ve Play Store'un güncel olduğundan emin olun.",
	) {
		super(message);
		this.name = "BillingUnavailableError";
	}
}

/** Kullanıcıya gösterilmeye hazır, geçici satın alma hatası. */
export class PurchaseFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PurchaseFailedError";
	}
}

/** Play Billing hata nesnesi — eklentiye bağımlı olmamak için dar tutuldu. */
export interface BillingErrorLike {
	message?: string;
	code?: string | number;
	responseCode?: number;
}

const GENERIC =
	"Satın alma tamamlanamadı. Lütfen daha sonra tekrar deneyin.";

/**
 * Play Billing yanıt kodları.
 *
 * Eşleme mesaj metnine değil önce koda bakar: eklenti ve Play kütüphanesi
 * mesaj metinlerini sürümler arasında değiştirir, kodlar kararlıdır.
 * https://developer.android.com/reference/com/android/billingclient/api/BillingClient.BillingResponseCode
 */
const RESPONSE = {
	userCancelled: 1,
	serviceUnavailable: 2,
	billingUnavailable: 3,
	itemUnavailable: 4,
	itemAlreadyOwned: 7,
	networkError: 12,
} as const;

function codeOf(error: BillingErrorLike): number | null {
	if (typeof error.responseCode === "number") return error.responseCode;
	if (typeof error.code === "number") return error.code;
	if (typeof error.code === "string") {
		const parsed = Number(error.code);
		return Number.isInteger(parsed) ? parsed : null;
	}
	return null;
}

/** Ham eklenti hatasını tipli bir hataya çevirir. */
export function toBillingError(error: unknown): Error {
	if (
		error instanceof PurchaseCancelledError ||
		error instanceof PurchasePendingError ||
		error instanceof BillingUnavailableError ||
		error instanceof PurchaseFailedError
	) {
		return error;
	}

	const like: BillingErrorLike =
		typeof error === "object" && error !== null
			? (error as BillingErrorLike)
			: {};
	const code = codeOf(like);
	const message = (like.message ?? "").toLowerCase();

	if (code === RESPONSE.userCancelled || message.includes("cancel")) {
		return new PurchaseCancelledError();
	}

	if (
		code === RESPONSE.billingUnavailable ||
		code === RESPONSE.serviceUnavailable ||
		message.includes("billing unavailable") ||
		message.includes("service unavailable")
	) {
		return new BillingUnavailableError();
	}

	if (code === RESPONSE.itemUnavailable || message.includes("item unavailable")) {
		return new PurchaseFailedError(
			"Ürün şu anda mağazada bulunamadı. Kısa süre sonra tekrar deneyin.",
		);
	}

	if (code === RESPONSE.networkError || message.includes("network")) {
		return new PurchaseFailedError(
			"Bağlantı kurulamadı. Ücret alınmadıysa tekrar deneyebilirsiniz; alındıysa “Satın alımları geri yükle” yeterlidir.",
		);
	}

	return new PurchaseFailedError(GENERIC);
}

/** Satın alma zaten sahip olunan bir ürüne mi yapıldı? */
export function isAlreadyOwned(error: unknown): boolean {
	const like: BillingErrorLike =
		typeof error === "object" && error !== null
			? (error as BillingErrorLike)
			: {};
	return (
		codeOf(like) === RESPONSE.itemAlreadyOwned ||
		(like.message ?? "").toLowerCase().includes("already owned")
	);
}
