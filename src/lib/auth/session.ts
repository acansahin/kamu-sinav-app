import { progressRepository } from "@/lib/repositories/progress.repository";
import { fullSync } from "@/lib/sync/sync";
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

/**
 * Senkronu enjekte edilebilir kılan tip.
 *
 * Üretimde `fullSync` geçilir; test bir casus geçerek senkronun DOĞRU sırada
 * (kimlik damgalandıktan sonra, çıkışta kimlik hâlâ hesapken) çağrıldığını ağa
 * çıkmadan doğrular.
 */
type SyncFn = () => Promise<void>;

/**
 * Senkron her zaman EN İYİ ÇABADIR: başarısızlığı oturum işlemini bozmaz.
 *
 * Çevrimdışıyken giriş ve çıkış yine de tamamlanmalı — yerel veri güvende ve
 * bir sonraki açılış/uzlaştırma eşitlemeyi tekrar dener. Bu yüzden hata yutulur;
 * yalnızca "denendi ve tamamlandı mı" bilgisi döner, arayüz bunu dürüstçe söyler.
 */
async function syncQuietly(sync: SyncFn): Promise<boolean> {
	try {
		await sync();
		return true;
	} catch {
		return false;
	}
}

/** `features/` katmanının göreceği oturum sonucu. */
export interface SignInResult {
	identity: Identity;
	/** Hesaba taşınan yerel satır var mıydı? Arayüz bunu kullanıcıya bildirir. */
	claimedLocalData: boolean;
	/** Senkron bu turda tamamlandı mı? Çevrimdışıyken false; veri yine güvende. */
	synced: boolean;
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
	sync: SyncFn = fullSync,
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

	// Kimlik damgalandıktan SONRA eşitle: bu cihazdan hesaba taşınan ilerleme
	// sunucuya çıkar, başka cihazlardaki ilerleme birleşerek geri iner. Sıra
	// önemli — sync aktif kimliği (artık hesap) okur ve o kimlikle damgalı
	// yereli gönderir.
	const synced = await syncQuietly(sync);

	return { identity, claimedLocalData, synced };
}

/**
 * Oturumu kapatır ve veriyi cihazın anonim kimliğine geri taşır.
 *
 * İki iş sırayla yapılır:
 *   1. Son bir eşitleme — hesabın bu cihazdaki en yeni hâli sunucuya çıksın ki
 *      başka bir cihaz açıldığında değişiklikler orada olsun. En iyi çaba:
 *      çevrimdışıysa çıkış yine de tamamlanır.
 *   2. Veri anonim kimliğe geri damgalanır. Satırlar hesap kimliğiyle damgalı
 *      bırakılsaydı çıkış yapan kullanıcı ilerlemesinin silindiğini görürdü —
 *      oysa veri diskte durur, yalnızca görünmez olurdu.
 *
 * Sıra bağlayıcı: eşitleme kimlik HÂLÂ hesapken yapılır; `reassignOwner`'dan
 * sonraya kalsaydı gönderilecek satır aktif kimlikle (artık `local`) damgalı
 * olur ve hesabın satırları sunucuya hiç ulaşmazdı.
 */
export async function signOut(
	provider: IAuthProvider = authProvider,
	sync: SyncFn = fullSync,
): Promise<void> {
	if (currentIdentity().userId !== LOCAL_USER_ID) {
		await syncQuietly(sync);
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
	sync: SyncFn = fullSync,
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
		await signOut(provider, sync);
		return;
	}

	// Sunucu başka bir kullanıcı diyorsa (oturum el değiştirmiş) veriyi ona taşı.
	if (server.userId !== local.userId) {
		await progressRepository.reassignOwner(server.userId);
		setIdentity(server);
	}

	// Oturum sunucuda geçerli — başka cihazlarda biriken ilerlemeyi indir. En iyi
	// çaba: sunucu kimliği doğrulandı ama ağ sonradan kesilse bile açılış bozulmaz.
	await syncQuietly(sync);
}

/** Taşınacak yerel veri var mı? Yalnızca kullanıcıya bilgi vermek için. */
async function hasLocalData(): Promise<boolean> {
	const stats = await progressRepository.getStatistics(1);
	return stats.totalAttempts > 0;
}
