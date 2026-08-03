import { describe, expect, it } from "vitest";
import { parentRoute, routes } from "@/lib/routes";

describe("parentRoute", () => {
	it("konu özetinin üstü dersin konu listesidir", () => {
		expect(parentRoute("/konular/657-dmk/disiplin-cezalari")).toBe(
			"/konular/657-dmk",
		);
	});

	it("yazdırma sayfasının üstü de dersin konu listesidir", () => {
		expect(parentRoute("/konular/657-dmk/yazdir")).toBe("/konular/657-dmk");
	});

	it("dersin üstü konu listesinin kendisidir", () => {
		expect(parentRoute("/konular/657-dmk")).toBe("/konular");
	});

	it("test setinin üstü o konunun test listesidir", () => {
		expect(parentRoute("/testler/anayasa/yasama/test-3")).toBe(
			"/testler/anayasa/yasama",
		);
	});

	/**
	 * Ara bir /testler/<ders> rotası yok; bu yüzden konu test listesinden
	 * doğrudan /testler'e çıkılır. Tek segment düşürmek var olmayan bir
	 * sayfaya götürürdü.
	 */
	it("konu test listesinden doğrudan /testler'e çıkılır", () => {
		expect(parentRoute("/testler/anayasa/yasama")).toBe("/testler");
	});

	it("istatistik ilerlemenin detayıdır", () => {
		expect(parentRoute("/istatistik")).toBe("/ilerleme");
	});

	it.each([
		"/ayarlar",
		"/hesap",
		"/arama",
		"/hakkinda",
		"/gizlilik",
		"/deneme",
		"/yanlislarim",
		"/konular",
		"/testler",
		"/",
	])("%s gibi kök seviyesindeki sayfalar ana sayfaya düşer", (pathname) => {
		expect(parentRoute(pathname)).toBe("/");
	});

	it("sondaki eğik çizgi sonucu değiştirmez", () => {
		expect(parentRoute("/konular/657-dmk/")).toBe("/konular");
	});

	it("bilinmeyen rota ana sayfaya düşer", () => {
		expect(parentRoute("/bilinmeyen/derin/yol")).toBe("/");
	});

	/** Üst rota üretimi, bağlantı üretimiyle aynı şemayı kullanmalı. */
	it("routes yardımcılarıyla aynı biçimi üretir", () => {
		expect(parentRoute("/konular/etik/yazdir")).toBe(routes.subject("etik"));
		expect(parentRoute("/testler/etik/yasaklar/test-1")).toBe(
			routes.topicTest("etik", "yasaklar"),
		);
	});
});
