import { z } from "zod";

/**
 * Sosyal medya hattının veri sözleşmeleri.
 *
 * İçerik şemaları gibi (`src/types/content.ts`) tek gerçek kaynak burasıdır:
 * plan dosyası ve ledger diske JSON olarak yazılıp başka bir süreçte geri
 * okunduğu için — iş akışı "plan" ve "publish" aşamalarını AYRI adımlarda
 * çalıştırır — arada şema doğrulaması yapılır. Doğrulamasız okumak, bozuk bir
 * plan dosyasının paylaşım anında `undefined` metin göndermesi demekti.
 */

export const platformSchema = z.enum(["x", "facebook", "instagram"]);
export type Platform = z.infer<typeof platformSchema>;

/**
 * Paylaşım türleri.
 *
 * - `soru`  — havuzdan bir soru; şıklar kartta, cevap yok.
 * - `cevap` — aynı günün `soru` paylaşımının cevabı + mevzuat dayanağı.
 * - `bilgi` — konu özetinin "Bir bakışta" maddelerinden biri.
 * - `duyuru`— kilometre taşı; elle tetiklenir, metni operatör verir.
 */
export const postTuruSchema = z.enum(["soru", "cevap", "bilgi", "duyuru"]);
export type PostTuru = z.infer<typeof postTuruSchema>;

/**
 * Bir paylaşımın platform başına sonucu. Başarısızlık ledger'a YAZILIR ve
 * atlanmaz: bir platformun token'ı sessizce süresi dolduğunda tek belirti
 * budur.
 */
export const yayinSonucuSchema = z.object({
	platform: platformSchema,
	basarili: z.boolean(),
	/** Platformun döndürdüğü gönderi kimliği — denetim için saklanır. */
	postId: z.string().optional(),
	hata: z.string().optional(),
});
export type YayinSonucu = z.infer<typeof yayinSonucuSchema>;

/**
 * Ledger satırı. **Append-only**: `attempts` tablosuyla aynı gerekçe —
 * geçmiş paylaşımlar tekrar önlemenin tek kaynağıdır ve güncellenirse
 * "hangi soru daha önce paylaşıldı" sorusu cevapsız kalır.
 */
export const ledgerSatiriSchema = z.object({
	/** Tekrar önleme anahtarı: `${tur}:${refId}` */
	anahtar: z.string().min(3),
	tur: postTuruSchema,
	/** Soru id'si, ya da bilgi kartları için `${subjectId}/${slug}#${index}` */
	refId: z.string().min(1),
	/** ISO 8601, UTC — paylaşımın planlandığı an */
	tarih: z.string().min(10),
	gorsel: z.string().min(1),
	sonuclar: z.array(yayinSonucuSchema),
});
export type LedgerSatiri = z.infer<typeof ledgerSatiriSchema>;

export const ledgerSchema = z.array(ledgerSatiriSchema);

/**
 * `plan` aşamasının çıktısı, `publish` aşamasının girdisi.
 *
 * `gorselUrl` planlama anında BİLİNİR ama HENÜZ ÇALIŞMAZ: dosya adı
 * deterministiktir, adres ise iş akışı görseli `social-assets` dalına
 * ittikten sonra canlanır. Bu yüzden publish aşaması adresi kendisi
 * kurmaz — plandan okur ve yoklar.
 */
export const postPlaniSchema = z.object({
	anahtar: z.string().min(3),
	tur: postTuruSchema,
	refId: z.string().min(1),
	tarih: z.string().min(10),
	/** `social-out/` içindeki dosya adı */
	gorsel: z.string().min(1),
	/** Görselin yayımlandıktan sonraki herkese açık adresi */
	gorselUrl: z.string().url(),
	/** Görseli görmeyen okuyucu ve ekran okuyucular için */
	altMetin: z.string().min(10),
	metinler: z.object({
		x: z.string().min(1),
		facebook: z.string().min(1),
		instagram: z.string().min(1),
	}),
});
export type PostPlani = z.infer<typeof postPlaniSchema>;

/** Kart çizimi için türden bağımsız girdi. */
export type KartIcerigi = {
	tur: PostTuru;
	/** Üst şeritteki küçük etiket: "GÜNÜN SORUSU", "CEVAP", "BİLGİ" */
	rozet: string;
	/** Ders/konu adı — rozetin yanında */
	ustBilgi: string;
	baslik: string;
	/** Soru şıkları ya da bilgi maddeleri; boş olabilir */
	satirlar?: string[];
	/** `cevap` kartında doğru şık metni */
	vurgu?: string;
	/** Alt şeritteki mevzuat dayanağı */
	dayanak?: string;
};
