import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FULL_ACCESS_PRODUCT_ID } from "@/lib/billing/products";

/**
 * Play sağlayıcısının cihazda görünen davranışı.
 *
 * Buradaki senaryoların hepsi ÜRETİMDE görülmüş bir hatadan geliyor: satın
 * almış bir kullanıcı uygulamayı kapatıp açtığında erişimini kaybediyordu.
 * Sebebi eklentinin tek `BillingClient` tutması ve her çağrının bitişte
 * bağlantıyı kapatmasıydı; üst üste binen iki çağrıdan biri boş listeyle
 * dönüyor, bu da "satın alma yok" cevabı sayılıyordu. Yarış zamanlamaya bağlı
 * olduğu için cihazda ancak bazı kullanıcılarda görünüyordu — yani tam olarak
 * testle sabitlenmesi gereken türden bir hata.
 */

interface SahteIslem {
	productIdentifier: string;
	purchaseState: string;
	purchaseToken?: string;
	isAcknowledged?: boolean;
}

function satinAlinmis(fazladan: Partial<SahteIslem> = {}): SahteIslem {
	return {
		productIdentifier: FULL_ACCESS_PRODUCT_ID,
		purchaseState: "1",
		purchaseToken: "jeton-1",
		isAcknowledged: true,
		...fazladan,
	};
}

/** Eklenti sahtesi — eşzamanlılığı ölçer, çünkü kırılan şey tam olarak oydu. */
function sahteEklenti() {
	const durum = {
		aktif: 0,
		enYuksekAktif: 0,
		purchases: [] as SahteIslem[],
		islem: satinAlinmis(),
		onaylananlar: [] as string[],
		getPurchasesDusur: false,
		onayDusur: false,
	};

	async function izle<T>(uret: () => T): Promise<T> {
		durum.aktif += 1;
		durum.enYuksekAktif = Math.max(durum.enYuksekAktif, durum.aktif);
		try {
			// Köprü çağrısı asenkrondur; üst üste binme ancak burada görünür.
			await new Promise((coz) => setTimeout(coz, 5));
			return uret();
		} finally {
			durum.aktif -= 1;
		}
	}

	const NativePurchases = {
		isBillingSupported: () => izle(() => ({ isBillingSupported: true })),
		getProduct: () =>
			izle(() => ({
				product: { title: "Tam erişim", priceString: "149,99 ₺" },
			})),
		getPurchases: () =>
			izle(() => {
				if (durum.getPurchasesDusur) throw new Error("SERVICE_DISCONNECTED");
				return { purchases: durum.purchases };
			}),
		purchaseProduct: () => izle(() => durum.islem),
		restorePurchases: () => izle(() => undefined),
		acknowledgePurchase: (secenekler: { purchaseToken: string }) =>
			izle(() => {
				if (durum.onayDusur) throw new Error("acknowledge failed");
				durum.onaylananlar.push(secenekler.purchaseToken);
				return undefined;
			}),
	};

	return { durum, NativePurchases };
}

let eklenti: ReturnType<typeof sahteEklenti>;

async function saglayici() {
	const { NativeBillingProvider } = await import("@/lib/billing/native.provider");
	return new NativeBillingProvider();
}

/**
 * Hata sınıfı da AYNI modül grafiğinden alınmak zorunda: `vi.resetModules()`
 * her testte yeni bir kayıt defteri kurduğu için dosyanın tepesinden statik
 * içe aktarılan sınıf, sağlayıcının fırlattığından farklı bir nesne olurdu ve
 * `instanceof` sessizce başarısız olurdu.
 */
async function hatalar() {
	return import("@/lib/billing/billing-errors");
}

beforeEach(() => {
	eklenti = sahteEklenti();
	// Sıra kuyruğu modül düzeyindedir; her test temiz bir modülle başlamalı.
	vi.resetModules();
	vi.doMock("@capgo/native-purchases", () => ({
		NativePurchases: eklenti.NativePurchases,
	}));
});

afterEach(() => {
	vi.doUnmock("@capgo/native-purchases");
});

describe("eklenti çağrılarının sıralanması", () => {
	/**
	 * ASIL HATA. Eklentide tek bir `BillingClient` alanı var ve her çağrı
	 * bitişte bağlantıyı kapatıyor; üst üste binen çağrılardan önce biten,
	 * diğerinin uçuştaki sorgusunu düşürüyor ve eklenti bunu boş listeyle
	 * çözüyor. Aynı anda ikinci bir çağrı gitmemesi bu yüzden doğruluk şartı.
	 */
	it("aynı anda birden fazla çağrı yapmaz", async () => {
		eklenti.durum.purchases = [satinAlinmis()];
		const provider = await saglayici();

		await Promise.all([
			provider.isSupported(),
			provider.queryEntitlement(),
			provider.getFullAccessProduct(),
			provider.queryEntitlement(),
		]);

		expect(eklenti.durum.enYuksekAktif).toBe(1);
	});

	/**
	 * `restore()` kendi içinde hak sorgusu yapar. Sorgu kuyruğa yeniden
	 * girseydi, kuyruğu zaten tutan `restore` kendi kendini bekler ve çağrı
	 * hiç dönmezdi.
	 */
	it("restore kendi sorgusunda kilitlenmez", async () => {
		eklenti.durum.purchases = [satinAlinmis()];
		const provider = await saglayici();

		await expect(provider.restore()).resolves.toBe(true);
	});
});

describe("hak sorgusu", () => {
	it("satın alınmış ürün bulursa hak verir", async () => {
		eklenti.durum.purchases = [satinAlinmis()];
		const provider = await saglayici();

		await expect(provider.queryEntitlement()).resolves.toBe(true);
	});

	it("başka ürün veya beklemedeki satın alma hak vermez", async () => {
		eklenti.durum.purchases = [
			satinAlinmis({ productIdentifier: "baska_urun" }),
			satinAlinmis({ purchaseState: "2" }),
		];
		const provider = await saglayici();

		await expect(provider.queryEntitlement()).resolves.toBe(false);
	});

	/**
	 * Sorgu YAPILAMADI ile "satın alma yok" ayrımı: `null` dönmezse çevrimdışı
	 * bir kullanıcının önbellekteki hakkı silinirdi.
	 */
	it("sorgu düşerse null döner", async () => {
		eklenti.durum.getPurchasesDusur = true;
		const provider = await saglayici();

		await expect(provider.queryEntitlement()).resolves.toBeNull();
	});
});

describe("onay süpürmesi", () => {
	/**
	 * Play, 3 gün içinde acknowledge edilmeyen satın almayı otomatik iade eder.
	 * Süpürme bilinçli olarak sorgunun İÇİNDEDİR: ayrı bir çağrı olduğunda
	 * açılışta hak sorgusuyla üst üste biniyordu.
	 */
	it("onaylanmamış satın almayı sorgu sırasında onaylar", async () => {
		eklenti.durum.purchases = [
			satinAlinmis({ isAcknowledged: false, purchaseToken: "jeton-x" }),
		];
		const provider = await saglayici();

		await expect(provider.queryEntitlement()).resolves.toBe(true);
		expect(eklenti.durum.onaylananlar).toEqual(["jeton-x"]);
	});

	it("zaten onaylanmış satın almayı tekrar onaylamaz", async () => {
		eklenti.durum.purchases = [satinAlinmis()];
		const provider = await saglayici();

		await provider.queryEntitlement();
		expect(eklenti.durum.onaylananlar).toEqual([]);
	});

	/** Süpürme en iyi çabadır; hatası hakkı DÜŞÜREMEZ. */
	it("onay hatası hak sonucunu bozmaz", async () => {
		eklenti.durum.purchases = [satinAlinmis({ isAcknowledged: false })];
		eklenti.durum.onayDusur = true;
		const provider = await saglayici();

		await expect(provider.queryEntitlement()).resolves.toBe(true);
	});
});

describe("satın alma akışı", () => {
	it("satın alınmış durumda hatasız tamamlanır", async () => {
		const provider = await saglayici();
		await expect(provider.purchaseFullAccess()).resolves.toBeUndefined();
	});

	/**
	 * ⚠️ Android'de `PENDING` **2**'dir. Kod bir süre 0'ı beklemede sayıyordu ve
	 * o kontrol hiç çalışmadı; nakit ödeme onayı bekleyen satın alma başarı
	 * sayılırdı. Kontrol artık "PURCHASED değilse hak yok" yönünde.
	 */
	it.each([
		["beklemede (2)", "2"],
		["bilinmeyen (0)", "0"],
	])("%s durumu beklemede sayılır", async (_ad, durum) => {
		eklenti.durum.islem = satinAlinmis({ purchaseState: durum });
		const provider = await saglayici();
		const { PurchasePendingError } = await hatalar();

		await expect(provider.purchaseFullAccess()).rejects.toBeInstanceOf(
			PurchasePendingError,
		);
	});
});
