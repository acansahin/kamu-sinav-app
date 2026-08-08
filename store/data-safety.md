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

- **İzinler:** Depodaki `AndroidManifest.xml` yalnızca
  `android.permission.INTERNET` ister, ama Console'a beyan edilen liste
  **birleşmiş** manifesttir; kütüphaneler kendi izinlerini merge ile ekler.
  8 Ağustos 2026'da üretilen ilk imzalı AAB'de (run 31273321559) bulunan tam
  liste:

  | İzin | Nereden | Neden zararsız |
  |---|---|---|
  | `INTERNET` | depodaki manifest | Uygulama çevrimdışı çalışır; ağ yalnızca Play Billing ve içerik indirmesi içindir. |
  | `ACCESS_NETWORK_STATE` | Play Billing / Play Services | Bağlantı durumunu okur, veri toplamaz. |
  | `BIND_JOB_SERVICE` | Play Services datatransport | Sistemin JobScheduler'a bağlanmasını sağlar; uygulama iş planlamaz. |
  | `DUMP` | Play Services | Normal uygulamalara **verilmez** (imza/ayrıcalık düzeyi); beyan edilmiş olması erişim doğurmaz. |
  | `com.android.vending.BILLING` | Play Billing AAR | Ödeme akışı için gerekli; kişisel veriye erişim sağlamaz. |

  **Kamera, konum, mikrofon, rehber, depolama ve bildirim izni yoktur.**

- **Konum kütüphanesi var, konum erişimi yok:** Pakette Billing'in geçişli
  bağımlılıkları olarak `play-services-location` 19.0.0 ve
  `play-services-places-placereport` 17.0.0 bulunur. Kütüphanenin **pakette
  bulunması** ile konuma **erişebilmesi** ayrı şeylerdir: konum izni
  istenmediği için Android bu kütüphanelere hiçbir konum vermez. Formdaki
  "konum toplanmıyor" cevabı bu yüzden doğrudur. Denetim gelirse dayanak
  budur; kütüphaneleri kaldırmak Billing'i kırar.

  Doğrulama, merger raporuna değil **paketin kendisine** bakılarak yapılır —
  rapor CI artifact'i olarak yüklenmiyor, AAB ise yükleniyor:

  ```bash
  unzip -q app-release.aab -d x && grep -a -o "android.permission.[A-Z_]*\|com.android.vending.[A-Z_]*" x/base/manifest/AndroidManifest.xml | sort -u
  ```
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
