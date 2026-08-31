import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CachedEntitlement } from "@/lib/billing/entitlement-cache";
import { type RedeemRecord, redeemCodeHash } from "@/lib/billing/redeem";

/** Kod listesi testte sabitlenir; üretilmiş gerçek kodlara bağımlılık olmaz. */
const GECERLI_KOD = "ABCD-1234-EFGH";

/**
 * Erişim kodunun hak çözümlemesine bağlanması.
 *
 * ASIL RİSK ve bu dosyanın varlık sebebi: kod hakkı ile Play hakkı aynı kayıtta
 * tutulsaydı, kodu kullanmış kullanıcının İLK `getPurchases()` cevabı (`false`,
 * çünkü gerçekten satın alma yok) kodu silerdi. Hata yalnızca cihazda, üstelik
 * uygulama bir kez kapatılıp açıldıktan sonra görünürdü.
 */

interface Kurulum {
	/** Depoda kayıtlı kod özeti; `null` ise kod kullanılmamış. */
	kayit: RedeemRecord | null;
	/** Kaydın listede olup olmadığı — iptal senaryosu için. */
	gecerli?: boolean;
	/** Play sorgusunun cevabı. */
	playCevabi: boolean | null;
	yazmaBasarili?: boolean;
}

function cache(fullAccess: boolean): CachedEntitlement {
	return { fullAccess, native: true, checkedAt: "2026-08-01T00:00:00.000Z" };
}

async function kur({
	kayit,
	gecerli = true,
	playCevabi,
	yazmaBasarili = true,
}: Kurulum) {
	const queryEntitlement = vi.fn(async () => playCevabi);
	const writeEntitlementCache = vi.fn();
	const writeRedeemRecord = vi.fn<(record: RedeemRecord) => boolean>(
		() => yazmaBasarili,
	);

	let kayitli = kayit;

	vi.doMock("@/lib/billing/billing.provider", () => ({
		getBillingProvider: async () => ({ queryEntitlement }),
		isNativeRuntime: async () => true,
	}));
	vi.doMock("@/lib/billing/entitlement-cache", () => ({
		entitlementFromCache: () => null,
		readEntitlementCache: () => cache(false),
		writeEntitlementCache,
	}));
	vi.doMock("@/lib/billing/redeem-codes", () => ({
		REDEEM_CODE_HASHES: [redeemCodeHash("ABCD1234EFGH")],
	}));
	vi.doMock("@/lib/billing/redeem-store", () => ({
		hasValidRedemption: () => kayitli !== null && gecerli,
		writeRedeemRecord: (record: RedeemRecord) => {
			const ok = writeRedeemRecord(record);
			if (ok) kayitli = record;
			return ok;
		},
	}));

	const store = await import("@/lib/stores/entitlement");
	return { store, queryEntitlement, writeEntitlementCache, writeRedeemRecord };
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_TEST_FULL_ACCESS", "");
	vi.resetModules();
});

afterEach(() => {
	vi.doUnmock("@/lib/billing/billing.provider");
	vi.doUnmock("@/lib/billing/entitlement-cache");
	vi.doUnmock("@/lib/billing/redeem-codes");
	vi.doUnmock("@/lib/billing/redeem-store");
	vi.unstubAllEnvs();
});

describe("erişim kodu ve hak", () => {
	/** ASIL HATA: Play'in olumsuz cevabı kod hakkını silmemeli. */
	it("olumsuz Play cevabı kod hakkını silmez", async () => {
		const { store } = await kur({
			kayit: { hash: "x", redeemedAt: "" },
			playCevabi: false,
		});

		await store.refreshEntitlement();

		expect(store.getEntitlement()).toEqual({
			paywallActive: true,
			fullAccess: true,
		});
	});

	/** Kod hakkı Play önbelleğine SIZMAZ — iade tespiti buna bağlı. */
	it("kod hakkı Play önbelleğine yazılmaz", async () => {
		const { store, writeEntitlementCache } = await kur({
			kayit: { hash: "x", redeemedAt: "" },
			playCevabi: false,
		});

		await store.refreshEntitlement();

		expect(writeEntitlementCache).toHaveBeenCalledWith(
			expect.objectContaining({ fullAccess: false }),
		);
	});

	/** İPTAL: özet listeden çıkarılınca kullanılmış cihazda da hak kalkar. */
	it("iptal edilen kod hakkı kaldırır", async () => {
		const { store } = await kur({
			kayit: { hash: "x", redeemedAt: "" },
			gecerli: false,
			playCevabi: false,
		});

		await store.refreshEntitlement();

		expect(store.getEntitlement()?.fullAccess).toBe(false);
	});

	it("geçersiz kod hak vermez", async () => {
		const { store, writeRedeemRecord } = await kur({
			kayit: null,
			playCevabi: false,
		});

		await store.refreshEntitlement();
		const sonuc = await store.redeemAccessCode("ZZZZ-9999-ZZZZ");

		expect(sonuc).toEqual({ ok: false, reason: "gecersiz" });
		expect(writeRedeemRecord).not.toHaveBeenCalled();
		expect(store.getEntitlement()?.fullAccess).toBe(false);
	});

	/**
	 * Depoya yazılamayan kod yine de BU OTURUMDA açılır: kullanıcı geçerli bir
	 * kod girdi ve kilitli kalması en kötü sonuçtur. Kalıcı olmadığı `depo`
	 * hâliyle ayrıca bildirilir.
	 */
	it("kaydedilemeyen kod oturum boyunca açık kalır", async () => {
		const { store } = await kur({
			kayit: null,
			playCevabi: false,
			yazmaBasarili: false,
		});

		const sonuc = await store.redeemAccessCode(GECERLI_KOD);

		expect(sonuc).toEqual({ ok: false, reason: "depo" });
		expect(store.getEntitlement()?.fullAccess).toBe(true);
	});
});
