import { progressRepository } from "@/lib/repositories/progress.repository";
import { LOCAL_USER_ID } from "@/types/progress";
import { type IAuthProvider, authProvider } from "./auth.provider";
import { type Identity, LOCAL_IDENTITY, currentIdentity, setIdentity } from "./identity";

/**
 * Oturum açma/kapama akışı — kimlik değişimi ile veri taşımayı birlikte yürütür.
 *
 * Bu iki iş neden burada birleşiyor: `setIdentity` tek başına çağrılırsa
 * cihazdaki satırlar eski kimlikle damgalı kalır ve repository onları
 * FİLTRELEYEREK dışarıda bırakır — kullanıcı ilerlemesini kaybetmiş görünür.
 * Bu yüzden sıra bağlayıcıdır ve tek yerde toplanmıştır:
 *
 *     önce reassignOwner (eski kimlik hâlâ aktifken), sonra setIdentity
 *
 * Ters sırada okuma boş küme döner ve veri sahipsiz kalır.
 *
 * ÜRÜN KARARI — veri sormadan taşınır. Kullanıcı hesabına girdiğinde cihazdaki
 * anonim ilerleme sessizce hesabına geçer, çıkış yaptığında sessizce yerele
 * döner. Onay sorulmaz. Bilinen bedeli: ortak kullanılan bir cihazda önceki
 * kişinin anonim ilerlemesi, giriş yapan kişinin hesabına karışır.
 */

/** `features/` katmanının göreceği oturum sonucu. */
export interface SignInResult {
	identity: Identity;
	/** Hesaba taşınan yerel satır var mıydı? Arayüz bunu kullanıcıya bildirir. */
	claimedLocalData: boolean;
}

/**
 * Kodu doğrular, cihazdaki veriyi hesaba taşır ve oturumu açar.
 *
 * Doğrulama başarısız olursa hiçbir veri dokunulmadan kalır; taşıma yalnızca
 * gerçek bir kimlik elde edildikten sonra başlar.
 */
export async function signInWithCode(
	email: string,
	code: string,
	provider: IAuthProvider = authProvider,
): Promise<SignInResult> {
	const identity = await provider.verifyCode(email, code);

	// Aynı hesaba yeniden giriliyorsa taşınacak bir şey yok.
	const previous = currentIdentity();
	const claimedLocalData =
		previous.userId !== identity.userId && (await hasLocalData());

	if (previous.userId !== identity.userId) {
		await progressRepository.reassignOwner(identity.userId);
	}
	setIdentity(identity);

	return { identity, claimedLocalData };
}

/**
 * Oturumu kapatır ve veriyi cihazın anonim kimliğine geri taşır.
 *
 * Veri neden geri taşınıyor: senkron henüz yok (Dilim 3), yani sunucuda bir
 * kopya bulunmuyor. Satırlar hesap kimliğiyle damgalı bırakılsaydı çıkış
 * yapan kullanıcı bütün ilerlemesinin silindiğini görürdü — oysa veri diskte
 * duruyor olurdu, sadece görünmez.
 */
export async function signOut(
	provider: IAuthProvider = authProvider,
): Promise<void> {
	if (currentIdentity().userId !== LOCAL_USER_ID) {
		await progressRepository.reassignOwner(LOCAL_USER_ID);
	}
	setIdentity(LOCAL_IDENTITY);
	await provider.signOut();
}

/**
 * Açılışta yerel kimliği sunucudaki oturumla uzlaştırır.
 *
 * Kimlik yerelde senkron tutulur, ama sunucudaki oturum iptal edilmiş veya
 * süresi dolmuş olabilir; o hâlde cihazda "girişli" görünmeye devam etmek
 * yanıltıcı olur.
 *
 * ÇEVRİMDIŞI DAVRANIŞI: sağlayıcı hata fırlatırsa hiçbir şey yapılmaz.
 * "Oturum yok" ile "şu an bilemiyorum" farklı şeylerdir; ağı olmayan bir
 * kullanıcıyı oturumundan atmak, uygulamanın çevrimdışı çalışma sözünü
 * çiğnemek olurdu.
 */
export async function reconcileSession(
	provider: IAuthProvider = authProvider,
): Promise<void> {
	const local = currentIdentity();
	if (local.kind !== "account") return;

	let server: Identity | null;
	try {
		server = await provider.currentServerIdentity();
	} catch {
		return; // Ağ yok veya sunucu cevap vermedi; mevcut duruma dokunma.
	}

	if (server === null) {
		await signOut(provider);
		return;
	}

	// Sunucu başka bir kullanıcı diyorsa (oturum el değiştirmiş) veriyi ona taşı.
	if (server.userId !== local.userId) {
		await progressRepository.reassignOwner(server.userId);
		setIdentity(server);
	}
}

/** Taşınacak yerel veri var mı? Yalnızca kullanıcıya bilgi vermek için. */
async function hasLocalData(): Promise<boolean> {
	const stats = await progressRepository.getStatistics(1);
	return stats.totalAttempts > 0;
}
