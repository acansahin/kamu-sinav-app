import { REDEEM_CODE_HASHES } from "@/lib/billing/redeem-codes";
import { sha256Hex } from "@/lib/billing/sha256";

/**
 * Erişim kodu — saf mantık.
 *
 * Amaç: tam erişimi ödeme olmadan açabilen, elle yazılabilecek kadar kısa bir
 * kod. Sınıf/kurum dağıtımı, tanıtım ve destek için Play'in çeyrekte 500 kodla
 * sınırlı promosyon sisteminden bağımsız bir kanal.
 *
 * ⚠️ **Kodun KENDİSİ pakete girmez, SHA-256 ÖZETİ girer**
 * (`redeem-codes.ts`). Depo herkese açık; düz metin kod listesi commit edilseydi
 * kodların tamamı ilk günden bilinirdi. Özetten kod geri üretilemez, tek yol
 * kaba kuvvettir: 12 karakterlik Crockford base32 ≈ 60 bit.
 *
 * ⚠️ Bu bir GÜVENLİK SINIRI DEĞİLDİR — `entitlement.ts`teki not burada da
 * geçerli: statik export'ta içerik zaten pakettedir ve `localStorage`taki
 * kayıt kurcalanabilir. Kodun işi ödeme yapmamış bir kullanıcıya erişimi
 * KASITLI olarak vermektir; kararlı bir saldırganı durdurmak değil.
 *
 * Kod ÜRETİLMEZ, yalnızca DOĞRULANIR: burada gizli anahtar yoktur. Bir HMAC
 * anahtarı gömülseydi paketi açan herkes sınırsız kod basabilirdi; özet
 * listesinde ise sızıntının yarıçapı sızan kodla sınırlıdır ve o kod bir
 * sonraki sürümde listeden çıkarılarak iptal edilir.
 */

/**
 * Crockford base32: I, L, O ve U yoktur.
 *
 * Kod telefonda elle yazılır; `0/O` ve `1/I/l` karışıklığı en sık yapılan
 * hatadır. Alfabede olmayan bu harfler `ES_DEGERLER` ile rakama çevrilir, yani
 * yanlış yazım da doğru çözülür — kullanıcıya "geçersiz kod" demek yerine.
 */
const ALFABE = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Karıştırılan karakterlerin alfabedeki karşılığı. */
const ES_DEGERLER: Readonly<Record<string, string>> = {
	O: "0",
	o: "0",
	I: "1",
	i: "1",
	L: "1",
	l: "1",
	// Türkçe klavyede shift+i "İ", i-tersi "ı" üretir; ikisi de "1" kastedilmiştir.
	"İ": "1",
	"ı": "1",
};

/** Ayraç sayılan ve sessizce atılan karakterler. */
const AYRAC = /[\s\-_.]/;

export const REDEEM_CODE_LENGTH = 12;

/** Görüntüleme biçimi: dörderli üç grup. */
export const REDEEM_CODE_GROUP = 4;

/**
 * Özetin önüne konan alan ayracı.
 *
 * Aynı kod dizesinin başka bir yerde alınmış özetiyle karışmasını engeller ve
 * hazır gökkuşağı tablolarını işe yaramaz kılar. Değiştirilirse ÜRETİLMİŞ TÜM
 * KODLAR geçersiz olur — sürüm numarası bu yüzden dizenin içindedir.
 */
const OZET_ONEKI = "kamu-sinav-akademi/kod/v1:";

/**
 * Kullanıcının yazdığını kanonik biçime indirger.
 *
 * ⚠️ `toUpperCase()` KULLANILMAZ. Türkçe yerel ayarda "i" → "İ" olur ve
 * varsayılan yerel ayar da makineye göre değişir; aynı kod bir cihazda
 * çalışıp diğerinde çalışmazdı (AGENTS.md'deki `toLowerCase()` kuralının aynısı,
 * ters yönde). Büyütme burada ASCII üzerinde elle yapılır ve yerel ayardan
 * tamamen bağımsızdır.
 *
 * Alfabede olmayan bir karakter kalırsa `null` döner — sessizce atmak, farklı
 * iki kodun aynı kanonik biçime düşmesine yol açardı.
 */
export function normalizeRedeemCode(raw: string): string | null {
	let out = "";

	for (const ch of raw) {
		if (AYRAC.test(ch)) continue;

		const mapped = ES_DEGERLER[ch] ?? ch;
		// ASCII büyütme; `toUpperCase()` değil.
		const upper =
			mapped >= "a" && mapped <= "z"
				? String.fromCharCode(mapped.charCodeAt(0) - 32)
				: mapped;

		if (!ALFABE.includes(upper)) return null;
		out += upper;
		if (out.length > REDEEM_CODE_LENGTH) return null;
	}

	return out.length === REDEEM_CODE_LENGTH ? out : null;
}

/** Kanonik kodu okunur biçime böler: `XXXX-XXXX-XXXX`. */
export function formatRedeemCode(normalized: string): string {
	const groups: string[] = [];
	for (let i = 0; i < normalized.length; i += REDEEM_CODE_GROUP) {
		groups.push(normalized.slice(i, i + REDEEM_CODE_GROUP));
	}
	return groups.join("-");
}

/** Kanonik kodun pakete gömülen özeti. Üretim betiği de bunu kullanır. */
export function redeemCodeHash(normalized: string): string {
	return sha256Hex(OZET_ONEKI + normalized);
}

export type RedeemResult =
	| { ok: true; hash: string }
	| { ok: false; reason: "bicim" | "gecersiz" };

/**
 * Kodu doğrular.
 *
 * `bicim`    → kod hiç kod biçiminde değil (eksik/fazla karakter, yabancı harf)
 * `gecersiz` → biçim doğru ama listede yok (yanlış yazılmış veya iptal edilmiş)
 *
 * İki hâl ayrı tutulur çünkü kullanıcıya söylenecek şey farklıdır: ilkinde
 * "kodu kontrol edin", ikincisinde "bu kod geçerli değil".
 */
export function verifyRedeemCode(
	raw: string,
	hashes: readonly string[] = REDEEM_CODE_HASHES,
): RedeemResult {
	const normalized = normalizeRedeemCode(raw);
	if (!normalized) return { ok: false, reason: "bicim" };

	const hash = redeemCodeHash(normalized);
	// Sabit zamanlı karşılaştırmaya gerek yok: doğrulama tamamen yereldir,
	// saldırganın ölçebileceği bir zamanlama kanalı yoktur.
	if (!hashes.includes(hash)) return { ok: false, reason: "gecersiz" };

	return { ok: true, hash };
}

/** Cihazda saklanan kullanım kaydı. Kodun kendisi DEĞİL, özeti tutulur. */
export interface RedeemRecord {
	hash: string;
	/** ISO tarih — teşhis için; karar bu alana bakmaz. */
	redeemedAt: string;
}

/**
 * Kayıtlı kod hâlâ geçerli mi?
 *
 * Her açılışta yeniden bakılır, bir kez yazılıp unutulmaz: listeden çıkarılan
 * (iptal edilen) bir kod böylece bir sonraki sürümde kendiliğinden hükümsüz
 * kalır. Kaydın kendisi silinmez — kullanıcı güncelleme sonrası kilitlenirse
 * hangi kodu kullandığı destek için okunabilir kalsın.
 */
export function isRedemptionValid(
	record: RedeemRecord | null,
	hashes: readonly string[] = REDEEM_CODE_HASHES,
): boolean {
	return record !== null && hashes.includes(record.hash);
}
