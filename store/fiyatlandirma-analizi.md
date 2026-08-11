# Fiyatlandırma analizi — `tam_erisim` ürünü

Play Console'a girilecek tek seferlik satın alma fiyatının gerekçesi. Fiyat
kodda **yoktur** (`src/lib/billing/products.ts` yalnızca ürün kimliğini tutar,
tutar mağazadan okunur), bu yüzden karar yalnızca burada kayıtlıdır.

> **Veri tarihi: 10 Ağustos 2026.** Play liste fiyatları ve indirme sayıları
> mağaza sayfalarından doğrudan alınmıştır; web platformlarının paket fiyatları
> derlemedir (bkz. §6). Rakip fiyatları bu pazarda hızlı değişiyor — karar
> yeniden tartışılacaksa tablo önce tazelenmelidir.

## 1. Rakip tablosu (Play TR, "görevde yükselme" ve "unvan değişikliği")

| Uygulama | İndirme | Puan | Model | Fiyat |
|---|---|---|---|---|
| Kamusınav (Pratik Akademi) | 10.000+ | 4,1 | Ücretsiz uygulama + **web üyelik** | Play'de IAP yok |
| Atabeg – Kurum Sınavları | 10.000+ | 4,3 | Ücretsiz + Play IAP | **₺179,99 – ₺1.499,99** |
| KamudaGYS | 5.000+ | 3,8 | Ücretsiz uygulama + **web üyelik** | Play'de IAP yok |
| GYSCepte | 5.000+ | 3,2 | Ücretsiz uygulama + **web paket** | Play'de IAP yok |
| GYS Şube Müdürlüğü (2026) — Güncel Akademi | 5.000+ | 3,6 | Ücretsiz + IAP | **₺399,99** (tek ürün) |
| GYSKAMU | 1.000+ | 4,1 | Ücretsiz + **kurum başına** IAP | **₺399,99 – ₺1.799,99** |
| 2026 Şube Müdürlüğüne Hazırlık — sinavtime | 1.000+ | 4,5 | Peşin ücretli + IAP | **₺399,99** + ₺449 IAP |
| GYS MEB Şeflik (2025) — Güncel Akademi | 1.000+ | 2,1 | Peşin ücretli + IAP | ₺249,99 + ₺399,99 IAP |
| gysakademi | 1.000+ | 4,5 | Ücretsiz | — |
| Yükselen Zeka | 1.000+ | — | Ücretsiz | — |
| YÖK GYS 2026 | 500+ | 4,2 | Ücretsiz + IAP | **₺149,99 – ₺999,99** |
| GYS Mobil (YZ destekli) | 100+ | — | **Reklamlı** + IAP | ₺1.799,00 (tek ürün) |
| GYS İçişleri | 100+ | 4,9 | Peşin ücretli | ₺799,99 |
| Statü Geçiş Sınavı GYS PRO | 100+ | — | Peşin ücretli | ₺399,99 (2024'ten beri güncellenmemiş) |
| GYS 657 · GYS Platformu | 100+ | 5,0 / — | Ücretsiz | — |

**Basılı alternatif** (Pegem 2026 baskıları, indirimli): Belediye ₺316 · YÖK ₺364 ·
MEB Memurluk ₺532 · MEB Şeflik ₺644 · Tüm Kamu Kurumları ₺700 ·
MEB Şube Müdürlüğü ₺728 · Diyanet ₺840.

## 2. Pazardan çıkan beş sonuç

**a) Pazar sığ.** Kategori lideri bile 10.000+ indirmede; tüm GYS uygulamalarının
toplamı kabaca 40–50 bin. Hacimle kazanılacak bir pazar değil — belirleyici olan
dönüşüm oranı, dönüşümü de fiyattan çok **güven** belirliyor.

**b) Üç net fiyat kuşağı var.**

| Kuşak | Aralık | Kimler |
|---|---|---|
| Giriş / deneme SKU'su | ₺149 – ₺180 | Atabeg ve YÖK GYS'in en ucuz paketi |
| **Uygulama-yerlisi tam erişim** | **₺400 – ₺450** | Güncel Akademi, sinavtime, Statü Geçiş — **en kalabalık kuşak** |
| Kuruma özel paket / web platformu | ₺800 – ₺1.800 | GYSKAMU üst paketleri, GYS İçişleri, GYS Mobil |

**c) En büyük üç rakip Play'den tahsilat yapmıyor.** Kamusınav, KamudaGYS ve
GYSCepte'nin Play listelerinde uygulama içi satın alma **yok**; uygulama web
platformunun kabuğu ve ödeme sitede alınıyor. Bu %15 Google komisyonundan kaçınma
hamlesi, ama bize iki avantaj bırakıyor: satın alma akışımız cihazda tek dokunuş,
ve Play'in iade garantisi bizde var onlarda yok. Bu pazarda ciddi bir fark —
adı geçen markaların şikâyet forumlarında "ödeme alındı, erişim açılmadı"
başlıkları var.

**d) ₺400+ isteyen herkes kuruma özel içerik satıyor.** O fiyata çıkan her
uygulama tek bir sınava kilitli (MEB Şube Müdürlüğü, YÖK, İçişleri) ve **alan
bilgisi** içeriyor. Bizim beş dersimiz hemen her kurumun **ortak konuları** —
geniş ama sığ taraf. ₺399,99 istemek bugün savunulamaz.

**e) Farklılaşma tezimiz rakiplerin hiçbirinde yok:** her soruda mevzuat dayanağı
ve açıklama, tarihli konu özetleri, çevrimdışı çalışma, hesapsız kullanım,
reklamsızlık, sesli okuma ve erişilebilirlik. Fiyat bunun üstüne kurulmalı — ama
bilinmeyen bir geliştiricinin sıfır yorumla bu tezi satması, fiyat düşükken çok
daha kolay.

## 3. Play ekonomisi

Türkiye'de girilen fiyat **KDV dâhildir** (%20) ve Google hizmet bedeli %15'tir
(yıllık ilk 1M$). Net gelir ≈ fiyat × 0,708.

| Etiket fiyatı | Cebe giren |
|---|---|
| ₺149,99 | ~₺106 |
| ₺199,99 | ~₺142 |
| ₺249,99 | ~₺177 |
| ₺299,99 | ~₺212 |
| ₺399,99 | ~₺283 |

## 4. Karar

> **Lansman fiyatı: ₺249,99.** Tek seferlik `tam_erisim` ürünü.
> **12 ay içindeki hedef: ₺299,99.** ₺399,99'a kuruma özel alan bilgisi
> eklenmeden **çıkılmaz** — o fiyatta doğrudan karşılaştırıldığımız
> uygulamaların hepsinde sınava özel içerik var.

> ⚠️ **Bu fiyat, aşağıdaki analizin önerdiği ₺199,99 değildir.** 12 Ağustos
> 2026'da ürün sahibi lansmanı ₺249,99'dan yapmaya karar verdi. Karar
> bilinçlidir ve burada olduğu gibi kayıtlıdır; aşağıdaki gerekçeler
> ₺199,99 için yazılmıştı ve **tazelenmemiştir**. İkisi arasındaki fark
> net gelirde satış başına ~₺35'tir (₺142 → ₺177).
>
> Analizin kendi ölçütüyle çeliştiği nokta: §4'teki "zam eşiği" ₺249,99'a
> çıkmadan önce havuzun 2.000'i geçmesini **ve** 25+ yorumla 4,3+ ortalama
> tutmasını şart koşuyordu; lansmanda ikisi de yok. Yani bu fiyat, sosyal
> kanıt birikmeden üst banda yerleşiyor. İlk 25 yorum geldiğinde dönüşüm
> oranına bakılıp yeniden değerlendirilmesi gerekir — düşükse indirmek
> serbesttir ve satın almış kullanıcıyı etkilemez.

Gerekçe:

1. **En ucuz basılı GYS kitabının (₺316) altında.** "Bir kitabın üçte ikisi
   fiyatına, güncel ve dayanaklı" savunulabilir bir cümle; ₺399,99'da kayboluyor.
2. **Baskın ₺400 kuşağının yarısı.** Aynı kuşakta fiyatlanıp içerik derinliğinde
   geride kalmaktansa, bir kuşak altta net üstünlükle durmak daha iyi.
3. **₺149,99'un üstünde.** O bant rakiplerin *deneme paketi* fiyatı; oraya inmek
   1.322 soruluk havuzu deneme paketi gibi konumlandırır.
4. **Bu hacimde bileşik etki fiyattan önemli.** 1.000 indirmede %3 dönüşüm = 30
   satış → ₺199,99'da ~₺4.250. ₺399,99'da dönüşüm yarılanırsa gelir aynı, ama
   düşük fiyatta **iki kat yorum** birikir ve sıralama yükselir. İlk sürümde
   satın alınacak şey gelir değil, sosyal kanıttır.

**Alternatif senaryo.** Öncelik gelir değil yorum ve sıralama ise **₺149,99** ile
açıp ilk 25 yorumdan sonra ₺249,99'a çıkın. Console'da IAP fiyatını yükseltmek
serbesttir ve satın almış kullanıcıları etkilemez (ürün tek seferliktir).

**Zam eşiği.** Fiyatı yükseltmeden önce ikisi birden sağlanmalı: soru havuzu
2.000'i geçmiş **ve** en az 25 yorumla 4,3+ ortalama tutmuş olmalı. Yalnızca
içerik büyütüp yorumsuz zam yapmak, bilinmeyen geliştirici dezavantajını
fiyata ekler.

## 5. Fiyattan daha önemli iki mesele

**Ücretsiz katman dardı — genişletildi.** Rapor yazıldığında 1.322 sorudan
**10'u** (%0,8) ve 30 konu özetinden biri açıktı; bilinmeyen bir geliştiriciden
üç haneli tutar isterken bu, kullanıcıya ürünü tartacak malzeme bırakmıyordu.
Ücretsiz kapsam bunun üzerine **her dersin ilk konusuna** çıkarıldı
(`FREE_TOPIC_BY_SUBJECT`, `src/lib/billing/entitlement.ts`): 5 konu özeti ve 50
soru, yani havuzun ~%4'ü. Asıl kazanç oran değil kapsama — kullanıcı beş dersin
**hepsinin** biçimini satın almadan görüyor; önceki hâlde dört dersin tek bir
örneğini bile göremiyordu.

**İsim çakışması.** "Kamusınav" (10.000+ indirme, 4,1) ile "Kamu Sınav Akademi"
Play aramasında yan yana çıkıyor ve o markanın ödeme şikâyetleri var; karıştıran
bir kullanıcı bize de mesafeli yaklaşır. `listing-tr.md`'deki kısa açıklamada
"bağımsız" ve "tek seferlik ödeme, abonelik yok" vurgusunu öne almak bunu kısmen
karşılar.

## 6. Doğruluk notu

- **Kesin:** Play liste fiyatları, uygulama içi satın alma aralıkları, indirme
  sayıları ve puanlar — mağaza sayfalarından doğrudan okundu.
- **Mertebe doğru, rakam kesin değil:** web platformlarının paket fiyatları
  (KamudaGYS ~₺399–₺999, Kamusınav VIP ~₺300, GYSCepte ₺1.500 / ₺8.500). Kısmen
  şikâyet forumlarından derlendi.
- **Aynı kategoride değil:** GYSCepte'nin ₺8.500'lük paketi 230 saat video
  içeriyor; kıyas için değil, kuşağın üst sınırını göstermek için tabloda.
