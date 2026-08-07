<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Kamu Sınav Akademi — geliştirme rehberi

Görevde Yükselme ve Unvan Değişikliği sınavlarına hazırlık uygulaması.
Ürün kararlarının tamamı ve gerekçeleri [PROJECT_PLAN.md](PROJECT_PLAN.md) içindedir —
mimari bir soru varsa cevabı önce orada arayın; buraya kopyalamayın.

## En kritik kısıt: çıktı tam statik olmak zorunda

Uygulama **Capacitor ile Android'e paketlenecek**. Capacitor bir WebView'e statik dosya
yükler; arkasında Node sunucusu yoktur. Bu yüzden `next.config.ts` içinde
`output: "export"` kilitlidir ve şunlar **kullanılamaz**:

- Server Actions, Route Handler (`app/api/**`), middleware, ISR, `revalidate`
- Çalışma anında doğan dinamik rotalar (ör. `/sonuc/[oturumId]`)
- Build sırasında ağ isteği (`next/font/google` dâhil — sistem font yığını kullanılıyor)
- `next/image` optimizasyonu (kapalı)

Her dinamik rota `generateStaticParams` ile **tam olarak** sayılmalıdır. Bu kısıt ihlal
edilirse `npm run build` değil, Android paketi bozulur — yani hata geç fark edilir.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | İçeriği derler, sonra dev sunucusu (`predev` bağlı) |
| `npm run build` | İçeriği derler, sonra statik export → `out/` |
| `npm run content:build` | Yalnızca içerik doğrulama + derleme |
| `npm test` | İçeriği derler, sonra Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run android:sync` | Build alır ve `out/`u Android projesine kopyalar |
| `npm run icons:build` | İkonları ve Play mağaza görsellerini koddan üretir |
| `npm run store:screenshots` | Mağaza ekran görüntülerini gerçek uygulamadan alır |

## Web yayını (GitHub Pages)

`.github/workflows/pages.yml` hazırdır ancak **yalnızca elle tetiklenir**
(`workflow_dispatch`). `push` tetikleyicisi bilinçli olarak yoktur: yayınlamak, soru
havuzunun tamamını herkese açık hâle getirir — statik export'ta sorular, doğru cevaplar ve
açıklamalar tarayıcıya iner. Dağıtım kararı her seferinde bilinçli verilmelidir.

Tetiklemeden önce depo ayarlarında **Settings → Pages → Source = GitHub Actions** seçili
olmalıdır.

**`basePath` sabit değildir.** Pages alt dizinde (`/kamu-sinav-app`), Capacitor ise kökten
servis eder. `next.config.ts` bunu `PAGES_BASE_PATH` ortam değişkeninden okur; değişkeni
yalnızca Pages iş akışı geçer (`actions/configure-pages` çıktısından). Değişken yoksa çıktı
kök tabanlıdır ve Android paketi bozulmaz. Bu değeri elle sabitlemeyin.

## Android paketleme

`android/` klasörü Capacitor tarafından üretilir ve **git'te tutulur** (Capacitor'ın
önerdiği yaklaşım). Kopyalanan web varlıkları ve Gradle çıktıları `android/.gitignore`
ile dışlanmıştır; kök `.gitignore` bunları tekrarlamaz.

- **APK yerel makinede derlenmez.** Android SDK kurulu değildir ve kurulması gerekmez;
  debug APK yalnızca `.github/workflows/android.yml`, imzalı AAB ise
  `.github/workflows/android-release.yml` içinde üretilir (Java 21 + AGP).
- Sıra bağlayıcıdır: `npm run build` → `cap sync android` → `gradlew assembleDebug`.
  `out/` yoksa Capacitor kopyalayacak bir şey bulamaz.
- `appId` (`tr.kamusinavakademi.app`) bir Java paket adıdır: küçük harf, yalnızca nokta
  ayracı; tire veya Türkçe karakter kullanılamaz. Değiştirmek `android/` klasörünün
  yeniden üretilmesini gerektirir.
- Debug imzalama anahtarını Android Gradle Plugin kendisi üretir; ayrıca keystore
  yönetmek gerekmez.

### Yayın imzalama ve sürüm

Release imzalama **yalnızca `android/keystore.properties` varsa** kurulur
(`android/app/build.gradle`). Dosya ve keystore git'te değildir; release iş akışı
ikisini de `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
sırlarından üretir. Koşullu olması bilinçlidir: anahtarı olmayan bir makinede
`assembleDebug` ve `assembleRelease` yine çalışsın, yalnızca release imzasız çıksın.

Sürüm bilgisi `android/version.properties` içindedir. `versionCode` Play'de her
yüklemede artmak zorundadır ve release iş akışı bunu `-PappVersionCode` ile
`github.run_number`dan geçirir — elle artırmayı unutmak en sık yapılan yükleme
hatasıdır.

`minifyEnabled` bilinçli olarak **kapalıdır**: R8, Capacitor köprüsünün ada göre
yansımayla çözdüğü eklenti sınıflarını budayabilir ve hata yalnızca üretimde
görünür.

Mağaza metinleri, veri güvenliği ve içerik derecelendirme cevapları `store/`
altındadır; görseller `npm run icons:build` ve `npm run store:screenshots` ile
üretilir, elle düzenlenmez. Ekran görüntüleri **anahtarsız** derlemeden alınır —
yayınlanan pakette hesap özelliği kapalıdır ve başlıkta hesap ikonu yoktur.

### İkon, splash ve marka rengi

Launcher ikonları da içerik gibi **koddan üretilir**: `npm run icons:build` hem
`public/icons/` hem `android/**/mipmap-*` altına yazar. `android/` git'te tutulduğu
için çıktılar commit'lenir; PNG'leri elle düzenlemeyin, kaynak
`scripts/generate-icons.ts` içindeki SVG'dir.

Marka rengi **üç yerde** aynı olmak zorundadır ve birlikte değişir:
`globals.css` → `--brand`, `scripts/generate-icons.ts` → `BRAND`,
`android/app/src/main/res/values/colors.xml` → `brand`.

Açılış ekranı yoğunluk başına PNG değil, tek vektördür (`drawable/ic_splash_logo.xml`);
`values/styles.xml` bunu `windowSplashScreenAnimatedIcon` ile bağlar.
`androidx.core:core-splashscreen` nitelikleri API 24'e kadar geriye taşır.

**Bu vektör de `icons:build` tarafından yazılır, elle düzenlenmez.** Launcher
ikonlarıyla aynı `COLUMN_PATH` dizesini paylaşır; ayrı tutulduğunda logo
değişince ikisi ayrışıyordu ve fark yalnızca APK açılışında görülüyordu.
İşaret bu yüzden `<rect rx>` ile değil `roundedRect()` yardımcısının ürettiği
`pathData` ile çizilir: **VectorDrawable yalnızca `<path>`, `<group>` ve
`<clip-path>` tanır** — `<rect>` ve `rx` yoktur. Yeni bir biçim eklerken de
aynı kısıt geçerlidir.

### Sistem çubukları ve safe-area

Uygulama kenardan kenara çizer. Anahtar `src/app/layout.tsx` içindeki
`viewportFit: "cover"`: Capacitor'ın yerleşik `SystemBars` eklentisi bu ibareyi
meta etiketinde arar. **Kaldırılırsa** eklenti WebView'i içeri padler ve çubukların
arkası uygulamanın temasını izlemeyen statik bir bant hâline gelir.

Kenar payları `globals.css`'teki `--safe-top/right/bottom/left` token'larından okunur;
bunlar önce Capacitor'ın enjekte ettiği `--safe-area-inset-*` değişkenlerine, yoksa
`env()`'e düşer — böylece aynı CSS hem APK'da hem tarayıcıda doğru çalışır.
Sabit konumlu yeni bir kenar öğesi eklerseniz payı bu token'lardan alın.

Durum çubuğu ikonlarının rengi `useApplyPreferences()` içinden `SystemBars.setStyle`
ile ayarlanır. Capacitor'ın varsayılanı **cihazın** gece modunu okur, uygulamanınkini
değil; bu çağrı kalkarsa kullanıcı temayı elle değiştirdiğinde ikonlar okunmaz olur.

## İçerik nasıl eklenir

İçerik **koddur**: git'te durur, PR ile gözden geçirilir, şema doğrulaması CI kapısıdır.

```
content/subjects/<dersId>/
├── subject.json                    # ders + konu ağacı
├── topics/<konuSlug>.mdx           # konu özeti (frontmatter + gövde)
└── questions/<konuSlug>.json       # soru dizisi
```

`npm run content:build` bunları `src/types/content.ts` şemalarına karşı doğrular ve
`public/content/` altına yazar (bu klasör git'e girmez). **Tek bir ihlal build'i kırar.**

Betik ayrıca kapsam raporu basar: konu başına soru sayısı, zorluk dağılımı, eksik özetler.
Uyarılar build'i kırmaz ama içerik yol haritanızdır.

Raporun sonunda **yakın-tekrar listesi** vardır (`scripts/near-duplicates.ts`): gövdeleri
birbirine benzeyen soru çiftleri, doğru cevaplarıyla birlikte. Aynı resmî soru farklı
kitapçıklarda birkaç kelimesi ve şık sayısı değişerek yayımlandığı için ithal hattının
birebir tekilleştirmesi bunları kaçırır. Liste bilinçli olarak uyarıdır, hata değil:
gövdesi neredeyse aynı iki soru farklı hükmü ölçüyor olabilir (657 md.77'de "on yıl" ve
"yirmi bir yıl" gibi). Ölçüt gövde değil, **test edilen hükümdür**; aynı hükmü ölçen
çiftlerden biri havuzdan çıkarılır, şık sayısı farklıysa 5 şıklı olan tutulur.

### Değiştirilemez içerik kuralları

Bunlar ürünün farklılaşma tezidir (PROJECT_PLAN.md §4); şema düzeyinde zorunludur:

1. Her soruda `legalRef` (mevzuat dayanağı) ve `explanation` (açıklama) **zorunlu**.
2. Her soruda `source` + `license` **zorunlu**. `license: "unknown"` olan bir soru
   `status: "published"` yapılamaz — build kırılır.
3. `source.kind: "ai-draft"` olan soru insan onayından geçmeden yayımlanamaz — build kırılır.
4. Her konu özetinde `legislationVersion` ve `lastVerifiedAt` **zorunlu**; kullanıcıya
   güven rozeti olarak gösterilir.

### ⚠️ Telif

- ✅ Kamu kurumlarının **kendi sitelerinde yayımladığı** çıkmış sınav soruları ve cevap
  anahtarları — kaynak göstererek (`kind: "official-past-exam"`, `license: "public-official"`).
- ✅ Mevzuat metinleri (mevzuat.gov.tr, Resmî Gazete).
- ❌ Özel yayınevlerinin ve ücretli platformların soru bankaları — **kopyalanamaz, kazınamaz.**
- ❌ Kaynağı doğrulanamayan derlemeler — `license: "unknown"` kalır, yayımlanamaz.

### Çıkmış sınav ithal hattı

`npm run ingest:past-exam` **yalnızca** yukarıdaki ilk maddeyi otomatikleştirir:
kamu kurumunun kendi sitesinde yayımladığı bir soru kitapçığı + cevap anahtarı
(PDF) → aday soru JSON. Betik PDF'i çıkarır, soruları anahtarla eşler ve üç
dersimize (`657-dmk`, `anayasa`, `etik`) göre sınıflandırır; saf mantık
`scripts/ingest/` altında ve testlidir (`tests/unit/ingest-past-exam.test.ts`).

Bazı kurumlar ayrı cevap anahtarı yerine **cevaplı kitapçık** yayımlar: doğru şık
kitapçığın içinde renkle işaretlidir ve düz metin çıkarımında kaybolur. `--marked-key`
(manifestte `"markedKey": true`) bu biçimi okur; cevap PDF operatör listesindeki
renkten çıkarılır. Şık, harften değil **içerikten** belirlenir ve her eşleşme şık
metniyle doğrulanır — eşleşmeyen soru cevapsız bırakılır, tahmin edilmez
(`scripts/ingest/parse-marked-key.ts`).

Hat, yazmadan önce adayları **mevcut havuza karşı eler** (`scripts/ingest/pool.ts`):
`content/subjects/**` altında birebir karşılığı olan aday (aynı gövde + aynı şık
kümesi, şıklar karışık olsa da) sessizce düşülür; yakın olanlar tutulup uyarı
listesine girer. Bu olmadan ikinci bir kitapçık partisi ilk partide alınmış soruları
yeniden inceleme kuyruğuna sokuyordu.

Çıktı **yayımlanabilir içerik DEĞİLDİR, inceleme kuyruğudur**: her adayın
`difficulty`, `legalRef` ve `explanation`'ı boştur. Bunlar resmî kaynakta
bulunmaz; bir editör (Faz 5'te AI-destekli, yine onaylı) doldurup adayı
`content/subjects/**` altına taşımadan `content:build`'den geçmez. Yani hat
mekanik işi (çıkarım, eşleştirme, sınıflandırma) otomatikleştirir; telif ve
kalite güvencesi olan editoryal adım insanda kalır.

Kullanım ve emsal kaynaklar (MEB ÖDSGM, Sayıştay vb.) için `scripts/ingest-past-exam.ts`
başlığındaki yorumlara bakın. Ücretli/özel kaynaklara **asla** bağlanmayın.

## Mimari kuralları

- **Dexie'ye doğrudan dokunulmaz.** Tüm ilerleme verisi
  `lib/repositories/progress.repository.ts` arayüzünden geçer. Faz 3'te sunucu geldiğinde
  yalnızca ikinci bir implementasyon yazılacak; çağıran bileşenler değişmeyecek.
- **`attempts` tablosu append-only.** Güncellenmez, silinmez. `dailyStats` yalnızca
  önbellektir ve bu günlükten yeniden üretilebilir. `topicProgress` için bu **yalnızca
  sayaç alanlarında** geçerlidir: `summaryRead`/`summaryReadAt` günlükten türetilemez ve
  yeniden inşa eden kod onları korumak zorundadır.
- **Kimlik tek yerden okunur.** Satırların `userId` damgası `lib/auth/identity.ts`
  içindeki `currentUserId()` üzerinden gelir; giriş yapılmamışsa `"local"`dir. Çağıran
  kod `userId` vermez — repository damgalar. Alanı kaldırmayın, senkronun şema göçü
  gerektirmemesi buna bağlı.
- **Kimlik değişimi ile veri taşıma ayrılmaz.** İkisi `lib/auth/session.ts` içinde
  birlikte yürür ve sıra bağlayıcıdır: **önce `reassignOwner`** (eski kimlik hâlâ
  aktifken), **sonra `setIdentity`**. Ters sırada repository satırları filtreleyip
  dışarıda bırakır; kullanıcı ilerlemesini kaybetmiş görünür. `setIdentity`'yi
  doğrudan çağırmayın.
- **Hesap özelliği isteğe bağlıdır.** Supabase anahtarı yoksa `authProvider`
  kendiliğinden `LocalAuthProvider`a düşer ve uygulama eksiksiz çalışır — CI da
  anahtarsız derler. Kimlik doğrulamaya bağlı hiçbir kod, anahtar varmış gibi
  yazılmamalıdır.
- **Supabase SDK'sı dinamik yüklenir** (`lib/auth/supabase-client.ts`). Statik içe
  aktarım, kök düzendeki oturum uzlaştırıcısı üzerinden SDK'yı ortak pakete sokuyor ve
  ölçüldüğünde her sayfaya 227 KB ekliyordu. Buraya `import { createClient }` yazmayın.
- **Yerel veritabanı tek kullanıcılıktır.** IndexedDB satırları her zaman o an aktif olan
  TEK kimliğe aittir; kullanıcı ayrımı sunucuda (RLS) yapılır. Kimlik değişimi her zaman
  bir Dexie yazmasıyla birlikte olur (`reassignOwner`), böylece `useLiveQuery`
  abonelikleri kendiliğinden tazelenir.
- **Append-only olmayan her kayıtta `updatedAt` var.** Senkron çakışması "son yazan
  kazanır" ile buradan çözülür. Yeni bir güncellenebilir tablo eklerseniz alanı da ekleyin.
- **`lib/` React import etmez.** Puanlama, seçici ve hakimiyet saf fonksiyondur; bu yüzden
  hızlı ve kolay test edilir. Yeni iş mantığı `features/` değil `lib/` altına yazılır.
- **Rota bağlantıları `lib/routes.ts` üzerinden.** `typedRoutes` açık olduğu için şablon
  dizesi bağlantılar reddedilir; dönüştürme tek yerde toplanmıştır.
- **Paywall çalışma anında seçilir, derleme anında değil.** Tek `out/` klasörü hem
  GitHub Pages'e hem Capacitor paketine gidiyor; bu yüzden `getBillingProvider()`
  (`lib/billing/billing.provider.ts`) `Capacitor.isNativePlatform()`e bakar ve
  tarayıcıda `OpenBillingProvider`a düşer — **webde hiçbir kilit yoktur**.
  `authProvider`dan farkı budur: o `isAccountConfigured()` ile derleme anında seçilir.
  Kilit kararları `lib/billing/entitlement.ts` içinde saf fonksiyonlardır; ücretsiz
  kapsam `FREE_SUBJECT_ID`/`FREE_TOPIC_SLUG`/`FREE_TEST_SLUG` sabitleriyle tanımlıdır
  ve `content-integrity` testi bu slug'ların içerikte gerçekten var olduğunu doğrular
  (yeniden adlandırılırsa ücretsiz kapsam sessizce sıfıra düşerdi).
- **Hak Dexie'de DEĞİL, localStorage'da.** Üç gerekçe: (1) `exportAll`/`importAll`
  tüm Dexie tablolarını JSON'a yazıp geri okuduğu için yedek dosyası çalışan bir
  lisans anahtarına dönüşürdü; (2) IndexedDB açılamazsa ödemiş kullanıcı kilitli
  kalırdı; (3) satın alma Google hesabına bağlıdır, uygulamanın `userId`sine değil —
  senkron geldiğinde sunucuya gitmemelidir. Yerel kayıt yalnızca **önbellektir**;
  kaynak her zaman Play'in `getPurchases()` cevabıdır ve her başarılı sorguda
  (`false` bile olsa) üzerine yazılır, böylece iade kendiliğinden geri alınır.
- **Test APK'sı için `NEXT_PUBLIC_TEST_FULL_ACCESS=1`.** Cihazda tüm konuları
  kilitsiz denemek için `lib/billing/test-build.ts` bayrağı hakkı sabitler
  (`paywallActive: true, fullAccess: true` — kilitleri kaldırmaz, **satın almış
  kullanıcıyı taklit eder**; `false` yazmak satın alma ekranını ve rozet mantığını
  hiç çalıştırmazdı). Play'e sorulmaz ve **önbelleğe yazılmaz**: kalıcı bir
  "satın alınmış" izi, aynı cihaza sonradan kurulan normal APK'yı da açık
  gösterirdi. Bayrağı yalnızca `android.yml`in elle tetiklenen dalı geçer;
  `android-release.yml`e **eklemeyin** — imzalı AAB'de tüm içerik ücretsiz
  açılırdı ve hata ancak Play'e yüklendikten sonra görülürdü.
- **Kilit sarmalayıcıdır, koşucunun içinde değil.** `QuizGate` kilitliyken
  `QuizRunner`ı hiç mount etmez; koşucu monte edilir edilmez bir `testSessions`
  satırı yazdığı için kilidi içeriden uygulamak kilitli testlere oturum kaydı
  üretirdi. Aynı gerekçeyle `AccessGate` de içeriğin etrafındadır.
- **Faturalandırma eklentisi dinamik yüklenir** (`lib/billing/native.provider.ts`).
  Statik içe aktarım `@capgo/native-purchases`i tarayıcı paketine sokar; ölçüldü,
  bugün eklenti chunk'ına **hiçbir HTML sayfası referans vermiyor**. Buraya
  `import { NativePurchases }` yazmayın (`supabase-client.ts` ile aynı kural).
- **Sesli okuma tarayıcı API'siyle YAPILAMAZ.** Web Speech API
  (`window.speechSynthesis`) Android WebView'de çalışmaz (Chromium issue 40417848,
  hâlâ açık); Chrome Android'de çalıştığı için tarayıcıda ve testlerde her şey yolunda
  görünür, **yalnızca APK'da sessizce ölür**. Bu yüzden
  `@capacitor-community/text-to-speech` zorunludur ve `lib/speech/speech.provider.ts`
  içinden **dinamik** yüklenir. Metin ham MDX'ten değil, render edilmiş DOM'dan
  çıkarılır (`lib/speech/extract.ts`): tablolar zaten `<thead>/<td>` yapısında,
  `<Madde>` kendi önekini basıyor ve HTML boyutu hiç büyümüyor. Atlanacak yerler
  seçiciyle değil **nitelikle** işaretlenir (`data-tts="skip"`, mevcut
  `data-print="hide"` yeniden kullanılır); vurgulama React'in değil hook'un yazdığı
  `data-tts-active` niteliğiyle yapılır — `className`e dokunmak bir sonraki render'da
  sessizce silinirdi.

- **Sesli okumada parça = BLOK, cümle değil.** Eklentinin Android tarafı her `speak()`
  çağrısında motoru önce **durdurup baştan yapılandırıyor**
  (`TextToSpeech.java`: `stop()` → `setLanguage` → `setSpeechRate` → `setVoice`).
  Cümle cümle çağırmak bir özette ~120 kez bu döngü demekti: cümleler arası boşluk ve
  her cümlede prosodi sıfırlaması — kesik, robotik okumanın baskın sebebi. `bloklaraAyir`
  (`lib/speech/sentences.ts`) bu yüzden bloğun tamamını tek parça verir ve **yalnızca**
  400 karakteri aşınca, **yalnızca cümle sınırından** böler. Virgülden bölmek cümle
  ortasında tam durak ve düşen tonlama üretir; asla yapılmaz. `MOTOR_TAVANI` bir UX
  eşiği değil, motorun girdi sınırıdır (Android `getMaxSpeechInputLength()` = 4000).

- **Sesli okumada tek başına duran büyük harf ROMEN RAKAMI okunur.** Cihazda ölçüldü:
  "Fıkra C" → "Fıkra yüz", "Fıkra D" → "Fıkra beş yüz" (C=100, D=500); aynı tuzak
  I, V, X, L ve M için de geçerli. `HARF_ADLARI` (`lib/speech/normalize-tr.ts`) harfi
  adıyla yazar ("ce", "de") ve sesi motorun yorumuna bırakmaz. Kural **bağlama
  bağlıdır ve öyle kalmalıdır**: yalnızca harfin fıkra/bent adı olduğu kesin olan üç
  yerde uygulanır (`4/C` gösterimi, "(C) fıkrası" ve harf listeleri, tek harften
  ibaret tablo hücresi). Genel bir "tek harfi çevir" kuralı **"(I) sayılı cetvel"**
  ifadesini bozar — orada romen rakamı bilinçlidir ve motorun "bir" okuması doğrudur.
- **Konu özetinin okuma kromu `SummaryReader`a girer, `SummaryDocument`a DEĞİL.**
  İçindekiler, okuma ilerleme şeridi, sona varış nirengisi ve yer imi düğmesi
  sarmalayıcıdadır; belge bileşeni dokunulmadan kalır çünkü **ders paketi de
  (`konular/[subject]/yazdir`) onu kullanıyor** — oraya eklenen her şey 6-8
  konuluk yazdırma çıktısında tekrarlanırdı.

  Eklenen her krom öğesi `data-print="hide"` **ve** `data-tts="skip"` taşır.
  Asıl koruma yapısaldır: yeni öğelerin hiçbiri `kokRef`in İÇİNDE değildir ve
  `lib/speech/extract.ts` yalnızca orayı gezer. Nitelikler ikinci savunma
  hattıdır; yerleşim değişip bir öğe köke girerse metin sesli okumaya sızardı.

- **Yapışkan öğeler `--baslik-yuksekligi` token'ından beslenir.** Başlık
  `min-h-11 + py-3 + border-b` = `4.25rem + 1px`tir ve **rem tabanlı olduğu için
  yazı boyutu tercihiyle büyür** (`cok-buyuk`ta ~85px). Sabit piksel veren öğe
  büyük yazıda başlığın arkasına gizlenir; ölçüldü, 64px'lik şerit 68.8px'lik
  başlığın altında tamamen kayboluyordu. Sesli okuma oynatıcısı da aynı
  token'dan 3px aşağı yapışır — ikisi aynı ofsette olsaydı oynatıcının opak
  zemini şeridi örterdi.

  Aynı gerekçeyle içindekiler **`scroll-margin-top` KULLANMAZ**: sesli okuma
  aynı başlıkları `scrollIntoView({ block: "center" })` ile ortalıyor ve
  scroll-margin o kutuyu kaydırıp elemanı gerçek merkezin altına iter. Pay
  yalnızca tıklama anında, JS'te uygulanır.

- **Başlık id'leri istemcide üretilir; `rehype-slug` eklenmez.**
  `github-slugger` `toLowerCase()` kullanır ve bu depoda Türkçe için yasaktır —
  başlıklardan bozuk slug'lar üretirdi. id'ler konum tabanlıdır (`bolum-1`…) ve
  listeyle aynı DOM gezintisinden çıkar, dolayısıyla ikisi ayrışamaz.

- **`unmarkSummaryRead` `summaryReadAt`i DE siler.** `markSummaryRead` o alanı
  bilinçli olarak korur (ilk okuma tarihi kaybolmasın); yalnızca bayrağı
  çevirmek "okunmadı ama okunma tarihi var" diyen tutarsız bir satır bırakırdı.
  Satır silinmez — sayaç alanları attempt günlüğünden türer.

- **Geri gezinme tek yerden.** `useBackNavigation` (`components/layout/`) kök düzende
  BİR KEZ çağrılır; hem başlıktaki tuş hem Android donanım tuşu aynı `goBack`e bağlanır.
  Geçmiş derinliği sayacı bileşen içinde tutulduğu için ikinci bir çağrı ikinci bir sayaç
  doğurur ve iki tuş uyumsuz davranmaya başlar. `BackButton` yalnızca görünümdür.
- **Depolama yokluğu uygulamayı kilitlemez.** IndexedDB açılamazsa (gizli mod, kota, eski
  WebView) `checkDatabase()` bunu bir kez yoklar ve `DatabaseNotice` şeridi durumu söyler;
  konu özetleri, testler ve denemeler içerik dosyalarından okunduğu için çalışmaya devam
  eder. Kaybolan yalnızca ilerleme kaydıdır — yeni bir Dexie çağrısı eklerken hata yolunu
  da yazın, `useLiveQuery` hata hâlinde `undefined` dönüp sonsuz iskelet gösterir.

## Tasarım token'ları

Renk, gölge, gradyan ve yarıçap **yalnızca** `globals.css`'teki token'lardan gelir;
bileşenlere sabit renk yazılmaz. Üç kural kırılgandır:

- **Her token DÖRT varyantta da tanımlanır:** açık, koyu, `[data-contrast="yuksek"]`
  ve `@media print`. Yüksek kontrastta gölgeler `none`a, gradyan düz renge iner
  (gradyan üstünde kontrast oranı zeminin en açık noktasına göre düşer); baskıda
  ikisi de kâğıda geçmez. Bir varyantı atlamak hatayı **yalnızca o modda** doğurur.

- **⚠️ Koyu tema İKİ blokta tanımlıdır** — biri `@media (prefers-color-scheme: dark)`
  içinde, diğeri `:root[data-theme="koyu"]`. CSS'te tek yerde toplanamıyorlar.
  Yeni token'ı **ikisine de** yazın: yalnızca birine yazmak, kullanıcı temayı elle
  seçtiğinde çalışan ama cihaz gece moduna geçtiğinde sessizce açık tema değerine
  düşen bir hata üretir. Bu tuzağa bir kez düşüldü.

- **Renk opaklıkla TÜRETİLMEZ.** `opacity-*` ile soluklaştırılan metin token
  sisteminin dışına çıkar ve kontrastı sessizce düşürür: ölçüldü, `--fg-muted`
  %60 opaklıkta 3.56:1'e iniyor ve AA eşiğini geçemiyor (axe yakaladı). Daha
  soluk bir ton gerekiyorsa `--fg-subtle` vardır; yoksa yeni bir token tanımlanır.

- **`--accent` DEKORATİFTİR, durum taşımaz.** Doğru/yanlış/işaretli/kilitli için
  kullanılamaz — o anlamlar `--correct`/`--wrong`/`--flag`ındır. Yalnızca başarı ve
  alışkanlık yüzeylerinde (seri şeridi, hedef tamamlama) görünür; quiz ekranlarında
  hiç bulunmaz, bu yüzden `--correct` ile karışma riski yoktur.

Kahraman yüzeyler (`.kahraman-yuzey`) gradyan zemini ve ön plan rengini **birlikte**
getirir; ikisini ayrı ayrı uygulamayın. Üstlerindeki buton `variant="kahraman"`
kullanır: gradyan her iki temada da derin lacivert kaldığı için renkleri
`surface`/`brand` token'larından alınamaz — koyu temada ikisi de ters döner ve buton
zemine gömülür. **Aynı ekranda en fazla bir gradyan yüzey** bulunur; ikincisi
hiyerarşiyi yeniden düzleştirir.

Hareket tek bir eğri ve tek bir süreyle sınırlıdır (`--ease-cikis`, 150 ms) ve tek
animasyon `belir`dir. Yeni bir `prefers-reduced-motion` kuralı **yazmayın**: mevcut
global blok tüm animasyon ve geçiş sürelerini zaten kısıyor ve yenileri de yakalıyor.

## Erişilebilirlik sözleşmesi

Hedef kitlenin yaş profili nedeniyle bunlar "sonra bakarız" değil, kabul kriteridir:

- Dokunma hedefi **≥ 44px** (`min-h-11`). WCAG asgarisi 24px; bilinçli olarak yükseltildi.
- Hiçbir yerde `outline: none` yok; odak halkası `globals.css`'teki `:focus-visible`.
- **Renk tek başına anlam taşımaz** — doğru/yanlış her zaman ikon + metinle birlikte.
- Yazı boyutu üç kademeli ve `rem` tabanlı (`data-font-scale`), böylece boşluklar da ölçeklenir.
- Form kontrolleri gerçek `input`/`label`/`fieldset` — klavye ve ekran okuyucu desteği
  tarayıcıdan gelir, yeniden yazılmaz.
- `prefers-reduced-motion` mutlak saygı görür.

Görsel tercihler (tema, yazı boyutu, kontrast) Dexie'de **değil** localStorage'dadır —
ilk boyamadan önce senkron okunmaları gerekir (`components/layout/preferences-script.tsx`).
Anahtar veya şekil değişirse o betiği de güncelleyin.

## Bilinen tuzaklar

- **`npm run dev` açıkken `npm run build` almayın.** İkisi aynı `.next/` dizinini
  paylaşır; dev sunucusu çalışırken alınan build **sessizce eksik** bir `out/`
  üretir (ölçüldü: `out/_next` altındaki paketler yazılmaz, çevrimdışı indirme
  listesi 1331 yerine 177 dosya olur). Build hata vermez, sayfalar da açılır —
  bozukluk ancak Capacitor paketinde ya da çevrimdışı kullanımda ortaya çıkar.
  Şüphelenirseniz `postbuild` çıktısındaki dosya sayısına bakın; düşükse
  `.next/` ve `out/` silinip build tekrarlanmalıdır.

  Aynı bozukluk `.next/` **kısmen silindiğinde** de oluşur (OneDrive altında
  `rm -rf` kilitli dosyalarda sessizce başarısız olabilir) ve o hâlde sayı daha
  ince bir yerden düşer: sayfalar üretilir ama RSC yükleri (`out/**/*.txt`)
  yazılmaz. Ölçülen örnek: sağlam build 2037 kayıt / 1802 `.txt`, bozuk build
  1233 kayıt / neredeyse hiç `.txt`. İkisinde de sayfalar açıldığı için fark
  yalnızca bu sayıdan anlaşılır.

- **Capacitor eklenti nesnesini `async` fonksiyondan DÖNDÜRMEYİN.** `registerPlugin`
  her özellik erişimini köprüye çeviren bir Proxy üretir ve `then` de bir özelliktir.
  Proxy doğrudan bir `async` fonksiyondan döndürülürse JavaScript onu "thenable" sanıp
  `.then()` çağırır, Proxy bunu native bir metoda çevirir ve çağrı
  `"X.then() is not implemented"` ile patlar. Sarmalayıcı içinde döndürün
  (`return { api: NativePurchases }`). Hata sessizdir: `getBillingProvider` gibi
  try/catch'li yollarda **yalnızca cihazda** görünür.

- **Türkçe metinde `toLowerCase()` kullanmayın.** Varsayılan yerel ayar "I" harfini
  "i" yapar; Türkçede "ı" olmalıdır. Arama ve karşılaştırmalarda
  `lib/search/normalize.ts` içindeki `foldForSearch` kullanılır — hem `tr` yerel
  ayarını hem aksan sadeleştirmesini uygular. İndeks ve sorgu **aynı** fonksiyondan
  geçmezse eşleşme sessizce bozulur.
- **Commit mesajlarında çift tırnak kullanmayın.** PowerShell here-string içindeki `"`
  karakterleri git'e giderken argüman ayrıştırmasını bozar ve mesaj pathspec olarak
  yorumlanır. Uzun mesajları dosyaya yazıp `git commit -F <dosya>` ile verin.

- **`compileMDX` GFM içermez.** `remark-gfm` eklenmezse markdown tabloları ham
  `| a | b |` metni olarak kalır. Konu özetleri tablo ağırlıklıdır.
- **Dexie'de bileşik anahtarlı tablolar `Table<T, [string, string]>` ile tiplenir.**
  `EntityTable<T, "alan">` yalnızca tek alanlı anahtarlar içindir ve bileşik anahtarla
  `get`/`delete` çağrılarını yanlış tipler.
- **`getDb()` sunucuda çağrılamaz.** IndexedDB tarayıcıya özgüdür; çağıran bileşen
  `"use client"` olmak zorundadır.
