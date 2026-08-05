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

/** Eklenti örneği — dinamik yükleme, ilk çağrıda bir kez. */
async function plugin() {
	const { NativePurchases } = await import("@capgo/native-purchases");
	return NativePurchases;
}

/**
 * Android'de geçerli satın alma `purchaseState === "1"` (PURCHASED) demektir.
 * `"0"` PENDING'dir ve hak VERMEZ — para henüz alınmamıştır.
 *
 * İade edilen satın almalar bu listeden tamamen düşer, farklı bir durumla
 * görünmezler; sorgunun `false` dönmesi bu yüzden iade anlamına da gelir.
 */
function isPurchased(transaction: Transaction): boolean {
	return (
		transaction.productIdentifier === FULL_ACCESS_PRODUCT_ID &&
		transaction.purchaseState === "1"
	);
}

export class NativeBillingProvider implements IBillingProvider {
	async isSupported(): Promise<boolean> {
		try {
			const { isBillingSupported } = await (
				await plugin()
			).isBillingSupported();
			return isBillingSupported;
		} catch {
			return false;
		}
	}

	async getFullAccessProduct(): Promise<BillingProduct | null> {
		try {
			const { product } = await (
				await plugin()
			).getProduct({ productIdentifier: FULL_ACCESS_PRODUCT_ID });

			// Ürün Play Console'da pasifse veya henüz yayılmadıysa mağaza boş
			// bir kayıt döndürebilir; fiyatsız bir satın alma düğmesi göstermek
			// kullanıcıyı ne ödeyeceğini bilmeden akışa sokar.
			if (!product?.priceString) return null;

			return { title: product.title, priceString: product.priceString };
		} catch {
			return null;
		}
	}

	async queryEntitlement(): Promise<boolean | null> {
		try {
			const { purchases } = await (await plugin()).getPurchases();
			return purchases.some(isPurchased);
		} catch {
			// Sorgu YAPILAMADI — `false` ile karıştırılmamalı. Çağıran taraf bu
			// hâlde önbelleğe düşer ve çevrimdışı kullanıcı hakkını korur.
			return null;
		}
	}

	async purchaseFullAccess(): Promise<void> {
		let transaction: Transaction;

		try {
			transaction = await (
				await plugin()
			).purchaseProduct({
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

		// Nakit ödeme veya aile onayı: işlem döndü ama para alınmadı.
		if (transaction.purchaseState === "0") {
			throw new PurchasePendingError();
		}
	}

	async restore(): Promise<boolean> {
		try {
			await (await plugin()).restorePurchases();
		} catch {
			// Geri yükleme bazı cihazlarda desteklenmez; yine de doğrudan
			// sorgulamayı denemek, kullanıcıyı boş yere hatayla karşılamaktan
			// iyidir.
		}
		return (await this.queryEntitlement()) === true;
	}

	async sweepAcknowledgements(): Promise<void> {
		try {
			const api = await plugin();
			const { purchases } = await api.getPurchases();

			for (const transaction of purchases) {
				if (!isPurchased(transaction)) continue;
				if (transaction.isAcknowledged !== false) continue;
				if (!transaction.purchaseToken) continue;

				await api.acknowledgePurchase({
					purchaseToken: transaction.purchaseToken,
				});
			}
		} catch {
			// Süpürme en iyi çabadır: başarısız olursa kullanıcıya gösterilecek
			// bir şey yok ve bir sonraki açılışta yeniden denenir.
		}
	}
}
