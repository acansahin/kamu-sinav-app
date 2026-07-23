/**
 * Kimlik doğrulama hataları ve kullanıcı diline çevrilmeleri.
 *
 * Bu modül HİÇBİR ŞEY İÇE AKTARMAZ ve öyle kalmalıdır. Hem sağlayıcı
 * sözleşmesi (`auth.provider.ts`) hem Supabase uygulaması
 * (`supabase.provider.ts`) buradan besleniyor; hata sınıfları ikisinden
 * birinde dursaydı aralarında çalışma anı döngüsü oluşurdu.
 *
 * Supabase mesajları İngilizcedir ve teknik terimler içerir ("invalid token",
 * "rate limit exceeded"). Hedef kitle kamu personeli; ekranda gördüğü metin
 * ne olduğunu ve NE YAPACAĞINI söylemeli (PROJECT_PLAN.md §2, Persona 1).
 */

/**
 * Hesap özelliği bu derlemede mevcut değil.
 *
 * Ayrı bir tip olmasının sebebi, arayüzün "bir şeyler ters gitti" ile
 * "bu özellik henüz yok" durumlarını ayırt edebilmesi: ilki yeniden denemeyi,
 * ikincisi açıklamayı gerektirir.
 */
export class AuthUnavailableError extends Error {
	constructor(
		message = "Hesap özelliği henüz kullanıma açık değil. İlerlemen bu cihazda güvende.",
	) {
		super(message);
		this.name = "AuthUnavailableError";
	}
}

/**
 * Kullanıcıya gösterilmeye hazır, geçici kimlik doğrulama hatası.
 *
 * `AuthUnavailableError`'dan ayrıdır: bu "şimdi olmadı, tekrar dene",
 * diğeri "bu özellik bu derlemede yok" demektir.
 */
export class AuthRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthRequestError";
	}
}

/** Supabase `AuthError` benzeri nesne — istemciye bağımlı olmamak için dar tutuldu. */
export interface AuthErrorLike {
	message?: string;
	code?: string;
	status?: number;
}

const GENERIC =
	"Bir sorun oluştu. Bağlantını kontrol edip yeniden dener misin?";

/**
 * Eşleme mesaj metnine değil, önce `code` alanına bakar; Supabase mesaj
 * metinlerini sürümler arasında değiştirebilir, kodlar daha kararlıdır.
 */
export function describeAuthError(error: AuthErrorLike | null): string {
	if (!error) return GENERIC;

	const code = error.code ?? "";
	const message = (error.message ?? "").toLowerCase();

	// Hız sınırı: kullanıcı arka arkaya kod istemiştir.
	if (
		code === "over_email_send_rate_limit" ||
		code === "over_request_rate_limit" ||
		error.status === 429
	) {
		return "Çok sık kod istendi. Bir dakika bekleyip yeniden dene.";
	}

	// Yanlış veya süresi geçmiş kod — en sık görülecek hata.
	if (
		code === "otp_expired" ||
		message.includes("token has expired") ||
		message.includes("invalid token")
	) {
		return "Kod geçersiz veya süresi dolmuş. Yeni bir kod iste.";
	}

	if (code === "validation_failed" || message.includes("invalid email")) {
		return "E-posta adresi geçerli görünmüyor. Yazımını kontrol et.";
	}

	if (code === "email_address_not_authorized") {
		return "Bu e-posta adresine kod gönderilemiyor. Farklı bir adres dene.";
	}

	if (code === "signup_disabled" || code === "email_provider_disabled") {
		return "Hesap açma şu anda kapalı. Daha sonra tekrar dene.";
	}

	// Ağ hatası: fetch başarısız olduğunda Supabase bunu böyle sarar.
	if (
		code === "network_error" ||
		message.includes("failed to fetch") ||
		message.includes("network")
	) {
		return "İnternet bağlantısı kurulamadı. Çevrimdışıyken giriş yapılamaz — ama çalışmaya devam edebilirsin.";
	}

	return GENERIC;
}
