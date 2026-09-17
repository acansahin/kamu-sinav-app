/**
 * Sosyal medya hattının sabitleri.
 *
 * Renkler `globals.css`'teki token'ların AÇIK TEMA değerleridir ve elle
 * kopyalanmıştır: kart bir tarayıcıda değil `sharp` içinde çizilir, CSS
 * değişkeni okuyamaz. Marka rengi değişirse burası da güncellenmelidir —
 * `generate-icons.ts`'teki `BRAND` ile aynı gerekçe.
 */

/** globals.css → --brand */
export const BRAND = "#17395e";
/** globals.css → --brand-gradient'in iki ucu */
export const BRAND_LIGHT = "#1d4a7a";
export const BRAND_DARK = "#102a47";
/** globals.css → --correct */
export const CORRECT = "#17694a";
/** globals.css → --accent */
export const ACCENT = "#0e6b74";

/**
 * Yazı tipi ADI değil YIĞIN verilir. Kart, üretim makinesinde librsvg
 * tarafından çizilir ve orada hangi fontun kurulu olduğu garanti değildir;
 * librsvg ilk bulduğuna düşer. `generate-icons.ts` ile aynı yığın kullanılır
 * ki mağaza görselleriyle sosyal kartlar aynı yüzü göstersin.
 *
 * ⚠️ DejaVu Sans Türkçe glif'lerini (ğ, ş, ı, İ) taşır; GitHub Actions'ın
 * ubuntu imajında kuruludur ve iş akışı ayrıca `fonts-dejavu-core` kurar.
 * Font bulunamazsa metin ÇİZİLMEZ ama hata da alınmaz — kart sessizce boş
 * çıkar. Bu yüzden `card.ts` üretilen görseli boyut üzerinden yoklar.
 */
export const FONT_STACK =
	"DejaVu Sans, Liberation Sans, Segoe UI, Arial, Helvetica, sans-serif";

/**
 * Kart ölçüsü — **1080×1350 (4:5)**, tüm sosyal görsellerde tek biçim.
 *
 * Instagram'ın 2026 önerisi bu: akışta en çok dikey alanı kaplayan biçim ve
 * profil ızgarasının kırpmasına en az kurban veren biçim. Izgara gözü 3:4'e
 * kırpıyor; 4:5 bir görselden yanlardan yalnızca ~34 piksel gidiyor.
 *
 * ⚠️ **KARE KULLANILMAZ.** 1:1 bir görsel aynı ızgarada iki yanından ~135'er
 * piksel kaybediyor ve kenara yakın metnin başı kesiliyordu — iki kez
 * bildirildi. Facebook ve X de 4:5'i kırpmadan gösteriyor, yani tek ölçü üç
 * platforma birden yetiyor.
 */
export const KART_GEN = 1080;
export const KART_YUK = 1350;

/**
 * ⚠️ Instagram Content Publishing API **JPEG** ister; PNG kabul edilmez ve
 * hata mesajı ("media upload failed") sebebi söylemez. Bu yüzden üç platform
 * için de tek biçim JPEG üretilir.
 */
export const KART_UZANTI = "jpg";

/** Instagram'ın altyapısı büyük dosyada zaman aşımına düşüyor; 8 MB sınırı var. */
export const JPEG_KALITE = 88;

/** Google Play listesi — uygulamanın tek genel dağıtım kanalı. */
export const PLAY_URL =
	"https://play.google.com/store/apps/details?id=tr.kamusinavakademi.app";

/**
 * Paylaşımın işaret ettiği adres.
 *
 * ⚠️ **Buraya GitHub Pages adresi YAZILMAZ.** Uygulama Play'de satılıyor;
 * web sürümü aynı içeriği ücretsiz veriyor ve tanıtımda o adresi vermek
 * doğrudan satışın önüne geçiyor. Bir kez oldu: ilk tanıtım postunda Pages
 * adresi verildi ve insanlar ücretsiz sürümü buldu.
 *
 * Ortam değişkeni yalnızca Play listesi taşınırsa veya bir alan adı
 * alınırsa kullanılmalıdır.
 */
export const UYGULAMA_URL = process.env.SOCIAL_APP_URL ?? PLAY_URL;

export const MARKA_ADI = "Kamu Sınav Akademi";

/**
 * Etiketler: platforma göre ortak set + paylaşımın dersine göre ek set.
 *
 * Platform ayrımı: X'te her karakter 280'den düşer, orada az etiket; Facebook'ta
 * etiket kalabalığı erişimi düşürür, orada beş etiket; Instagram'da etiket
 * keşfin ana yolu, orada geniş liste.
 *
 * Ders ayrımı: sabit tek liste, Güvenlik Soruşturması sorusuna `#etik` ve
 * `#anayasa` basıyordu. Her paylaşım kendi dersinin etiketini taşır.
 *
 * Instagram'da şapkalı ve şapkasız biçim BİRLİKTE yazılır: iki ayrı etikettir
 * ve Türkçe karakter kullanmadan arayanlar ikincisini görür.
 */
export const ETIKETLER = {
	x: ["#GörevdeYükselme", "#UnvanDeğişikliği", "#İçişleriBakanlığı"],
	facebook: [
		"#GörevdeYükselme",
		"#UnvanDeğişikliği",
		"#İçişleriBakanlığı",
		"#KamuSınavAkademi",
	],
	instagram: [
		"#görevdeyükselme",
		"#gorevdeyukselme",
		"#unvandeğişikliği",
		"#unvandegisikligi",
		"#gys",
		"#içişleribakanlığı",
		"#icisleribakanligi",
		"#kamupersoneli",
		"#kamugörevlisi",
		"#memursınavı",
		"#mevzuat",
		"#kamusınavakademi",
	],
} as const;

/**
 * Dersin ek etiketleri. İlki Facebook'a da girer (tek etiket), tamamı
 * Instagram'a. X'e girmez — karakter bütçesi yok.
 */
export const DERS_ETIKETLERI: Record<string, readonly string[]> = {
	"657-dmk": ["#657SayılıKanun", "#devletmemurlarıkanunu"],
	anayasa: ["#Anayasa", "#anayasahukuku"],
	etik: ["#EtikDavranışİlkeleri", "#kamuetiği"],
	"resmi-yazisma": ["#ResmiYazışma", "#resmiyazışmakuralları"],
	"devlet-teskilati": ["#DevletTeşkilatı", "#cumhurbaşkanlığıkararnamesi"],
	"guvenlik-sorusturmasi": ["#GüvenlikSoruşturması", "#7315sayılıkanun"],
	turkce: ["#Türkçe", "#dilbilgisi"],
	"sayisal-mantik": ["#SayısalMantık", "#genelyetenek"],
	"ataturk-ilkeleri": ["#AtatürkİlkeleriveİnkılapTarihi", "#inkılaptarihi"],
	"yakin-tarih": ["#YakınTarih", "#türkiyesiyasitarihi"],
	cografya: ["#TürkiyeCoğrafyası", "#coğrafya"],
	edebiyat: ["#Edebiyat", "#genelkültür"],
};

/**
 * X'in gönderi karakter sınırı. Bağlantı ve etiket dâhil sayılır;
 * `compose.ts` bu değere göre kısaltır.
 */
export const X_KARAKTER_SINIRI = 280;

/** Instagram başlığı 2200 karakterde kesilir (etiketler dâhil). */
export const INSTAGRAM_KARAKTER_SINIRI = 2200;

/**
 * Kart görselleri buraya yazılır ve iş akışı bu klasörü `social-assets`
 * dalına iter. Instagram görseli **herkese açık bir HTTPS adresinden**
 * çekmek zorundadır (ikili yükleme kabul etmez), Facebook'un `url`
 * parametresi de aynı adresi kullanır — bu yüzden görsel önce yayımlanır,
 * sonra paylaşılır. Sıra bağlayıcıdır.
 */
export const CIKTI_DIR = "social-out";

/**
 * Kart görsellerinin yayımlandığı adres.
 *
 * `social-assets` **ayrı bir daldır**: günde birkaç görselin `main`e
 * commit'lenmesi geçmişi şişirir ve her paylaşım `main` üzerinde CI
 * tetiklerdi. Dal yalnızca görsel taşır, kod taşımaz.
 *
 * Depo herkese açık olmak ZORUNDA — Instagram görseli kendi sunucusuna
 * çekemezse container oluşturma adımı hata verir.
 */
export const VARLIK_TABANI =
	process.env.SOCIAL_ASSET_BASE ??
	"https://raw.githubusercontent.com/acansahin/kamu-sinav-app/social-assets";

/** Ledger deponun içinde durur; append-only'dir ve iş akışı geri commit'ler. */
export const LEDGER_DOSYA = "social/ledger.json";
