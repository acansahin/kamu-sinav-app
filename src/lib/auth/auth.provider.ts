import {
	type Identity,
	LOCAL_IDENTITY,
	currentIdentity,
	setIdentity,
} from "./identity";

/**
 * Kimlik doğrulama sözleşmesi.
 *
 * MVP'de `LocalAuthProvider` (tek anonim cihaz kullanıcısı) bağlıdır; Faz 3'ün
 * ikinci diliminde yerine `SupabaseAuthProvider` geçecek ve çağıran hiçbir kod
 * değişmeyecek (PROJECT_PLAN.md §8, "Kimlik doğrulama tasarımı").
 *
 * Sözleşme neden e-posta + KOD üzerine kurulu (sihirli bağlantı değil):
 * kod akışı hiçbir yönlendirme URL'si istemez. Uygulama hem Capacitor
 * WebView'de hem GitHub Pages'te alt dizinde (`PAGES_BASE_PATH`) çalışıyor;
 * dönüş adresi bu iki hedefte farklı ve WebView'de derin bağlantı kurulumu
 * gerektirirdi. Altı haneli kod her iki hedefte de aynı şekilde çalışır ve
 * şifre sıfırlama akışını tamamen ortadan kaldırır — hedef kitlenin yaş
 * profili düşünüldüğünde en az sürtünmeli yol (PROJECT_PLAN.md §2, Persona 1).
 */
export interface IAuthProvider {
	/** Cihazdaki mevcut kimlik. Senkron; ağ istemez. */
	current(): Identity;
	/** E-posta adresine altı haneli tek kullanımlık kod gönderir. */
	requestCode(email: string): Promise<void>;
	/** Kodu doğrular ve hesabı açar. */
	verifyCode(email: string, code: string): Promise<Identity>;
	signOut(): Promise<void>;
}

/**
 * Hesap özelliği bu yapıda mevcut değil.
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
 * Sunucusuz cihaz kimliği.
 *
 * `current()` gerçek kimliği döndürür — sabit `LOCAL_IDENTITY` değil: kullanıcı
 * daha önce bir hesaba bağlanmışsa (Dilim 2) ve sağlayıcı geçici olarak yereli
 * gösteriyorsa, damgalanmış veriyi görmez hâle gelmemeliyiz.
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
}

export const authProvider: IAuthProvider = new LocalAuthProvider();
