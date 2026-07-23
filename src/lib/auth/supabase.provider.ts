// `auth.provider` yalnızca TİP olarak alınır; çalışma anı bağımlılığı
// oluşsaydı sağlayıcı seçimi orada olduğu için modüller döngüye girerdi.
import type { IAuthProvider } from "./auth.provider";
import {
	AuthRequestError,
	AuthUnavailableError,
	describeAuthError,
} from "./auth-errors";
import { type Identity, LOCAL_IDENTITY, currentIdentity } from "./identity";
import { getSupabaseClient } from "./supabase-client";

/**
 * Supabase ile e-posta + tek kullanımlık kod kimlik doğrulaması.
 *
 * Kodun uzunluğu SUNUCU AYARIDIR (Supabase'de 6-10 arası); arayüz bir aralık
 * kabul eder ve doğrulamayı sunucuya bırakır. Bkz. `features/account`.
 *
 * ⚠️ Supabase'in VARSAYILAN e-posta şablonları kod değil, sihirli BAĞLANTI
 * gönderir. Kodun gelmesi için panelde Authentication → Emails
 * altındaki İKİ şablona da `{{ .Token }}` eklenmelidir: **Confirm signup**
 * (adresi ilk kez gören kullanıcı) ve **Magic Link** (daha önce giriş yapmış
 * kullanıcı). Supabase hangisini göndereceğine kullanıcının durumuna göre
 * karar verir; yalnızca birini düzenlemek "bende çalışıyor ama yeni
 * kaydolanlarda çalışmıyor" hatasını üretir. Kurulum README.md içindedir.
 *
 * `emailRedirectTo` bilinçli olarak GEÇİLMEZ: dönüş adresi vermek Supabase'i
 * bağlantı üretmeye teşvik eder ve bu uygulamanın sabit bir dönüş adresi
 * yoktur (Capacitor WebView kökten, GitHub Pages alt dizinden servis eder).
 */
export class SupabaseAuthProvider implements IAuthProvider {
	current(): Identity {
		return currentIdentity();
	}

	async requestCode(email: string): Promise<void> {
		const supabase = await this.client();

		const { error } = await supabase.auth.signInWithOtp({
			email,
			// Hesabı olmayan kullanıcı ilk kodla hesabını açar; ayrı bir
			// "kayıt ol" adımı sormak bu kitle için gereksiz sürtünme olurdu.
			options: { shouldCreateUser: true },
		});

		if (error) throw new AuthRequestError(describeAuthError(error));
	}

	async verifyCode(email: string, code: string): Promise<Identity> {
		const supabase = await this.client();

		const { data, error } = await supabase.auth.verifyOtp({
			email,
			token: code,
			// "email" tipi hem yeni hesabı hem mevcut hesabın girişini kapsar.
			type: "email",
		});

		if (error) throw new AuthRequestError(describeAuthError(error));

		const user = data.user;
		if (!user) {
			throw new AuthRequestError(
				"Giriş tamamlanamadı. Yeni bir kod isteyip tekrar dene.",
			);
		}

		return { kind: "account", userId: user.id, email: user.email ?? email };
	}

	async signOut(): Promise<void> {
		// Sunucuya ulaşılamasa bile yerel oturum kapanmalıdır; çıkış yapmak
		// isteyen kullanıcı ağ yüzünden hesabında kilitli kalmamalı.
		try {
			const supabase = await getSupabaseClient();
			await supabase?.auth.signOut();
		} catch {
			// Yutulur: yerel çıkış `session.ts` tarafında zaten tamamlandı.
		}
	}

	/**
	 * Sunucudaki oturumun hâlâ geçerli olup olmadığını söyler.
	 *
	 * Kimlik yerelde senkron tutulur (`identity.ts`), ama oturum sunucuda iptal
	 * edilmiş veya süresi dolmuş olabilir. Açılışta uzlaştırma bunu kullanır.
	 * Ağ yoksa `null` yerine "bilinmiyor" anlamında hata fırlatır — çevrimdışı
	 * açılışta kullanıcıyı oturumdan atmamak için bu ayrım şart.
	 */
	async currentServerIdentity(): Promise<Identity | null> {
		const supabase = await getSupabaseClient();
		if (!supabase) return LOCAL_IDENTITY;

		const { data, error } = await supabase.auth.getSession();
		if (error) throw new AuthRequestError(describeAuthError(error));

		const user = data.session?.user;
		if (!user) return null;

		return { kind: "account", userId: user.id, email: user.email ?? "" };
	}

	private async client() {
		const supabase = await getSupabaseClient();
		if (!supabase) throw new AuthUnavailableError();
		return supabase;
	}
}
