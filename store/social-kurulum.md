# Sosyal medya hattı — kurulum

Otomatik paylaşım hattı (`.github/workflows/social.yml`) hazırdır ama **anahtarsız
çalışmaz**: yapılandırılmamış platform sessizce atlanır. Aşağıdaki adımlar bir kez
yapılır, sonra hat kendiliğinden yürür.

Anahtarları yalnızca depo sahibi üretebilir; hiçbiri bu depoda tutulmaz.
Hepsi **Settings → Secrets and variables → Actions → New repository secret**
altına girilir.

## Ne paylaşılıyor

| Tür | Zamanlama (TRT) | İçerik |
|---|---|---|
| `soru` | Her gün 09:30 | Havuzdan bir soru + şıkları |
| `cevap` | Her gün 19:30 | Aynı sorunun cevabı, açıklaması, mevzuat dayanağı |
| `bilgi` | Çarşamba ve Pazar 13:00 | Konu özetinin "Bir bakışta" maddelerinden biri |
| `duyuru` | Elle | Kilometre taşı; metni siz verirsiniz |

Ayda ~70 paylaşım eder (platform başına).

## Maliyet

| Platform | Ücret | Not |
|---|---|---|
| **Facebook Sayfa** | Ücretsiz | Organik paylaşımda ücret yok |
| **Instagram** | Ücretsiz | Günde 50 paylaşım sınırı; biz 1 kullanıyoruz |
| **GitHub Actions** | Ücretsiz | Herkese açık depolarda dakika sınırsız |
| **X (Twitter)** | ~$1 / ay | Aşağıya bakın |

⚠️ **X, Şubat 2026'da ücretsiz katmanı kaldırdı** ve kullandıkça öde modeline geçti.
Yeni geliştiriciler artık ücretsiz katmana veya Basic/Pro paketlerine kaydolamıyor;
kullanım başına ödeniyor:

- Gönderi oluşturma: **~$0,015**
- Gönderide **bağlantı varsa: ~$0,20 ek**

Bu hattın X kullanımı ayda ~32 gönderi (günde soru + cevap) + ~9 bilgi kartı = ~41
gönderi → **~$0,62/ay**. Duyurular seyrek ve bağlantılı olduğu için birkaç kuruş
daha ekler. Yuvarlak hesap: **ayda 1 dolar civarı.**

> **Bu yüzden X metinlerinde uygulama adresi yoktur.** Her paylaşıma bağlantı
> koymak aylık maliyeti ~$1'den ~$9'a çıkarırdı. Adres profildeki bağlantıda
> durur; Facebook ve Instagram metinlerinde ise adres var — orada ek ücret yok.

Rakamlar üçüncü taraf kaynaklardan derlendi ve X fiyatlandırmayı sık değiştiriyor;
hesap açarken **geliştirici portalındaki güncel tarifeyi** doğrulayın.

**Yalnızca Meta ile başlanabilir.** X'in sırları girilmezse platform sessizce
atlanır; Facebook ve Instagram tamamen ücretsiz çalışmaya devam eder.

Paylaşılan içerik `social/ledger.json`e yazılır ve **bir daha seçilmez**. Havuz 1300+
soruluk; günde bir paylaşımla üç yıldan uzun sürer.

## Ön koşullar

- **Depo herkese açık olmalı.** Instagram görseli ikili olarak kabul etmez, herkese
  açık bir HTTPS adresinden kendisi çeker. Kartlar `social-assets` dalına itilir ve
  `raw.githubusercontent.com` üzerinden servis edilir.
- **`social-assets` dalını elle oluşturmayın.** İş akışı ilk koşuda boş bir kök
  commit'le yaratır.

## 1. X (Twitter)

> Bu adım **ödeme yöntemi gerektirir** (yukarıdaki maliyet bölümüne bakın).
> Yalnızca Meta ile başlamak istiyorsanız bu bölümü atlayın — X'in sırları
> tanımlı değilse platform sessizce atlanır.

1. [developer.x.com](https://developer.x.com) → geliştirici hesabı açın ve
   kullandıkça öde için ödeme yöntemi tanımlayın.
2. Bir **Project** ve içine bir **App** oluşturun.
3. App → **User authentication settings** → **Set up**:
   - App permissions: **Read and write**
   - Type of App: **Web App, Automated App or Bot**
   - Callback URI ve Website URL alanları zorunludur; Play liste adresi
     (`https://play.google.com/store/apps/details?id=tr.kamusinavakademi.app`)
     ikisi için de kullanılabilir.
4. **Keys and tokens** sekmesi:
   - *API Key and Secret* → `X_API_KEY`, `X_API_SECRET`
   - *Access Token and Secret* → `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`

> ⚠️ **En sık yapılan hata:** Access Token'ı izinleri "Read and write" yapmadan
> ÖNCE üretmek. O jeton salt-okunur kalır ve paylaşım `403` ile düşer, hata mesajı
> sebebi söylemez. İzni değiştirdiyseniz jetonu **yeniden üretin** (Regenerate).

OAuth 1.0a jetonları **süresizdir** — bir kez konur, bir daha dokunulmaz. Hattın
OAuth 2.0 yerine 1.0a kullanmasının sebebi budur (bkz. `scripts/social/publish/x.ts`).

## 2. Facebook Sayfası

1. Uygulamanın bir **Facebook Sayfası** olmalı (kişisel profil olmaz).
2. [developers.facebook.com](https://developers.facebook.com) → **My Apps** →
   **Create App** → tür: **Business**.
3. Uygulama **Development** modunda kalabilir. Kendi sahibi olduğunuz sayfaya
   paylaşım yapmak için App Review **gerekmez**; yalnızca uygulamanın
   yöneticisi/geliştiricisi olmanız yeterlidir.
4. **Graph API Explorer**'ı açın, uygulamanızı seçin ve şu izinlerle bir
   *User Access Token* alın:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`, `business_management`
5. Kısa ömürlü jetonu **uzun ömürlüye** çevirin:

```bash
curl -s "https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=UYGULAMA_ID&client_secret=UYGULAMA_GIZLI&fb_exchange_token=KISA_OMURLU_JETON"
```

6. Uzun ömürlü kullanıcı jetonuyla Sayfa jetonunu alın:

```bash
curl -s "https://graph.facebook.com/v23.0/me/accounts?access_token=UZUN_OMURLU_KULLANICI_JETONU"
```

Dönen `id` → `FB_PAGE_ID`, `access_token` → `FB_PAGE_TOKEN`.

> **Sayfa jetonu neden süresiz:** Uzun ömürlü bir *kullanıcı* jetonundan türetilen
> Sayfa jetonlarının son kullanma tarihi yoktur. Kısa ömürlüden türetirseniz bir
> saatte ölür ve bunu ancak ertesi gün cron çalışınca fark edersiniz. 5. adımı
> atlamayın.

## 3. Instagram

1. Instagram hesabı **Business** veya **Creator** olmalı ve yukarıdaki Facebook
   Sayfasına **bağlı** olmalı. Kişisel hesapta bu API hiç çalışmaz.
2. Bağlı hesabın kimliğini alın:

```bash
curl -s "https://graph.facebook.com/v23.0/FB_PAGE_ID?fields=instagram_business_account&access_token=FB_PAGE_TOKEN"
```

Dönen `instagram_business_account.id` → `IG_USER_ID`.
`IG_TOKEN` olarak aynı Sayfa jetonu (`FB_PAGE_TOKEN`) kullanılabilir.

## Sırlar ve değişkenler

| Sır | Nereden |
|---|---|
| `X_API_KEY` / `X_API_SECRET` | X App → Keys and tokens |
| `X_ACCESS_TOKEN` / `X_ACCESS_SECRET` | Aynı sayfa, izinler **read+write** yapıldıktan sonra |
| `FB_PAGE_ID` / `FB_PAGE_TOKEN` | `/me/accounts` çıktısı |
| `IG_USER_ID` / `IG_TOKEN` | `instagram_business_account.id` / Sayfa jetonu |

Ayrıca iki isteğe bağlı **variable** (sır değil, Variables sekmesi):

| Değişken | Varsayılan | Ne zaman değiştirilir |
|---|---|---|
| `SOCIAL_APP_URL` | Play liste adresi | Yalnızca Play listesi taşınırsa ya da alan adı alınırsa. **GitHub Pages adresi YAZILMAZ** — web sürümü aynı içeriği ücretsiz veriyor ve satışın önüne geçiyor |
| `GRAPH_VERSION` | `v23.0` | Meta sürümü emekliye ayırdığında |

> ⚠️ **Meta Graph sürümleri ~2 yılda emekli olur.** Facebook ve Instagram bir gün
> birlikte hata vermeye başlarsa bakılacak ilk yer budur.

## Denemeden önce

Hiçbir şey paylaşmadan çıktıyı görün:

```bash
npm run social:preview
```

`social-out/` altına dört örnek kart ve metinlerini yazar; ağa çıkmaz, ledger'a
dokunmaz.

Gerçek hattı kuru çalıştırmak için: **Actions → Sosyal medya → Run workflow**,
`kuru` kutusunu işaretleyin. Kart artifact olarak bırakılır, hiçbir platforma
gitmez.

## Sorun giderme

| Belirti | Muhtemel sebep |
|---|---|
| X `403 Forbidden` | Access Token izinler değiştirilmeden önce üretilmiş — yeniden üretin |
| Instagram "medya indirilemedi" | Depo private, ya da kart adımı paylaşımdan sonra çalışmış |
| Kartta yazı yok | Üretim makinesinde DejaVu Sans yok (`card.ts` bunu yakalayıp hata verir) |
| Facebook + Instagram birlikte düştü | Graph sürümü emekli olmuş → `GRAPH_VERSION` |
| Aynı soru iki kez paylaşıldı | Ledger commit'i geri itilememiş (Actions izinleri: contents: write) |
