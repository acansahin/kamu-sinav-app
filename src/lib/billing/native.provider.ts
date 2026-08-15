import type { Transaction } from "@capgo/native-purchases";
import {
	PurchasePendingError,
	isAlreadyOwned,
	toBillingError,
} from "@/lib/billing/billing-errors";
import type {
	BillingProduct,
	IBillingProvider,
} from "@/lib/billing/billing.provider";
import { FULL_ACCESS_PRODUCT_ID } from "@/lib/billing/products";

/**
 * Google Play Billing üzerinden hak sağlayıcısı.
 *
 * Bu dosya YALNIZCA `getBillingProvider()` içinden dinamik olarak yüklenir;
 * eklenti paketi böylece tarayıcı paketine hiç girmez. Statik bir içe aktarım
 * eklemek bu kazanımı sessizce geri alır.
 *
 * ⚠️ Doğrulama yalnızca CİHAZ ÜZERİNDEDİR (Faz 1 kararı). Play'in cevabına
 * güvenilir; purchase token bir sunucuya doğrulatılmaz. Bunun bilinen bedeli:
 * iade edilen bir kullanıcı, bir sonraki BAŞARILI sorguya kadar erişimini
 * korur. Faz 2'de Play Developer API doğrulaması eklenirse değişecek tek
 * dosya budur.
 */

/**
 * Eklenti örneği — dinamik yükleme, ilk çağrıda bir kez.
 *
 * ⚠️ Eklenti nesnesi bir SARMALAYICI İÇİNDE döndürülür ve bu zorunludur.
 * Capacitor'ın `registerPlugin` çağrısı her özellik erişimini köprüye çeviren
 * bir Proxy üretir; `then` de bir özelliktir. Proxy doğrudan bir `async`
 * fonksiyondan döndürülürse JavaScript onu "thenable" sanıp `.then()` çağırır,
 * Proxy bunu native bir metot çağrısına çevirir ve çağrı
 * `"NativePurchases.then() is not implemented"` ile patlar. Hata YALNIZCA
 * cihazda görünür — tarayıcıda bu dala hiç girilmiyor.
 */
async function plugin() {
	const { NativePurchases } = await import("@capgo/native-purchases");
	return { api: NativePurchases };
}

type PluginApi = Awaited<ReturnType<typeof plugin>>["api"];

/**
 * ⚠️ EKLENTİYE AYNI ANDA İKİ ÇAĞRI GİTMEZ. Bu bir iyileştirme değil, doğruluk
 * şartıdır.
 *
 * Eklentinin Android tarafında TEK bir `BillingClient` alanı vardır: her çağrı
 * başlarken alanın üzerine yeni bir istemci yazar, biterken de
 * `closeBillingClient()` ile bağlantıyı kapatır. İki çağrı üst üste binerse
 * önce biten, diğerinin HÂLÂ UÇUŞTAKİ sorgusunun bağlantısını kapatır;
 * `queryPurchasesAsync` `SERVICE_DISCONNECTED` döner ve eklenti bunu hata
 * olarak değil **boş liste** olarak çözer (`getPurchases`, boş dizi ile
 * `resolve`).
 *
 * Görülen hata buydu: satın almış kullanıcı uygulamayı yeniden açtığında
 * "satın alma yok" cevabı alıyor, bu cevap otorite sayılıp önbelleğe yazıldığı
 * için erişimini KALICI olarak kaybediyordu. Açılışta hak sorgusu ile onay
 * süpürmesi tam olarak böyle üst üste biniyordu; yarış zamanlamaya bağlı
 * olduğu için yalnızca bazı cihazlarda görünüyordu.
 */
let kuyruk: Promise<unknown> = Promise.resolve();

function sirala<T>(is: () => Promise<T>): Promise<T> {
	const sonuc = kuyruk.then(is, is);
	/*
	 * Kuyruk sıradaki işi BAŞLATMAKTAN sorumludur, hata taşımaktan değil.
	 * Yutulmazsa bir çağrının hatası kendisinden sonraki her çağrıyı da
	 * düşürürdü.
	 */
	kuyruk = sonuc.then(
		() => undefined,
		() => undefined,
	);
	return sonuc;
}

/**
 * Android `Purchase.PurchaseState` değerleri, eklenti tarafından dizeye
 * çevrilerek gelir (`String.valueOf`).
 *
 * ⚠️ `PENDING` **2**'dir, 0 değil; 0 `UNSPECIFIED_STATE`tir. Bu dosya bir
 * süre 0'ı beklemede sayıyordu ve o kontrol hiçbir zaman çalışmadı.
 * Karşılaştırmalar bu yüzden "PURCHASED değilse hak yoktur" yönünde kurulur:
 * bilinmeyen bir durum erişim AÇMAMALIDIR.
 */
const PURCHASED = "1";

/**
 * Android'de geçerli satın alma `purchaseState === "1"` (PURCHASED) demektir.
 *
 * İade edilen satın almalar bu listeden tamamen düşer, farklı bir durumla
 * görünmezler; sorgunun `false` dönmesi bu yüzden iade anlamına da gelir.
 */
function isPurchased(transaction: Transaction): boolean {
	return (
		transaction.productIdentifier === FULL_ACCESS_PRODUCT_ID &&
		transaction.purchaseState === PURCHASED
	);
}

/**
 * Onaylanmamış satın almaları kapatır — en iyi çaba, ASLA fırlatmaz.
 *
 * Play, 3 gün içinde acknowledge edilmeyen satın almayı OTOMATİK İADE EDER.
 * Eklenti satın alma akışının sonunda kendisi onaylıyor, ama kullanıcı satın
 * almayı uygulama arka planda öldürülmüşken tamamlarsa (nakit ödeme onayı) o
 * yol hiç çalışmaz.
 *
 * Bu iş bilinçli olarak hak sorgusunun İÇİNDEDİR: ayrı bir `getPurchases()`
 * çağrısı olduğunda açılışta iki Play çağrısı üst üste biniyordu (bkz.
 * `sirala`). Zaten elimizde olan listeyi kullanmak hem yarışı hem gereksiz
 * trafiği ortadan kaldırır.
 */
async function onaylanmamislariKapat(
	api: PluginApi,
	purchases: Transaction[],
): Promise<void> {
	try {
		for (const transaction of purchases) {
			if (!isPurchased(transaction)) continue;
			if (transaction.isAcknowledged !== false) continue;
			if (!transaction.purchaseToken) continue;

			await api.acknowledgePurchase({
				purchaseToken: transaction.purchaseToken,
			});
		}
	} catch {
		// Başarısız olursa kullanıcıya gösterilecek bir şey yok ve bir sonraki
		// açılışta yeniden denenir. Hak sorgusunun sonucunu DÜŞÜRMEZ.
	}
}

export class NativeBillingProvider implements IBillingProvider {
	async isSupported(): Promise<boolean> {
		return sirala(async () => {
			try {
				const { api } = await plugin();
				const { isBillingSupported } = await api.isBillingSupported();
				return isBillingSupported;
			} catch {
				return false;
			}
		});
	}

	async getFullAccessProduct(): Promise<BillingProduct | null> {
		return sirala(async () => {
			try {
				const { api } = await plugin();
				const { product } = await api.getProduct({
					productIdentifier: FULL_ACCESS_PRODUCT_ID,
				});

				// Ürün Play Console'da pasifse veya henüz yayılmadıysa mağaza boş
				// bir kayıt döndürebilir; fiyatsız bir satın alma düğmesi göstermek
				// kullanıcıyı ne ödeyeceğini bilmeden akışa sokar.
				if (!product?.priceString) return null;

				return { title: product.title, priceString: product.priceString };
			} catch {
				return null;
			}
		});
	}

	async queryEntitlement(): Promise<boolean | null> {
		return sirala(() => this.sorgula());
	}

	async purchaseFullAccess(): Promise<void> {
		/*
		 * Satın alma akışı Play ekranı kapanana kadar sürer ve kuyruğu o süre
		 * boyunca tutar. İstenen budur: `resume` olayıyla tetiklenen hak sorgusu
		 * araya girmek yerine akış bittikten SONRA çalışır ve sonucu görür.
		 */
		return sirala(async () => {
			let transaction: Transaction;

			try {
				const { api } = await plugin();
				transaction = await api.purchaseProduct({
					productIdentifier: FULL_ACCESS_PRODUCT_ID,
					/*
					 * Ömür boyu üründe tüketim YAPILMAZ: tüketilen satın alma
					 * Play'de kaybolur (Billing 8.x'te `getPurchases()` onu artık
					 * döndürmez) ve kullanıcı ödediği erişimi bir daha geri alamaz.
					 *
					 * Otomatik onay da açık bırakılır — kapatmak, 3 gün içinde elle
					 * onaylanmayan satın almanın Play tarafından iade edilmesi
					 * demektir.
					 */
					isConsumable: false,
					autoAcknowledgePurchases: true,
				});
			} catch (error) {
				// Kullanıcı zaten sahipse bu bir hata değil: hak vardır, sorgu onu
				// bulacaktır. Sessizce başarı sayılır.
				if (isAlreadyOwned(error)) return;
				throw toBillingError(error);
			}

			// Nakit ödeme veya aile onayı: işlem döndü ama para alınmadı. Kontrol
			// beklemeyi ADLANDIRMAZ, satın alınmış olmayı arar — bilinmeyen bir
			// durumda erişim açmak, gereksiz yere bekleme mesajı göstermekten çok
			// daha kötüdür.
			if (transaction.purchaseState !== PURCHASED) {
				throw new PurchasePendingError();
			}
		});
	}

	async restore(): Promise<boolean> {
		return sirala(async () => {
			try {
				const { api } = await plugin();
				await api.restorePurchases();
			} catch {
				// Geri yükleme bazı cihazlarda desteklenmez; yine de doğrudan
				// sorgulamayı denemek, kullanıcıyı boş yere hatayla karşılamaktan
				// iyidir.
			}
			// Kuyruğun İÇİNDEN çağrılır: `queryEntitlement()` sıraya girmeyi
			// bekleyeceği için burada kilitlenirdi.
			return (await this.sorgula()) === true;
		});
	}

	/**
	 * Hak sorgusunun kuyruğa girmeyen gövdesi.
	 *
	 * `queryEntitlement()` ve `restore()` bunu paylaşır; ikisi de çağrıyı kendi
	 * kuyruk adımının içinde yapar.
	 */
	private async sorgula(): Promise<boolean | null> {
		try {
			const { api } = await plugin();
			const { purchases } = await api.getPurchases();
			await onaylanmamislariKapat(api, purchases);
			return purchases.some(isPurchased);
		} catch {
			// Sorgu YAPILAMADI — `false` ile karıştırılmamalı. Çağıran taraf bu
			// hâlde önbelleğe düşer ve çevrimdışı kullanıcı hakkını korur.
			return null;
		}
	}
}
