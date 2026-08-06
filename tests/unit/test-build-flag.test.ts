// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Test derlemesi bayrağı.
 *
 * Bu dosyanın koruduğu şey bir davranış değil, bir KAZA: bayrak açık kalırsa
 * imzalı pakette tüm içerik ücretsiz açılır ve hata ancak Play'e yüklendikten
 * sonra fark edilir. İki kapı da burada sabitleniyor — varsayılanın kapalı
 * olması ve açıkken Play'e hiç sorulmaması.
 */

describe("varsayılan", () => {
	/**
	 * Ortam değişkeni verilmediğinde bayrak KAPALI olmalı. Normal `npm run
	 * build`, `main`e push ile üretilen debug APK ve imzalı release yolu bu
	 * daldan geçer.
	 */
	it("ortam değişkeni yokken kapalıdır", async () => {
		vi.stubEnv("NEXT_PUBLIC_TEST_FULL_ACCESS", "");
		vi.resetModules();

		const { TEST_FULL_ACCESS } = await import("@/lib/billing/test-build");
		expect(TEST_FULL_ACCESS).toBe(false);

		vi.unstubAllEnvs();
	});

	it("yalnızca '1' değerini açık sayar", async () => {
		for (const deger of ["0", "true", "evet", "yes"]) {
			vi.stubEnv("NEXT_PUBLIC_TEST_FULL_ACCESS", deger);
			vi.resetModules();
			const { TEST_FULL_ACCESS } = await import("@/lib/billing/test-build");
			expect(TEST_FULL_ACCESS).toBe(false);
		}

		vi.stubEnv("NEXT_PUBLIC_TEST_FULL_ACCESS", "1");
		vi.resetModules();
		const { TEST_FULL_ACCESS } = await import("@/lib/billing/test-build");
		expect(TEST_FULL_ACCESS).toBe(true);

		vi.unstubAllEnvs();
	});
});

describe("bayrak açıkken hak çözümlemesi", () => {
	/**
	 * Play'e sorulmaması iki şeyi birden güvenceye alır: test cihazında Play
	 * hesabı gerekmez, ve önbelleğe kalıcı bir "satın alınmış" izi yazılmaz —
	 * yazılsaydı aynı cihaza sonradan kurulan NORMAL APK da açık görünürdü.
	 */
	it("Play'e sormadan tam erişim verir ve önbelleğe yazmaz", async () => {
		vi.stubEnv("NEXT_PUBLIC_TEST_FULL_ACCESS", "1");
		vi.resetModules();

		const queryEntitlement = vi.fn();
		const writeEntitlementCache = vi.fn();

		vi.doMock("@/lib/billing/billing.provider", () => ({
			getBillingProvider: async () => ({
				queryEntitlement,
				sweepAcknowledgements: async () => {},
			}),
			isNativeRuntime: async () => true,
		}));
		vi.doMock("@/lib/billing/entitlement-cache", () => ({
			entitlementFromCache: () => null,
			readEntitlementCache: () => null,
			writeEntitlementCache,
		}));

		const { refreshEntitlement, useEntitlement } = await import(
			"@/lib/stores/entitlement"
		);
		await refreshEntitlement();

		const { result } = renderHook(() => useEntitlement());
		expect(result.current).toEqual({ paywallActive: true, fullAccess: true });
		expect(queryEntitlement).not.toHaveBeenCalled();
		expect(writeEntitlementCache).not.toHaveBeenCalled();

		vi.doUnmock("@/lib/billing/billing.provider");
		vi.doUnmock("@/lib/billing/entitlement-cache");
		vi.unstubAllEnvs();
	});
});
