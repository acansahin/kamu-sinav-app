/**
 * Test derlemesi bayrağı — tüm içeriği açar.
 *
 * Yalnızca elle tetiklenen **debug** APK'lar içindir: cihazda özet, test,
 * deneme ve arama sonuçlarını kilitsiz denemek için. Ayarlanmadığında değeri
 * `false`tur ve uygulama normal davranır.
 *
 * ⚠️ **Bu, paywall'ın "derleme anında seçilmediği" kuralını BOZMAZ.** Kilidin
 * uygulanıp uygulanmayacağına hâlâ çalışma anında karar veriliyor
 * (`getBillingProvider()` → `Capacitor.isNativePlatform()`); bu bayrak yalnızca
 * o karara girecek HAKKI sabitliyor, yani "satın almış kullanıcı" durumunu
 * taklit ediyor. Tarayıcı davranışı hiç değişmez, orada zaten kilit yoktur.
 *
 * ⚠️ **Yayın yoluna sızmaması iki katmanla güvence altında:** varsayılan kapalı
 * (bu dosya) ve `android-release.yml` bu değişkeni HİÇ geçmiyor. Release
 * iş akışına eklemeyin — imzalı AAB'de tüm içerik ücretsiz açılırdı ve hata
 * ancak Play'e yüklendikten sonra fark edilirdi.
 *
 * `NEXT_PUBLIC_` öneki zorunlu: Next yalnızca bu önekli değişkenleri istemci
 * paketine gömer.
 */
export const TEST_FULL_ACCESS =
	process.env.NEXT_PUBLIC_TEST_FULL_ACCESS === "1";
