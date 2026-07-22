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
  APK yalnızca `.github/workflows/android.yml` içinde üretilir (Java 21 + AGP).
- Sıra bağlayıcıdır: `npm run build` → `cap sync android` → `gradlew assembleDebug`.
  `out/` yoksa Capacitor kopyalayacak bir şey bulamaz.
- `appId` (`tr.kamusinavakademi.app`) bir Java paket adıdır: küçük harf, yalnızca nokta
  ayracı; tire veya Türkçe karakter kullanılamaz. Değiştirmek `android/` klasörünün
  yeniden üretilmesini gerektirir.
- Debug imzalama anahtarını Android Gradle Plugin kendisi üretir; ayrıca keystore
  yönetmek gerekmez.

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
