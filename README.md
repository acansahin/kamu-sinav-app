# Kamu Sınav Akademi

Türkiye'deki kamu kurumlarında yapılan **Görevde Yükselme** ve **Unvan Değişikliği**
sınavlarına hazırlık uygulaması. Web tabanlı, çevrimdışı çalışır, reklamsız.

> **Durum:** Faz 2 tamamlandı; Faz 3 sürüyor. 3 ders, **17 konu özeti**, **208 soru**;
> konu testleri, 20/50/80 soruluk deneme sınavları, aralıklı tekrar ve arama çalışıyor.
> Hesap özelliği isteğe bağlı olarak açılabilir (aşağıda); çoklu cihaz senkronu henüz yok.
> Android paketleme CI'da hazır.

## Ne farklı?

Rakiplerin çözemediği sorun soru sayısı değil, **güven**:

- **Her sorunun mevzuat dayanağı görünür** — hangi kanunun hangi maddesi, şema düzeyinde zorunlu alan.
- **Her sorunun kaynağı izlenebilir** — kaynağı doğrulanmamış soru yayımlanamaz, build kırılır.
- **İçerik mevzuat sürümüyle damgalı** — hangi tarihli hâle göre hazırlandığı ve en son ne zaman doğrulandığı yazar.
- **Gerçek erişilebilirlik** — hedef kitlenin yaş profiline uygun; 44px dokunma hedefi, üç kademeli yazı boyutu, yüksek kontrast modu.
- **Reklamsız ve çevrimdışı** — hesap gerekmez, veri cihazda kalır, JSON olarak dışa
  aktarılabilir. Açılan sayfalar kendiliğinden önbelleğe alınır; tümünü indirmek
  isteğe bağlıdır çünkü çıktı ~10 MB ve hedef kitlede kısıtlı veriyle çalışanlar var.

## Hızlı başlangıç

```bash
npm install
npm run dev      # içeriği derler, sonra http://localhost:3000
```

```bash
npm run build        # statik export → out/
npm test             # birim testler
npm run e2e          # uçtan uca + erişilebilirlik (önce npm run build)
npm run typecheck
npm run content:build   # yalnızca içerik doğrulama + kapsam raporu
npm run android:sync    # build + web varlıklarını Android projesine kopyala
```

APK yerel makinede derlenmez; `.github/workflows/android.yml` üretir ve **Artifacts**
altına koyar.

## Hesap özelliği (Supabase)

**İsteğe bağlıdır.** Anahtar verilmezse uygulama eksiksiz çalışır; yalnızca giriş
kapalı kalır ve `/hesap` ekranı bunu dürüstçe söyler. CI bilinçli olarak anahtarsız
derler — "hesap gerekmez" bir ürün sözü, derleme koşulu değil.

Açmak için:

1. [supabase.com](https://supabase.com) → yeni proje. Bölge olarak Frankfurt
   (`eu-central-1`) seçin; kullanıcılar Türkiye'de.
2. **Project Settings → API**'den `Project URL` ve `anon public` anahtarını kopyalayın.
3. `.env.example` dosyasını `.env.local` olarak kopyalayıp ikisini yapıştırın.
4. ⚠️ **Authentication → Emails → Magic Link** şablonunu düzenleyin ve gövdeye
   `{{ .Token }}` ekleyin.

   Bu adım atlanırsa özellik **sessizce çalışmaz**: Supabase'in varsayılan şablonu
   altı haneli kod değil, sihirli bağlantı gönderir. Kullanıcı e-postayı alır ama
   içinde girebileceği bir kod bulamaz. Uygulama bağlantı akışını bilinçli olarak
   kullanmıyor — sabit bir dönüş adresi yok (Capacitor kökten, Pages alt dizinden
   servis ediyor).

   Örnek gövde:

   ```html
   <h2>Giriş kodun</h2>
   <p>Kamu Sınav Akademi'ye girmek için bu kodu kullan:</p>
   <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>Kod bir saat geçerlidir. Bu isteği sen yapmadıysan yok sayabilirsin.</p>
   ```

5. **Authentication → Providers → Email**: `Confirm email` açık kalsın, şifre
   girişine gerek yok.

> Ücretsiz katmanda Supabase'in kendi SMTP'si saatte ~3-4 e-posta ile sınırlıdır ve
> yalnızca test içindir. Gerçek kullanıma açarken kendi SMTP sağlayıcınızı tanımlayın.

`anon` anahtarı gizli değildir; tarayıcıya inmesi tasarım gereğidir. Veriyi koruyan
şey anahtarın gizliliği değil, Postgres tarafındaki RLS politikalarıdır (Dilim 3'te
gelecek). `service_role` anahtarı ise **hiçbir zaman** bu depoya veya `.env.local`e
yazılmaz — RLS'i tamamen atlar ve statik export'ta herkese açık hâle gelirdi.

### Yayına almadan önce: KVKK

Hesap açma gerçek kullanıcılara açıldığında e-posta adresi kişisel veridir ve 6698
sayılı Kanun devreye girer. Aydınlatma metni `/gizlilik` sayfasındadır, ama **iki iş
sizde**:

1. **`src/lib/legal/data-controller.ts` doldurulmalı** — veri sorumlusunun adı,
   e-posta adresi ve tebligata esas adresi. Boş kaldığı sürece sayfa görünür bir
   uyarı gösterir; kanun bu bilgilerin açıkça yazılmasını zorunlu kılar (m.10/1-a).

2. **Yurt dışına aktarım çözülmeli.** Supabase sunucuları Türkiye dışındadır
   (Frankfurt), yani KVKK m.9 kapsamında yurt dışına aktarım yapılıyor. 2024
   değişikliğinden sonra bunun yolu ya yeterlilik kararı ya da uygun güvencedir —
   pratikte **standart sözleşme** imzalanıp Kurul&rsquo;a beş iş günü içinde
   bildirilmesi. Rutin ve sürekli bir aktarım "arızi" sayılmadığı için yalnızca açık
   rızaya dayanmak güvenli değildir.

> ⚠️ Metin, kanunun saydığı unsurlar esas alınarak hazırlanmış bir **taslaktır**;
> hukuki görüş değildir. Canlıya çıkmadan önce bir avukata okutun — özellikle yurt
> dışına aktarım bölümünü.

## Teknoloji

| Katman | Seçim |
|---|---|
| Uygulama | Next.js 16 (App Router, **statik export**) · React 19 · TypeScript strict |
| Arayüz | Tailwind CSS v4 · lucide-react |
| Durum | Zustand (görsel tercihler) · Dexie live query (ilerleme) |
| Kalıcılık | Dexie / IndexedDB — repository arayüzü arkasında |
| İçerik | MDX + JSON, Zod ile derleme zamanında doğrulanır |
| Test | Vitest |
| Mobil | Capacitor (Android), APK GitHub Actions'ta üretilir — bu yüzden çıktı **tam statik** olmak zorunda |

## Yapı

```
content/       kaynak içerik (MDX özetler + JSON sorular) — insan yazar, git'te durur
scripts/       build-content.ts: doğrulama + telif kapısı + derleme
src/app/       rotalar (App Router)
src/features/  dikey dilimler: study, quiz, exam, progress, settings
src/lib/       çerçeveden bağımsız saf mantık: scoring, selector, db, repositories
src/types/     Zod şemaları → türetilmiş TypeScript tipleri
tests/         birim testler
android/       Capacitor tarafından üretilen Android projesi
```

## Belgeler

- **[PROJECT_PLAN.md](PROJECT_PLAN.md)** — pazar araştırması, rakip analizi, mimari
  kararlar ve gerekçeleri, veri modeli, ekran listesi, kullanıcı akışları, yol haritası.
- **[AGENTS.md](AGENTS.md)** — geliştirme kuralları, içerik ekleme, telif kısıtları,
  bilinen tuzaklar.

## Telif

Kamu kurumlarının yayımladığı çıkmış sınav soruları kaynak gösterilerek kullanılır; özel
yayınevlerinin ve ücretli platformların soru bankaları **kullanılmaz**. Ayrıntı için
[PROJECT_PLAN.md §14](PROJECT_PLAN.md) ve [AGENTS.md](AGENTS.md).
