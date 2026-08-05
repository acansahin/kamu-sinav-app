# Veri güvenliği formu — cevaplar

Play Console → Politika → Uygulama içeriği → Veri güvenliği.

Form beyana dayalıdır ve **yanlış beyan uygulamanın kaldırılma sebebidir**.
Aşağıdaki cevaplar, hesap özelliği **kapalı** olarak yayınlanan paket içindir
(`.github/workflows/android-release.yml` Supabase anahtarı geçmez). Anahtar
eklenirse bu form baştan doldurulmalıdır — bkz. son bölüm.

## Veri toplama ve paylaşma

| Soru | Cevap | Gerekçe |
|---|---|---|
| Uygulamanız kullanıcı verisi topluyor veya paylaşıyor mu? | **Hayır** | Uygulama hiçbir veriyi cihaz dışına göndermez. Ağ isteği yalnızca uygulamanın kendi statik dosyaları ve Google Play faturalandırma servisi içindir; analiz, reklam veya çökme raporlama SDK'sı yoktur. |
| Üçüncü taraflarla veri paylaşıyor mu? | **Hayır** | Üçüncü taraf analiz/reklam SDK'sı bulunmuyor. |

Bu cevapla form kısa yoldan biter; aşağıdaki bölümler yalnızca doğrulama
gerekirse dayanak olsun diye tutuluyor.

## Uygulama içi satın alma bu cevabı neden değiştirmiyor

Uygulama tek seferlik bir ürün satar (`tam_erisim`) ve bunun için Google Play
Billing kütüphanesini kullanır. Play'in veri güvenliği tanımına göre bu
**uygulamanın veri toplaması değildir**:

- Ödeme akışı tamamen **Google Play'in kendi arayüzünde** yürür. Uygulama kart
  numarası, ad, adres veya başka bir ödeme bilgisi görmez, işlemez ve saklamaz.
- Uygulamanın cihazda tuttuğu tek satın alma verisi bir **evet/hayır bayrağıdır**
  (`kamu-sinav-erisim`, `src/lib/billing/entitlement-cache.ts`). Satın alma
  geçmişi, sipariş numarası veya token saklanmaz ve hiçbir yere gönderilmez.
- **Sunucu doğrulaması yoktur:** purchase token bir arka uca gönderilmez
  (Faz 1 kararı, `src/lib/billing/native.provider.ts`). Bu yüzden "Satın alma
  geçmişi" veri türü **bildirilmez**.

> Console'da yine de "Uygulama içeriği → Uygulama içi satın alma = **Evet**"
> beyanı verilir; bu, veri güvenliği formundan ayrı bir alandır
> (bkz. `content-rating.md`).

## Beyanı destekleyen olgular

- **Ağ izni:** `AndroidManifest.xml` yalnızca `android.permission.INTERNET`
  ister. Kamera, konum, rehber, depolama, bildirim izni yoktur.
- **Faturalandırma izni:** `com.android.vending.BILLING` izni depodaki manifest
  dosyasında yazılı değildir; Play Billing kütüphanesinin AAR'ından **manifest
  merge** ile gelir. Yayın derlemesinden sonra
  `android/app/build/outputs/logs/manifest-merger-release-report.txt` içinde
  doğrulanmalıdır. Bu izin ödeme akışı için gereklidir ve kişisel veriye
  erişim sağlamaz.
- **Analiz aracı yok:** Depoda Firebase, Google Analytics, Crashlytics, Sentry
  veya benzeri bir bağımlılık bulunmaz. `google-services.json` dosyası yoktur.
- **Reklam yok:** Reklam SDK'sı bulunmaz, reklam kimliği okunmaz.
- **Çalışma verisi cihazda:** Çözülen sorular, ilerleme, ayarlar ve yer imleri
  cihazın IndexedDB deposunda tutulur (`src/lib/db/database.ts`). Kullanıcı bu
  veriyi Ayarlar ekranından JSON olarak dışa aktarabilir; aktarım kullanıcının
  kendi dosya sistemine yapılır, hiçbir sunucuya gönderilmez.
- **Soru bildirimi cihazda kalır:** Uygulama içindeki "Bu soruda sorun var"
  bildirimi yerel veritabanına yazılır, gönderilmez.
- **Hesap yok:** Yayınlanan pakette Supabase anahtarı bulunmadığından
  `isAccountConfigured()` false döner; giriş ekranı ve hesap ikonu hiç render
  edilmez (`src/components/layout/app-shell.tsx`).

## Ek sorular

| Soru | Cevap |
|---|---|
| Veriler aktarım sırasında şifreleniyor mu? | Uygulanamaz — aktarılan veri yok |
| Kullanıcılar verilerinin silinmesini isteyebiliyor mu? | Uygulanamaz — toplanan veri yok. Kullanıcı yerel verisini Ayarlar ekranından kendisi silebilir |
| Uygulama çocuklara mı yönelik? | Hayır — hedef kitle kamu görevlileridir |
| Bağımsız güvenlik denetiminden geçti mi? | Hayır |

## ⚠️ Hesap özelliği açılırsa bu form değişir

Supabase anahtarı bir derlemeye eklenirse uygulama **kişisel veri toplamaya
başlar** ve yukarıdaki "Hayır" cevabı yanlış beyan hâline gelir. O durumda
bildirilmesi gerekenler:

- **E-posta adresi** — hesap yönetimi ve kimlik doğrulama amacıyla, zorunlu
- **Uygulama etkinliği** (çalışma verisi) — uygulama işlevselliği amacıyla,
  isteğe bağlı (kullanıcı hesap açmadan da uygulamayı kullanabilir)
- Aktarımda şifreleme: **Evet** (HTTPS)
- Silme talebi: **Evet** — bu durumda uygulama içinde çalışan bir hesap silme
  akışı da bulunmak zorundadır; Play bunu ayrıca arar. Bugün böyle bir akış
  **yoktur**.

Ayrıca `src/lib/legal/data-controller.ts` içindeki veri sorumlusu künyesinin
tamamı (ad, e-posta, tebligat adresi) doldurulmadan `/gizlilik` sayfası
kendisini yayına hazır saymaz.
