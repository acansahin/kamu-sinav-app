import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	REDEEM_CODE_LENGTH,
	formatRedeemCode,
	isRedemptionValid,
	normalizeRedeemCode,
	redeemCodeHash,
	verifyRedeemCode,
} from "@/lib/billing/redeem";
import { REDEEM_CODE_HASHES } from "@/lib/billing/redeem-codes";
import { parseRedeemRecord } from "@/lib/billing/redeem-store";
import { sha256Hex } from "@/lib/billing/sha256";

/**
 * Erişim kodu doğrulaması.
 *
 * Kodlar telefonda elle yazılır ve doğrulama tamamen yereldir — yani hata
 * yapan kullanıcının başvurabileceği bir sunucu yoktur. Bu yüzden asıl risk
 * "yanlış kodu kabul etmek" değil, DOĞRU KODU REDDETMEKTİR.
 */

const GECERLI = "ABCD1234EFGH";
const GECERLI_OZET = redeemCodeHash(GECERLI);
const LISTE = [GECERLI_OZET];

describe("sha256Hex", () => {
	/**
	 * Elle yazılmış SHA-256'nın referansa karşı doğrulanması. Doldurma
	 * sınırları (55/56/63/64 bayt) klasik hata yeridir ve tam da bunlar
	 * denenir.
	 */
	it("Node'un referans uygulamasıyla birebir aynı", () => {
		const cases = [
			"",
			"abc",
			"a".repeat(55),
			"a".repeat(56),
			"a".repeat(63),
			"a".repeat(64),
			"a".repeat(200),
			"Türkçe İıŞşĞğ",
		];
		for (const input of cases) {
			expect(sha256Hex(input)).toBe(
				createHash("sha256").update(input, "utf8").digest("hex"),
			);
		}
	});
});

describe("normalizeRedeemCode", () => {
	it("ayraçları atar ve küçük harfi büyütür", () => {
		expect(normalizeRedeemCode("abcd-1234-efgh")).toBe(GECERLI);
		expect(normalizeRedeemCode(" ABCD 1234 EFGH ")).toBe(GECERLI);
		expect(normalizeRedeemCode("ABCD_1234.EFGH")).toBe(GECERLI);
	});

	/**
	 * ⚠️ ASIL KURAL: `toUpperCase()` Türkçe yerel ayarda "i" → "İ" yapar ve
	 * varsayılan yerel ayar makineye göre değişir. Bu eşleme ASCII üzerinde
	 * elle yapıldığı için sonuç her cihazda aynıdır.
	 */
	it("i harfini yerel ayardan bağımsız çözer", () => {
		// Alfabede I yoktur; karışıklığı önlemek için 1'e düşer.
		expect(normalizeRedeemCode("iiii-1234-EFGH")).toBe("11111234EFGH");
		expect(normalizeRedeemCode("IIII-1234-EFGH")).toBe("11111234EFGH");
		// Türkçe klavyenin ürettiği biçimler de aynı yere düşer.
		expect(normalizeRedeemCode("İıİı-1234-EFGH")).toBe("11111234EFGH");
	});

	it("karışan harfleri rakama çevirir", () => {
		expect(normalizeRedeemCode("OOOO-LLLL-EFGH")).toBe("00001111EFGH");
	});

	it("uzunluk tutmuyorsa veya yabancı karakter varsa reddeder", () => {
		expect(normalizeRedeemCode("ABCD-1234-EFG")).toBeNull();
		expect(normalizeRedeemCode("ABCD-1234-EFGHI")).toBeNull();
		expect(normalizeRedeemCode("ABCD-1234-EFGÜ")).toBeNull();
		expect(normalizeRedeemCode("")).toBeNull();
	});

	it("alfabede U yoktur ve sessizce başka harfe çevrilmez", () => {
		expect(normalizeRedeemCode("ABCU-1234-EFGH")).toBeNull();
	});
});

describe("formatRedeemCode", () => {
	it("dörderli gruplar", () => {
		expect(formatRedeemCode(GECERLI)).toBe("ABCD-1234-EFGH");
		expect(GECERLI).toHaveLength(REDEEM_CODE_LENGTH);
	});
});

describe("verifyRedeemCode", () => {
	it("listedeki kodu kabul eder", () => {
		expect(verifyRedeemCode("abcd 1234 efgh", LISTE)).toEqual({
			ok: true,
			hash: GECERLI_OZET,
		});
	});

	/** İki hata AYRI: biri "yazımı kontrol edin", diğeri "bu kod geçerli değil". */
	it("biçim hatası ile geçersiz kodu ayırır", () => {
		expect(verifyRedeemCode("kısa", LISTE)).toEqual({
			ok: false,
			reason: "bicim",
		});
		expect(verifyRedeemCode("ZZZZ-9999-ZZZZ", LISTE)).toEqual({
			ok: false,
			reason: "gecersiz",
		});
	});

	it("boş listede hiçbir kod geçerli değil", () => {
		expect(verifyRedeemCode(GECERLI, []).ok).toBe(false);
	});

	/**
	 * Özet ALAN AYRAÇLIDIR: kodun çıplak SHA-256'sı listeye yazılırsa
	 * doğrulama tutmaz. Bu, önekin sessizce değiştirilmesine karşı kapıdır —
	 * değişirse üretilmiş tüm kodlar geçersiz olur.
	 */
	it("özet, kodun çıplak SHA-256'sı DEĞİLDİR", () => {
		expect(GECERLI_OZET).not.toBe(sha256Hex(GECERLI));
	});
});

describe("isRedemptionValid", () => {
	it("kayıtlı kod listedeyse geçerli", () => {
		expect(
			isRedemptionValid({ hash: GECERLI_OZET, redeemedAt: "" }, LISTE),
		).toBe(true);
	});

	/** İPTAL: özet listeden çıkarılınca kullanılmış cihazda da hükümsüz kalır. */
	it("listeden çıkarılan kod hükümsüzdür", () => {
		expect(isRedemptionValid({ hash: GECERLI_OZET, redeemedAt: "" }, [])).toBe(
			false,
		);
	});

	it("kayıt yoksa geçersiz", () => {
		expect(isRedemptionValid(null, LISTE)).toBe(false);
	});
});

describe("parseRedeemRecord", () => {
	it("bozuk kaydı reddeder", () => {
		expect(parseRedeemRecord(null)).toBeNull();
		expect(parseRedeemRecord("{")).toBeNull();
		expect(parseRedeemRecord("null")).toBeNull();
		expect(parseRedeemRecord('{"hash":42}')).toBeNull();
	});

	it("eksik tarihi boş dizeye düşürür", () => {
		expect(parseRedeemRecord('{"hash":"abc"}')).toEqual({
			hash: "abc",
			redeemedAt: "",
		});
	});
});

/**
 * Yayımlanan liste.
 *
 * Dosya bir betikle üretiliyor ama elle DÜZENLENİYOR da (iptal = satır silme).
 * Elle bozulmuş bir satır sessizce "hiçbir kod çalışmıyor" hâline yol açardı;
 * hata ancak kod dağıtıldıktan sonra fark edilirdi.
 */
describe("REDEEM_CODE_HASHES", () => {
	it("her satır 64 karakterlik küçük harf onaltılıktır", () => {
		for (const hash of REDEEM_CODE_HASHES) {
			expect(hash).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	it("tekrar eden özet yok", () => {
		expect(new Set(REDEEM_CODE_HASHES).size).toBe(REDEEM_CODE_HASHES.length);
	});
});
