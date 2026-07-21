import { describe, expect, it } from "vitest";
import {
	MASTERY_THRESHOLD,
	computeMastery,
	isMastered,
	masteryLevel,
} from "@/lib/scoring/mastery";

describe("computeMastery", () => {
	it("hiç deneme yoksa sıfırdır", () => {
		expect(computeMastery([])).toBe(0);
	});

	it("hepsi doğruysa 100, hepsi yanlışsa 0", () => {
		expect(computeMastery([true, true, true])).toBe(100);
		expect(computeMastery([false, false, false])).toBe(0);
	});

	it("son denemelere daha çok ağırlık verir", () => {
		// Aynı sayıda doğru/yanlış, farklı sıra: gelişen kullanıcı daha yüksek almalı.
		const gelisen = computeMastery([false, false, false, true, true, true]);
		const gerileyen = computeMastery([true, true, true, false, false, false]);

		expect(gelisen).toBeGreaterThan(gerileyen);
		expect(gelisen).toBeGreaterThan(50);
		expect(gerileyen).toBeLessThan(50);
	});

	it("eski kötü performans yeni iyi performansı gölgelemez", () => {
		// Ürün kararı: ilk denemede zorlanan ama sonradan öğrenen kullanıcı
		// 'zayıf konu' listesinde takılı kalmamalı.
		const outcomes = [
			...Array<boolean>(10).fill(false),
			...Array<boolean>(10).fill(true),
		];
		expect(computeMastery(outcomes)).toBeGreaterThan(MASTERY_THRESHOLD);
	});
});

describe("isMastered", () => {
	it("yüksek puan tek başına yetmez, yeterli deneme de gerekir", () => {
		expect(isMastered(100, 3)).toBe(false);
		expect(isMastered(100, 8)).toBe(true);
	});

	it("eşiğin altındaki puan hakim saymaz", () => {
		expect(isMastered(MASTERY_THRESHOLD - 0.1, 20)).toBe(false);
	});
});

describe("masteryLevel", () => {
	it("çok az denemede 'baslangic' der", () => {
		expect(masteryLevel(100, 1)).toBe("baslangic");
	});

	it("seviyeleri doğru sıralar", () => {
		expect(masteryLevel(90, 20)).toBe("hakim");
		expect(masteryLevel(60, 20)).toBe("iyi");
		expect(masteryLevel(20, 20)).toBe("gelisiyor");
	});
});
