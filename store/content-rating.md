# İçerik derecelendirme anketi — cevaplar

Play Console → Politika → Uygulama içeriği → İçerik derecelendirmesi.

Anketi IARC yürütür ve sonuç bölgesel derecelendirmelere (PEGI, ESRB, USK…)
çevrilir. Cevaplar beyandır; yanlış beyan derecelendirmenin iptaline yol açar.

## Kategori

**Referans, haber veya eğitim** — uygulama bir sınav hazırlık/eğitim aracıdır.
Oyun kategorisi seçilmemelidir; oyun anketi tamamen farklı sorular sorar.

## Cevaplar

| Konu | Cevap |
|---|---|
| Şiddet (gerçekçi veya karikatürize) | Hayır |
| Cinsellik veya müstehcenlik | Hayır |
| Küfür veya kaba dil | Hayır |
| Uyuşturucu, alkol, tütün atıfları | Hayır |
| Kumar, şans oyunu veya simülasyonu | Hayır |
| Korku öğeleri | Hayır |
| Kullanıcılar arası etkileşim veya iletişim | Hayır |
| Kullanıcı tarafından üretilen içerik paylaşımı | Hayır |
| Kullanıcı konumunun paylaşılması | Hayır |
| Kişisel bilgi paylaşımı | Hayır |
| Dijital satın alma | **Evet** — tek seferlik "Tam erişim" ürünü (`tam_erisim`) |
| Reklam gösterimi | Hayır |

Beklenen sonuç: **herkes / 3+**. Dijital satın alma varlığı derecelendirmeyi
yükseltmez; yalnızca listelemede "Uygulama içi satın alma" rozeti çıkar.

> ⚠️ **Anket yeniden doldurulmalıdır.** Uygulama içi satın alma 1.0.0 planında
> yoktu ve bu satır "Hayır" idi. Cevap değiştiği için Console'daki anket
> güncellenmeden yayına çıkılmamalıdır — yanlış beyan derecelendirmenin
> iptaline yol açar.

## Uygulama içeriği → Uygulama içi satın alma

Play Console'da ayrı bir beyan alanıdır (İçerik derecelendirmesinden
bağımsızdır):

| Soru | Cevap |
|---|---|
| Uygulamanız uygulama içi satın alma içeriyor mu? | **Evet** |
| Ürün türü | Tek seferlik ürün (managed product), abonelik yok |
| Fiyat aralığı | Console'da tanımlanan tek ürünün fiyatı (TRY) |

Ücretsiz kapsamın mağaza açıklamasında **açıkça** yazılması gerekir
(`listing-tr.md` → "ÜCRETSİZ KULLANIM VE TAM ERİŞİM" bölümü): ekran
görüntüleri paywall'sız web derlemesinden alındığı için tam içeriği gösterir
ve neyin ücretli olduğu metinden anlaşılmalıdır.

## Dikkat edilecek nokta

Uygulamada "Bu soruda sorun var" bildirimi vardır; bu bir **kullanıcı
etkileşimi değildir**. Bildirim yalnızca cihazın yerel veritabanına yazılır,
başka kullanıcılara gösterilmez ve hiçbir yere gönderilmez. Bu yüzden
"kullanıcılar arası etkileşim" ve "kullanıcı içeriği paylaşımı" soruları
**Hayır** olarak cevaplanır.

İleride bildirimler sunucuya gönderilmeye başlarsa ya da liderlik tablosu gibi
sosyal bir özellik eklenirse (PROJECT_PLAN.md Faz 6) anket **yeniden**
doldurulmalıdır.

## Hedef kitle ve içerik

Play ayrıca "Hedef kitle ve içerik" bölümünü doldurmayı ister:

| Soru | Cevap |
|---|---|
| Hedef yaş aralığı | 18 ve üzeri |
| Uygulama çocukları çekecek şekilde mi tasarlandı? | Hayır — içerik kamu personel mevzuatıdır, görsel dil kurumsaldır |
| Çocuklara yönelik tasarım öğeleri (renkli karakterler, oyunlaştırma vb.) | Yok |

Hedef kitle 18+ seçildiğinde uygulama **Families** politikalarının kapsamı
dışında kalır; bu doğru olandır, kullanıcılar çalışan kamu görevlileridir.
