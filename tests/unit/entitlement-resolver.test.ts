import { describe, expect, it } from "vitest";
import {
	type CachedEntitlement,
	entitlementFromCache,
	parseCachedEntitlement,
} from "@/lib/billing/entitlement-cache";
import { resolveEntitlement } from "@/lib/billing/entitlement-resolver";

/**
 * Play cevabı ile önbelleğin uzlaştırılması.
 *
 * Bu senaryolar eklenti mock'lamadan doğrulanabilsin diye saf bir fonksiyona
 * ayrıldı; iade ve çevrimdışı yolları gerçek bir cihazda test etmek pahalıdır
 * ve tam da bu yüzden kaçırılır.
 */

const NOW = new Date("2026-08-05T10:00:00.000Z");

function cache(fullAccess: boolean, native = true): CachedEntitlement {
	return { fullAccess, native, checkedAt: "2026-08-01T00:00:00.000Z" };
}

describe("resolveEntitlement", () => {
	it("tarayıcıda paywall'ı kapatır", () => {
		const { entitlement } = resolveEntitlement(
			{ native: false, cached: null, playResult: null },
			NOW,
		);
		expect(entitlement).toEqual({ paywallActive: false, fullAccess: false });
	});

	/**
	 * Önbellekte native bir kurulumdan kalma `true` olsa bile tarayıcıda kilit
	 * uygulanmaz — ama kayıt `native: false` olarak tazelenir ki bir sonraki
	 * açılışta senkron karar doğru çıksın.
	 */
	it("tarayıcıda eski native önbelleği kilit doğurmaz", () => {
		const { entitlement, cacheUpdate } = resolveEntitlement(
			{ native: false, cached: cache(true), playResult: null },
			NOW,
		);
		expect(entitlement.paywallActive).toBe(false);
		expect(cacheUpdate?.native).toBe(false);
	});

	it("başarılı sorgu hak verir ve önbelleğe yazar", () => {
		const { entitlement, cacheUpdate } = resolveEntitlement(
			{ native: true, cached: null, playResult: true },
			NOW,
		);
		expect(entitlement).toEqual({ paywallActive: true, fullAccess: true });
		expect(cacheUpdate).toEqual({
			fullAccess: true,
			native: true,
			checkedAt: NOW.toISOString(),
		});
	});

	/**
	 * İADE SENARYOSU — en kolay kaçırılan yol. Play artık hak vermiyorsa
	 * önbellekteki `true` silinmek zorundadır; aksi hâlde iade alan kullanıcı
	 * erişimini süresiz korurdu.
	 */
	it("sorgu hak vermiyorsa önbellekteki hakkı KALDIRIR", () => {
		const { entitlement, cacheUpdate } = resolveEntitlement(
			{ native: true, cached: cache(true), playResult: false },
			NOW,
		);
		expect(entitlement.fullAccess).toBe(false);
		expect(cacheUpdate?.fullAccess).toBe(false);
	});

	/**
	 * ÇEVRİMDIŞI — ödemiş kullanıcının erişimi uçağa binince kaybolmamalı.
	 * Bunun bedeli, iade edilmiş bir hakkın bir sonraki başarılı sorguya kadar
	 * açık kalmasıdır; bilinçli bir ödünç.
	 */
	it("sorgu yapılamazsa önbellekteki hakkı korur ve önbelleğe dokunmaz", () => {
		const { entitlement, cacheUpdate } = resolveEntitlement(
			{ native: true, cached: cache(true), playResult: null },
			NOW,
		);
		expect(entitlement).toEqual({ paywallActive: true, fullAccess: true });
		expect(cacheUpdate).toBeNull();
	});

	it("sorgu yapılamaz ve önbellek yoksa kısıtlı kalır", () => {
		const { entitlement } = resolveEntitlement(
			{ native: true, cached: null, playResult: null },
			NOW,
		);
		expect(entitlement).toEqual({ paywallActive: true, fullAccess: false });
	});
});

describe("parseCachedEntitlement", () => {
	it("geçerli kaydı okur", () => {
		const raw = JSON.stringify(cache(true));
		expect(parseCachedEntitlement(raw)).toEqual(cache(true));
	});

	/**
	 * Depodaki değer kullanıcı tarafından düzenlenebilir; şekli tutmayan bir
	 * kayıt sessizce yok sayılmalı, arayüzü tanımsız bir hâle sokmamalı.
	 */
	it.each([
		["boş", null],
		["JSON değil", "{bozuk"],
		["dizi", "[]"],
		["null", "null"],
		["eksik alan", '{"fullAccess":true}'],
		["yanlış tip", '{"fullAccess":"evet","native":true}'],
		["hak dize", '{"fullAccess":1,"native":1}'],
	])("%s girdiyi yok sayar", (_ad, raw) => {
		expect(parseCachedEntitlement(raw)).toBeNull();
	});

	it("checkedAt eksikse boş dizeye düşer ama kaydı geçersiz saymaz", () => {
		const parsed = parseCachedEntitlement(
			'{"fullAccess":true,"native":true}',
		);
		expect(parsed).toEqual({ fullAccess: true, native: true, checkedAt: "" });
	});
});

describe("entitlementFromCache", () => {
	it("önbellek yoksa null döner — arayüz iskelet gösterir", () => {
		expect(entitlementFromCache(null)).toBeNull();
	});

	it("native olmayan kayıt paywall'ı kapatır", () => {
		expect(entitlementFromCache(cache(false, false))).toEqual({
			paywallActive: false,
			fullAccess: false,
		});
	});

	it("native kayıt paywall'ı açar", () => {
		expect(entitlementFromCache(cache(true))).toEqual({
			paywallActive: true,
			fullAccess: true,
		});
	});
});
