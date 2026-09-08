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
 * Kart ölçüsü. Kare seçildi çünkü Instagram'ın kabul ettiği en/boy aralığı
 * (4:5 – 1.91:1) ile X ve Facebook'un akış kırpması KARE'de çakışır; tek
 * görsel üç platforma da kırpılmadan gider.
 */
export const KART_BOYUT = 1080;

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
 * Etiketler platform başına ayrılır: X'te her karakter 280'den düşer, bu
 * yüzden orada iki etiketle yetinilir. Instagram'da etiket keşfin ana yolu
 * olduğu için liste geniştir.
 */
export const ETIKETLER = {
	x: ["#GörevdeYükselme", "#UnvanDeğişikliği"],
	facebook: [
		"#GörevdeYükselme",
		"#UnvanDeğişikliği",
		"#657",
		"#KamuPersoneli",
	],
	instagram: [
		"#GörevdeYükselme",
		"#UnvanDeğişikliği",
		"#GYS",
		"#657",
		"#DevletMemurlarıKanunu",
		"#KamuPersoneli",
		"#MemurSınavı",
		"#SınavHazırlık",
		"#Etik",
		"#Anayasa",
	],
} as const;

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
