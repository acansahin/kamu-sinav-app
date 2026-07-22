import { describe, expect, it } from "vitest";
import {
	extractSnippet,
	foldForSearch,
	matchesAllTokens,
	tokenize,
} from "@/lib/search/normalize";

describe("foldForSearch", () => {
	it("Türkçe büyük I harfini ı yapar", () => {
		// Varsayılan toLowerCase() bunu "i" yapardı; Türkçede yanlıştır.
		expect(foldForSearch("IŞIK")).toBe("isik");
	});

	it("noktalı büyük İ harfini i yapar", () => {
		expect(foldForSearch("İZİN")).toBe("izin");
	});

	it("aksanlı harfleri sadeleştirir", () => {
		expect(foldForSearch("Disiplin Cezaları")).toBe("disiplin cezalari");
		expect(foldForSearch("çğıöşü")).toBe("cgiosu");
	});

	it("uzunluğu korur — kesit çıkarma buna dayanır", () => {
		const samples = ["İZİN", "IŞIK", "Cezaları", "ĞÜŞÖÇI", "âîû"];
		for (const sample of samples) {
			expect(foldForSearch(sample)).toHaveLength(sample.length);
		}
	});
});

describe("tokenize", () => {
	it("kelimelere böler ve tek harfleri atar", () => {
		expect(tokenize("disiplin cezaları")).toEqual(["disiplin", "cezalari"]);
		expect(tokenize("a bc")).toEqual(["bc"]);
	});

	it("noktalama ve fazla boşluğu temizler", () => {
		expect(tokenize("  aylıktan  kesme, 1/30 ")).toEqual([
			"ayliktan",
			"kesme",
			"30",
		]);
	});

	it("boş sorguda boş dizi döner", () => {
		expect(tokenize("   ")).toEqual([]);
	});
});

describe("matchesAllTokens", () => {
	const item = { haystack: foldForSearch("Disiplin Cezaları ve Zamanaşımı") };

	it("aksansız yazılan sorguyu bulur", () => {
		expect(matchesAllTokens(item, tokenize("cezalari"))).toBe(true);
	});

	it("tüm kelimeler geçmelidir — biri eksikse eşleşmez", () => {
		expect(matchesAllTokens(item, tokenize("disiplin zamanasimi"))).toBe(true);
		expect(matchesAllTokens(item, tokenize("disiplin hediye"))).toBe(false);
	});

	it("kelimelerin sırası önemli değildir", () => {
		expect(matchesAllTokens(item, tokenize("zamanasimi disiplin"))).toBe(true);
	});
});

describe("extractSnippet", () => {
	const uzunMetin =
		"Devlet memurları hakkında uygulanacak disiplin cezaları Kanun'un 125. maddesinde sayılmıştır ve ağırlık sırasına göre düzenlenmiştir. Uyarma en hafif cezadır.";

	it("eşleşen kelimenin etrafından kesit alır", () => {
		const snippet = extractSnippet(uzunMetin, tokenize("uyarma"));
		expect(snippet).toContain("Uyarma");
	});

	it("kesiti orijinal metinden alır, aksanları bozmaz", () => {
		const snippet = extractSnippet(uzunMetin, tokenize("cezalari"));
		expect(snippet).toContain("cezaları");
	});

	it("kısa metni olduğu gibi döner", () => {
		expect(extractSnippet("Kısa metin", tokenize("kisa"))).toBe("Kısa metin");
	});

	it("eşleşme yoksa baştan kesit verir", () => {
		const snippet = extractSnippet(uzunMetin, tokenize("bulunamaz"));
		expect(snippet.startsWith("Devlet memurları")).toBe(true);
	});
});
