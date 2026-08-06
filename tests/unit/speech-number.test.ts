import { describe, expect, it } from "vitest";
import { bulunmaEki, kesriOku, sayiyiOku } from "@/lib/speech/number-tr";

/**
 * Kesir okunuşu.
 *
 * Bu modül yalnızca kesirler için var; testler de o kapsamı sabitliyor.
 * Bulunma eki iki kuralın kesişimi (büyük ünlü uyumu + ünsüz benzeşmesi) ve
 * ikisinden biri unutulursa hata yalnızca kulakla fark edilir.
 */

describe("sayiyiOku", () => {
	it.each([
		[0, "sıfır"],
		[1, "bir"],
		[3, "üç"],
		[8, "sekiz"],
		[10, "on"],
		[15, "on beş"],
		[30, "otuz"],
		[40, "kırk"],
		[100, "yüz"],
		[125, "yüz yirmi beş"],
		[657, "altı yüz elli yedi"],
		[1000, "bin"],
		[2000, "iki bin"],
		[1990, "bin dokuz yüz doksan"],
	])("%i → %s", (sayi, beklenen) => {
		expect(sayiyiOku(sayi)).toBe(beklenen);
	});

	/** "bir yüz" ve "bir bin" Türkçede söylenmez. */
	it("yüz ve bin için gereksiz 'bir' eklemez", () => {
		expect(sayiyiOku(100)).not.toContain("bir yüz");
		expect(sayiyiOku(1000)).not.toContain("bir bin");
	});

	it("aralık dışında boş dize döner — çağıran rakamı olduğu gibi bırakır", () => {
		expect(sayiyiOku(-1)).toBe("");
		expect(sayiyiOku(10000)).toBe("");
		expect(sayiyiOku(1.5)).toBe("");
	});
});

describe("bulunmaEki", () => {
	it.each([
		["otuz", "da"],
		["kırk", "ta"],
		["on", "da"],
		["yüz", "de"],
		["bin", "de"],
		["sekiz", "de"],
		["dört", "te"],
		["beş", "te"],
		["üç", "te"],
		["yedi", "de"],
		["doksan", "da"],
	])("%s → -%s", (sozcuk, beklenen) => {
		expect(bulunmaEki(sozcuk)).toBe(beklenen);
	});
});

describe("kesriOku", () => {
	/** İçerikte gerçekten geçen kesirler (657 DMK aylıktan kesme oranları). */
	it.each([
		[1, 30, "otuzda bir"],
		[1, 8, "sekizde bir"],
		[1, 4, "dörtte bir"],
		[3, 4, "dörtte üç"],
		[1, 2, "ikide bir"],
		[2, 3, "üçte iki"],
		[1, 100, "yüzde bir"],
	])("%i/%i → %s", (pay, payda, beklenen) => {
		expect(kesriOku(pay, payda)).toBe(beklenen);
	});

	it("çok basamaklı paydada ek SON sözcüğe göre belirlenir", () => {
		expect(kesriOku(1, 2000)).toBe("iki binde bir");
	});

	it("okunamayan paydada null döner", () => {
		expect(kesriOku(1, 100000)).toBeNull();
	});
});
