# Play Console yükleme kılavuzu

İlk yüklemenin **sırayla** izlenecek adımları. Bu dosya bir yürüyüş rehberidir;
formların **cevapları** burada değil, kendi dosyalarındadır
([listing-tr.md](listing-tr.md), [data-safety.md](data-safety.md),
[content-rating.md](content-rating.md)) ve tek kaynak orasıdır — buraya
kopyalanmaz, yoksa iki yer ayrışır.

> **Menü adları Console'un Türkçe arayüzünden birebir alınmıştır** (kaynak: Play
> Console Yardım, Ağustos 2026). Google bunları zaman zaman değiştiriyor.
> Tutmadığını görürseniz **tahmin etmeyin**: yardım merkezinden doğrulayıp
> burayı güncelleyin. Bir kez tahminle yazıldı ve Console'da karşılığı çıkmadı.

**Sıra bağlayıcıdır.** Ödeme profili olmadan ürün oluşturulamaz, ürün olmadan
satın alma test edilemez, paket yayınlanmadan lisans testi çalışmaz.

## 0. AAB'yi indirin

Paket yerel makinede derlenmez; `android-release.yml` iş akışı üretir ve
artifact olarak yükler (30 gün saklanır).

```bash
gh run download <run-id> --repo acansahin/kamu-sinav-app -n kamu-sinav-akademi-release-aab -D <hedef-klasor>
```

Artifact süresi dolduysa iş akışını yeniden tetikleyin. `versionCode`
`run_number`dan geldiği için yeni paket kendiliğinden bir sonraki numarayı
alır; elle artırmak gerekmez.

İndirdikten sonra imzayı **doğrulayın** — Gradle keystore yoksa imzasız paketi
sessizce üretir ve bu ancak Play reddedince fark edilir (bkz.
[README.md](README.md#manifest-ve-boyut-kontrolü)).

## 1. Uygulamayı oluşturun

| Alan | Değer |
|---|---|
| Uygulama adı | Kamu Sınav Akademi |
| Varsayılan dil | Türkçe |
| Uygulama mı, oyun mu | Uygulama |
| Ücretsiz mi, ücretli mi | **Ücretsiz** |
| Paket adı (sorulursa) | `tr.kamusinavakademi.app` |

⚠️ **Ücretsiz seçimi geri alınamaz** (ücretliden ücretsize geçilir, tersi
geçilmez). Gelir modeli ücretsiz indirme + tek seferlik ürün olduğu için doğru
seçim budur.

⚠️ **Paket adı kalıcıdır.** Değiştirilemez ve silinen bir ad bir daha
kullanılamaz. Değer `capacitor.config.ts`, `android/app/build.gradle` ve
paketin manifestinde aynıdır; Console'a farklı yazılırsa yükleme "paket adı
eşleşmiyor" diye reddedilir. Elle yazmayın, kopyalayın.

## 2. Dahili teste yükleyin

**Test → Dahili test.** İki sekme vardır: *Test kullanıcıları* ve
*Sürümü incele*.

İlk AAB yüklendiğinde **Play App Signing** kendiliğinden devreye girer: Google
kendi imzalama anahtarını üretir, sizinki **yükleme anahtarı** olur. Bu iyidir
— yükleme anahtarı kaybolursa Google sıfırlayabilir, uygulama ölmez.

Sürüm notlarına [listing-tr.md](listing-tr.md) içindeki sürüm notu bloğunu
yapıştırın.

**Test kullanıcıları sekmesini atlamayın.** Adresleri ekledikten sonra oradaki
paylaşılabilir bağlantıyı tarayıcıda açıp katılımı kabul etmek gerekir; bu
yapılmazsa uygulama Play Store'da görünmez ve "yayınladım ama kuramıyorum"
denir.

⚠️ Yayınlanan `versionCode` **tükenir**; aynı numarayla ikinci paket
yüklenemez.

⚠️ Karıştırmayın: **"Dahili uygulama paylaşımı"** bir kanal değildir, ayrı bir
özelliktir. Satın alma testi için kanal olan **Dahili test** kullanılır.

## 3. Mağaza sayfasını doldurun

**Kullanıcı sayısını artırın → Google Play Store'daki varlığı → Ana mağaza
girişi**

Metinler [listing-tr.md](listing-tr.md), görseller `assets/` altındadır.
Görseller elle düzenlenmez, `npm run icons:build` ve
`npm run store:screenshots` üretir.

## 4. Beyanları tamamlayın

**Politika ve programlar → Uygulama içeriği.** Her bölümün yanında "Başlat"
veya "Yönet" düğmesi vardır.

| Bölüm | Cevap / kaynak |
|---|---|
| Gizlilik politikası | `https://acansahin.github.io/kamu-sinav-app/gizlilik/` |
| Reklamlar | Hayır |
| Uygulama erişimi | aşağıdaki nota bakın |
| İçerik derecelendirmeleri | [content-rating.md](content-rating.md) — kategori **Referans/eğitim**, oyun değil |
| Hedef kitle ve içerik | [content-rating.md](content-rating.md) — **18+** |
| Veri güvenliği | [data-safety.md](data-safety.md) — veri toplamıyor: **Hayır** |
| Haber uygulamaları | Hayır |
| Devlet uygulaması | Hayır |

**Gizlilik politikası URL'i yayına bağlıdır.** Sayfa GitHub Pages'ten
servis edilir ve `pages.yml` **yalnızca elle tetiklenir**; adresi Console'a
vermeden önce sitenin güncel olduğundan emin olun. `data-controller.ts`
içindeki e-posta boşsa sayfa "bu metin henüz yayına hazır değil" uyarısı
gösterir ve inceleme ekibi tam olarak onu görür.

**Uygulama erişimi: "Hayır — kısıtlanmış bölüm yok" seçilir.** İçeriğin çoğu
ödeme duvarının arkasında olduğu için "Var" demek ve inceleyiciye ücretsiz
kapsamı anlatan bir not bırakmak mantıklı görünür — **denendi, olmuyor**:
"Var" seçildiğinde açılan talimat formu kullanıcı adı ve şifreyi **zorunlu**
tutuyor, boş geçilemiyor. Uygulamada hesap olmadığı için girilecek bir şey
yok ve uydurulan kimlik bilgisi inceleyici denediğinde başarısız olur; bu
kesin ret sebebidir.

Bölümün kapsamı zaten **kimlik doğrulamayla** kısıtlamadır (giriş, üyelik,
konum); satın almayla kilit buraya girmez. Ücretsiz kapsamın inceleyiciye
anlatılması `listing-tr.md`'deki "ÜCRETSİZ KULLANIM VE TAM ERİŞİM"
bölümüyle olur — o paragraf bu yüzden metinden çıkarılmamalıdır.

## 5. Ödeme profili ve ürün

1. **Ayarlar → Ödeme profili** — satıcı hesabı kurulur.
2. **Play ile para kazanın → Ürünler → Uygulama içi ürünler → Ürün oluştur**

| Alan | Değer |
|---|---|
| Ürün kimliği | `tam_erisim` |
| Tür | Tek seferlik (managed product), abonelik değil |
| Fiyat | TRY |
| Durum | **Aktif** |

Ayrıntı ve gerekçeler [README.md](README.md#consoleda-elle-yapılacaklar)
7. maddesindedir.

## 6. Lisans testi

**Ayarlar → Lisans testi.** Ayar **hesap düzeyindedir**, uygulama düzeyinde
değil: bir kez eklenen adres bütün uygulamalarda geçerlidir.

⚠️ Atlanırsa test satın almalarından **gerçek para** çekilir.

## 7. Cihazda doğrulayın

AAB'yi Dahili testten Play üzerinden kurun. Satın alma akışının debug APK ile
test **edilemeyeceği** ve kabul kriteri olan dört senaryo
[README.md](README.md#satın-alma-nasıl-test-edilir) içindedir; en çok atlanan
iade senaryosu da oradadır.

## Beklenen iki sürtünme

**"Kamu" adı.** Uygulama adı ve içeriği kamu kurumlarıyla ilişkili görünür;
Play'in kimliğe bürünme politikası bu tür başvuruları eleyebiliyor. Koruma,
tam açıklamadaki **"ÖNEMLİ — Bu uygulama resmî değildir"** paragrafı ve
uygulama içindeki `/hakkinda` sayfasının aynı uyarısıdır. Reddedilirse itiraz
gerekçesi budur; o bölümü metinden çıkarmayın.

**Kapalı test şartı.** 2023 sonrasında açılan **kişisel** geliştirici
hesapları üretime çıkmadan önce 12 test kullanıcısıyla 14 gün kapalı test
yapmak zorundadır; kurumsal hesaplarda bu şart yoktur. Hangisi olduğunuz
Console'da görünür ve takvimi bu belirler — kişiselse Dahili testten sonra
Kapalı teste geçmek gerekir.

## Kaynaklar

Menü adlarının doğrulandığı sayfalar:

- [Uygulamanızı oluşturup ayarlama](https://support.google.com/googleplay/android-developer/answer/9859152?hl=tr)
- [Uygulamanızı incelemeye hazırlama](https://support.google.com/googleplay/android-developer/answer/9859455?hl=tr)
- [Uygulama içi ürünler](https://support.google.com/googleplay/android-developer/answer/1153481?hl=tr)
- [Lisans testi](https://support.google.com/googleplay/android-developer/answer/6062777?hl=tr)
- [Ödeme profili oluşturma](https://support.google.com/googleplay/android-developer/answer/7161426?hl=tr)
