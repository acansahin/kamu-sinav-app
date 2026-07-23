import { AuthUnavailableError } from "./auth-errors";
import {
	type Identity,
	LOCAL_IDENTITY,
	currentIdentity,
	setIdentity,
} from "./identity";
import { isAccountConfigured } from "./supabase-client";
import { SupabaseAuthProvider } from "./supabase.provider";

/**
 * Kimlik doğrulama sözleşmesi.
 *
 * İki uygulaması var ve hangisinin bağlanacağı DERLEME anında belli olur:
 * Supabase anahtarları verilmişse `SupabaseAuthProvider`, verilmemişse
 * `LocalAuthProvider`. Uygulamanın anahtarsız da eksiksiz çalışması bir ürün
 * sözüdür (PROJECT_PLAN.md §4, taahhüt 6: "hesap gerekmez") ve CI'da anahtar
 * bulunmaz.
 *
 * Sözleşme neden e-posta + KOD üzerine kurulu (sihirli bağlantı değil):
 * kod akışı hiçbir yönlendirme URL'si istemez. Uygulama hem Capacitor
 * WebView'de hem GitHub Pages'te alt dizinde (`PAGES_BASE_PATH`) çalışıyor;
 * dönüş adresi bu iki hedefte farklı ve WebView'de derin bağlantı kurulumu
 * gerektirirdi. Tek kullanımlık kod her iki hedefte de aynı şekilde çalışır ve
 * şifre sıfırlama akışını tamamen ortadan kaldırır — hedef kitlenin yaş
 * profili düşünüldüğünde en az sürtünmeli yol (PROJECT_PLAN.md §2, Persona 1).
 */
export interface IAuthProvider {
	/** Cihazdaki mevcut kimlik. Senkron; ağ istemez. */
	current(): Identity;
	/** E-posta adresine tek kullanımlık giriş kodu gönderir. */
	requestCode(email: string): Promise<void>;
	/** Kodu doğrular ve hesabı açar. */
	verifyCode(email: string, code: string): Promise<Identity>;
	signOut(): Promise<void>;
	/**
	 * Sunucudaki oturumun durumu: kimlik varsa o, oturum kapalıysa `null`.
	 *
	 * Ağ yoksa HATA FIRLATIR — "oturum yok" ile "bilmiyorum" ayrı şeylerdir.
	 * Çevrimdışı açılışta kullanıcı oturumundan atılmamalı.
	 */
	currentServerIdentity(): Promise<Identity | null>;
}

export { AuthUnavailableError, AuthRequestError } from "./auth-errors";

/**
 * Sunucusuz cihaz kimliği.
 *
 * `current()` gerçek kimliği döndürür — sabit `LOCAL_IDENTITY` değil: kullanıcı
 * daha önce bir hesaba bağlanmışsa damgalanmış veriyi görmez hâle gelmemeliyiz.
 */
class LocalAuthProvider implements IAuthProvider {
	current(): Identity {
		return currentIdentity();
	}

	async requestCode(): Promise<void> {
		throw new AuthUnavailableError();
	}

	async verifyCode(): Promise<Identity> {
		throw new AuthUnavailableError();
	}

	async signOut(): Promise<void> {
		setIdentity(LOCAL_IDENTITY);
	}

	/** Sunucu yok; doğru cevap "oturum kapalı" değil, "her zaman yerel". */
	async currentServerIdentity(): Promise<Identity> {
		return LOCAL_IDENTITY;
	}
}

export const authProvider: IAuthProvider = isAccountConfigured()
	? new SupabaseAuthProvider()
	: new LocalAuthProvider();
