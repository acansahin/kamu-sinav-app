import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CachedEntitlement } from "@/lib/billing/entitlement-cache";

/**
 * Hak tazelemesinin Play'e kaç kez sorduğu.
 *
 * Görülen hata: satın almış kullanıcı uygulamayı yeniden açtığında erişimini
 * kaybediyordu. Zincirin son halkası buradaydı — tek bir olumsuz cevap otorite
 * sayılıp önbelleğe yazılıyordu, oysa eklenti düşen bir sorguyu da boş listeyle
 * (yani olumsuz gibi) çözebiliyor.
 */

interface Kurulum {
	cached: CachedEntitlement | null;
	cevaplar: (boolean | null)[];
}

function cache(fullAccess: boolean): CachedEntitlement {
	return { fullAccess, native: true, checkedAt: "2026-08-01T00:00:00.000Z" };
}

async function tazele({ cached, cevaplar }: Kurulum) {
	// `null` da geçerli bir cevaptır (sorgu yapılamadı); `??` ile boşluk
	// doldurmak onu sessizce `false`a çevirirdi.
	let sira = 0;
	const queryEntitlement = vi.fn(async () =>
		sira < cevaplar.length ? cevaplar[sira++] : false,
	);
	const writeEntitlementCache = vi.fn();

	vi.doMock("@/lib/billing/billing.provider", () => ({
		getBillingProvider: async () => ({ queryEntitlement }),
		isNativeRuntime: async () => true,
	}));
	vi.doMock("@/lib/billing/entitlement-cache", () => ({
		entitlementFromCache: () => null,
		readEntitlementCache: () => cached,
		writeEntitlementCache,
	}));

	const { refreshEntitlement } = await import("@/lib/stores/entitlement");
	await refreshEntitlement();

	return { queryEntitlement, writeEntitlementCache };
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_TEST_FULL_ACCESS", "");
	vi.resetModules();
});

afterEach(() => {
	vi.doUnmock("@/lib/billing/billing.provider");
	vi.doUnmock("@/lib/billing/entitlement-cache");
	vi.unstubAllEnvs();
});

describe("refreshEntitlement", () => {
	/** ASIL HATA: tek bir olumsuz cevap ödemiş kullanıcıyı kilitliyordu. */
	it("hak sahibinden hakkı tek bir olumsuz cevapla almaz", async () => {
		const { queryEntitlement, writeEntitlementCache } = await tazele({
			cached: cache(true),
			cevaplar: [false, true],
		});

		expect(queryEntitlement).toHaveBeenCalledTimes(2);
		expect(writeEntitlementCache).toHaveBeenCalledWith(
			expect.objectContaining({ fullAccess: true }),
		);
	});

	/** İADE gerçekten yapılmışsa ikinci sorgu da olumsuzdur ve hak kalkar. */
	it("olumsuz cevap doğrulanırsa hakkı kaldırır", async () => {
		const { queryEntitlement, writeEntitlementCache } = await tazele({
			cached: cache(true),
			cevaplar: [false, false],
		});

		expect(queryEntitlement).toHaveBeenCalledTimes(2);
		expect(writeEntitlementCache).toHaveBeenCalledWith(
			expect.objectContaining({ fullAccess: false }),
		);
	});

	/** Yaygın hâl: hakkı olmayan kullanıcı fazladan Play trafiği üretmez. */
	it("önbellekte hak yokken ikinci kez sormaz", async () => {
		const { queryEntitlement } = await tazele({
			cached: cache(false),
			cevaplar: [false],
		});

		expect(queryEntitlement).toHaveBeenCalledTimes(1);
	});

	it("olumlu cevap için ikinci kez sormaz", async () => {
		const { queryEntitlement, writeEntitlementCache } = await tazele({
			cached: cache(true),
			cevaplar: [true],
		});

		expect(queryEntitlement).toHaveBeenCalledTimes(1);
		expect(writeEntitlementCache).toHaveBeenCalledWith(
			expect.objectContaining({ fullAccess: true }),
		);
	});

	/** Çevrimdışı: sorgu yapılamadı, önbellek korunur ve üzerine yazılmaz. */
	it("sorgu yapılamazsa önbelleğe dokunmaz", async () => {
		const { queryEntitlement, writeEntitlementCache } = await tazele({
			cached: cache(true),
			cevaplar: [null],
		});

		expect(queryEntitlement).toHaveBeenCalledTimes(1);
		expect(writeEntitlementCache).not.toHaveBeenCalled();
	});
});
