import { BillingUnavailableError } from "@/lib/billing/billing-errors";

/**
 * Satın alma sağlayıcısı — sözleşme ve seçim.
 *
 * `authProvider` ile aynı desendir ama BİR FARKLA: kimlik sağlayıcısı DERLEME
 * anında seçilir (`isAccountConfigured()`), bu ise ÇALIŞMA anında seçilmek
 * zorundadır. Sebep, aynı `out/` klasörünün iki ortama birden gitmesi:
 * GitHub Pages'e ve Capacitor paketine. Derleme anında ayırmak, iki ayrı
 * derleme almayı gerektirirdi.
 *
 * Soyutlamanın ikinci işlevi çıkış kapısı: Faz 2'de sunucu doğrulaması
 * (Play Developer API) eklendiğinde ya da eklenti değiştirildiğinde
 * değişen tek dosya `native.provider.ts` olur.
 */

export interface BillingProduct {
	title: string;
	/** Para birimi işaretiyle biçimlenmiş fiyat — mağazadan gelir, koda gömülmez. */
	priceString: string;
}

export interface IBillingProvider {
	/** Bu cihazda Play üzerinden satın alma yapılabilir mi? */
	isSupported(): Promise<boolean>;
	/** Ürün bilgisi; alınamazsa `null`. */
	getFullAccessProduct(): Promise<BillingProduct | null>;
	/**
	 * Hak sorgusu.
	 *
	 * `true`/`false` → sorgu BAŞARILI, cevap bu.
	 * `null`         → sorgu yapılamadı (çevrimdışı, Play yok). Çağıran taraf
	 *                  bu üçüncü hâli önbelleğe düşmek için kullanır; `false`
	 *                  ile karıştırılırsa çevrimdışı kullanıcı hakkını kaybeder.
	 */
	queryEntitlement(): Promise<boolean | null>;
	/** Satın alma akışını başlatır. Hata hâlinde tipli exception fırlatır. */
	purchaseFullAccess(): Promise<void>;
	/** Önceki satın almaları geri yükler; hak bulunduysa `true`. */
	restore(): Promise<boolean>;
	/**
	 * Onaylanmamış satın almaları kapatır.
	 *
	 * Play, 3 gün içinde acknowledge edilmeyen satın almayı OTOMATİK İADE EDER.
	 * Eklenti varsayılan olarak onaylıyor, ama kullanıcı satın almayı uygulama
	 * arka planda öldürülmüşken tamamlarsa (nakit ödeme onayı) o yol hiç
	 * çalışmaz. Bu yüzden her açılışta bir süpürme yapılır.
	 */
	sweepAcknowledgements(): Promise<void>;
}

/**
 * Mağazasız ortam: tarayıcı, geliştirme sunucusu, Playwright.
 *
 * Hiçbir kilit uygulanmaz — `paywallActive` store tarafında `false` yazılır.
 * Satın alma denenirse açık bir hata verir; sessizce başarısız olup kullanıcıyı
 * "bir şey olmadı" hâlinde bırakmaz.
 */
class OpenBillingProvider implements IBillingProvider {
	async isSupported(): Promise<boolean> {
		return false;
	}

	async getFullAccessProduct(): Promise<BillingProduct | null> {
		return null;
	}

	async queryEntitlement(): Promise<boolean | null> {
		return false;
	}

	async purchaseFullAccess(): Promise<void> {
		throw new BillingUnavailableError(
			"Satın alma yalnızca Google Play'den kurulan Android uygulamasında yapılabilir.",
		);
	}

	async restore(): Promise<boolean> {
		return false;
	}

	async sweepAcknowledgements(): Promise<void> {
		/* mağaza yok, süpürülecek bir şey de yok */
	}
}

const openProvider = new OpenBillingProvider();

/**
 * Ortama uygun sağlayıcı.
 *
 * İki içe aktarma da DİNAMİKTİR ve bu ölçülmüş bir kısıttır: statik bir
 * `@capacitor/core` içe aktarımı paketi web yayınının ortak paketine sokar
 * (bkz. `lib/stores/preferences.ts` ve `lib/auth/supabase-client.ts`).
 * `native.provider.ts` yalnızca buradan erişilebildiği için faturalandırma
 * eklentisi tarayıcı paketine hiç girmez.
 */
export async function getBillingProvider(): Promise<IBillingProvider> {
	if (typeof window === "undefined") return openProvider;

	try {
		const { Capacitor } = await import("@capacitor/core");
		if (!Capacitor.isNativePlatform()) return openProvider;

		const { NativeBillingProvider } = await import(
			"@/lib/billing/native.provider"
		);
		return new NativeBillingProvider();
	} catch {
		// Eklenti yüklenemezse uygulama çalışmaya devam etmeli. Açık sağlayıcıya
		// düşmek kilitleri kaldırır; alternatifi, ödemiş kullanıcıyı da kilitli
		// bırakmaktı ve bu çok daha kötü bir başarısızlık biçimi olurdu.
		return openProvider;
	}
}

/** Ortamın native olup olmadığı — store başlangıç durumunu bununla kurar. */
export async function isNativeRuntime(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	try {
		const { Capacitor } = await import("@capacitor/core");
		return Capacitor.isNativePlatform();
	} catch {
		return false;
	}
}
