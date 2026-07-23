// SADECE TİP olarak alınır — çalışma anı içe aktarımı olsaydı SDK her sayfanın
// paketine girerdi; sebebi aşağıda `getSupabaseClient` yorumunda.
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase istemcisi — yalnızca kimlik doğrulama için (Faz 3 Dilim 2).
 *
 * YAPILANDIRMA İSTEĞE BAĞLIDIR. Uygulama anahtarlar olmadan da eksiksiz
 * çalışmak zorundadır: CI'da anahtar yok, Android paketinde ağ olmayabilir ve
 * "hesap gerekmez" bir ürün sözü (PROJECT_PLAN.md §4, taahhüt 6). Bu yüzden
 * burası asla modül yüklenirken hata fırlatmaz; yapılandırma eksikse `null`
 * döner ve çağıran taraf yerel kimliğe düşer.
 *
 * `process.env.NEXT_PUBLIC_*` referansları BİREBİR yazılmak zorundadır —
 * Next.js bu değerleri derleme anında metin olarak değiştirir, değişken
 * üzerinden erişim (`process.env[ad]`) gömülmez ve çalışma anında
 * `undefined` kalır.
 *
 * Anon anahtarı gizli değildir; tarayıcıya inmesi tasarım gereğidir. Veriyi
 * koruyan şey anahtarın gizliliği değil, Postgres tarafındaki RLS
 * politikalarıdır (bkz. PROJECT_PLAN.md §8).
 */

export interface SupabaseConfig {
	url: string;
	anonKey: string;
}

function readConfig(): SupabaseConfig | null {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	// Boş dize, tanımsızla aynı sayılır: CI ortamlarında değişkenler çoğu zaman
	// tanımsız değil, boş geçilir.
	if (!url || !anonKey) return null;
	return { url, anonKey };
}

export const supabaseConfig: SupabaseConfig | null = readConfig();

/** Hesap özelliği bu derlemede kullanılabilir mi? */
export function isAccountConfigured(): boolean {
	return supabaseConfig !== null;
}

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * İstemciyi ilk kullanımda kurar; SDK'yı da o anda indirir.
 *
 * SDK neden DİNAMİK yükleniyor: statik içe aktarımda `@supabase/supabase-js`
 * kök düzendeki oturum uzlaştırıcısı üzerinden ortak pakete giriyor ve
 * ölçüldüğünde 53 sayfanın hepsine 227 KB ekliyordu. Kimlik doğrulama isteğe
 * bağlı bir özellik: yapılandırılmamış olabilir, kullanıcıların çoğu hiç giriş
 * yapmayacak ve hedef kitlede veri kotası kısıtlı kullanıcılar var
 * (PROJECT_PLAN.md §2, Persona 2). Bu yüzden SDK ancak gerçekten giriş
 * yapılırken ya da açılışta zaten girişli bir oturum varken iner.
 *
 * Söz (Promise) önbelleğe alınır, istemci değil: arka arkaya gelen çağrılar
 * aynı indirmeyi paylaşsın ve iki ayrı istemci kurulmasın.
 */
export function getSupabaseClient(): Promise<SupabaseClient> | null {
	if (!supabaseConfig) return null;
	// Ön üretim (prerender) sırasında tarayıcıya özgü depo yoktur.
	if (typeof window === "undefined") return null;

	const config = supabaseConfig;
	clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
		createClient(config.url, config.anonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				/*
				 * URL'de oturum ARAMA.
				 *
				 * Varsayılan davranış, adres çubuğundaki `#access_token=…` parçasını
				 * okuyup oturum açmaktır — sihirli bağlantı akışının çalışma şekli.
				 * Bu uygulama altı haneli kod kullanıyor ve yönlendirme yok; ayrıca
				 * Capacitor WebView'de ve alt dizinli Pages yayınında dönüş adresi
				 * farklı olduğu için o akış zaten kurulamaz.
				 */
				detectSessionInUrl: false,
			},
		}),
	);

	return clientPromise;
}
