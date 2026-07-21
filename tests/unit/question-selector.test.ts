import { describe, expect, it } from "vitest";
import {
	countByDifficulty,
	createRng,
	selectQuestions,
	shuffle,
} from "@/lib/selector/question-selector";
import type { Difficulty, Question } from "@/types/content";

function makeQuestion(
	id: string,
	difficulty: Difficulty,
	status: Question["status"] = "published",
): Question {
	return {
		id,
		subjectId: "657-dmk",
		topicId: "657-dmk/disiplin-cezalari",
		scope: "ortak",
		difficulty,
		stem: `Örnek soru kökü ${id}`,
		options: ["A", "B", "C", "D"],
		correctIndex: 0,
		explanation: "Bu bir test açıklamasıdır ve yeterince uzundur.",
		legalRef: { law: "657 sayılı Devlet Memurları Kanunu" },
		source: { kind: "original", origin: "test", license: "own-work" },
		status,
		tags: [],
		version: 1,
		updatedAt: "2026-07-21",
	};
}

const pool: Question[] = [
	...Array.from({ length: 6 }, (_, i) => makeQuestion(`k${i}`, "kolay")),
	...Array.from({ length: 6 }, (_, i) => makeQuestion(`o${i}`, "orta")),
	...Array.from({ length: 6 }, (_, i) => makeQuestion(`z${i}`, "zor")),
	...Array.from({ length: 6 }, (_, i) => makeQuestion(`u${i}`, "uzman")),
];

describe("shuffle", () => {
	it("girdiyi değiştirmez ve tüm elemanları korur", () => {
		const input = [1, 2, 3, 4, 5];
		const output = shuffle(input, createRng(42));

		expect(input).toEqual([1, 2, 3, 4, 5]);
		expect(output.slice().sort()).toEqual(input);
	});
});

describe("selectQuestions", () => {
	it("aynı tohumla aynı sonucu verir", () => {
		const options = {
			pool,
			difficulty: "karisik" as const,
			count: 8,
			seed: "sabit-tohum",
		};
		const first = selectQuestions(options).map((q) => q.id);
		const second = selectQuestions(options).map((q) => q.id);

		expect(first).toEqual(second);
	});

	it("farklı tohumla farklı sonuç verir", () => {
		const a = selectQuestions({
			pool,
			difficulty: "karisik",
			count: 8,
			seed: "tohum-a",
		}).map((q) => q.id);
		const b = selectQuestions({
			pool,
			difficulty: "karisik",
			count: 8,
			seed: "tohum-b",
		}).map((q) => q.id);

		expect(a).not.toEqual(b);
	});

	it("belirli zorluk seçildiğinde başka zorluk döndürmez", () => {
		const picked = selectQuestions({
			pool,
			difficulty: "zor",
			count: 5,
			seed: "x",
		});

		expect(picked).toHaveLength(5);
		expect(picked.every((q) => q.difficulty === "zor")).toBe(true);
	});

	it("yayımlanmamış soruları asla seçmez", () => {
		const withDrafts = [
			...pool,
			makeQuestion("taslak-1", "kolay", "draft"),
			makeQuestion("inceleme-1", "kolay", "review"),
		];
		const picked = selectQuestions({
			pool: withDrafts,
			difficulty: "kolay",
			count: 100,
			seed: "x",
		});

		expect(picked.every((q) => q.status === "published")).toBe(true);
	});

	it("dışlanan soruları seçmez", () => {
		const excludeIds = pool.filter((q) => q.difficulty === "kolay").map((q) => q.id);
		const picked = selectQuestions({
			pool,
			difficulty: "kolay",
			count: 5,
			seed: "x",
			excludeIds,
		});

		expect(picked).toHaveLength(0);
	});

	it("aynı soruyu iki kez döndürmez", () => {
		const picked = selectQuestions({
			pool,
			difficulty: "karisik",
			count: 20,
			seed: "x",
		});
		expect(new Set(picked.map((q) => q.id)).size).toBe(picked.length);
	});

	it("havuz istenenden azsa mevcut olanların tamamını döner", () => {
		const küçükHavuz = pool.filter((q) => q.difficulty === "uzman").slice(0, 3);
		const picked = selectQuestions({
			pool: küçükHavuz,
			difficulty: "uzman",
			count: 20,
			seed: "x",
		});

		expect(picked).toHaveLength(3);
	});

	it("karışıkta zorlukları dengeli dağıtır", () => {
		const picked = selectQuestions({
			pool,
			difficulty: "karisik",
			count: 8,
			seed: "x",
		});
		const counts = countByDifficulty(picked);

		expect(picked).toHaveLength(8);
		// 8 soru, 4 zorluk: her seviyeden en az bir soru gelmeli.
		for (const level of ["kolay", "orta", "zor", "uzman"] as const) {
			expect(counts[level]).toBeGreaterThan(0);
		}
	});

	it("bir zorlukta soru yoksa kalanı diğerlerinden tamamlar", () => {
		const eksikHavuz = pool.filter((q) => q.difficulty !== "uzman");
		const picked = selectQuestions({
			pool: eksikHavuz,
			difficulty: "karisik",
			count: 12,
			seed: "x",
		});

		expect(picked).toHaveLength(12);
		expect(picked.some((q) => q.difficulty === "uzman")).toBe(false);
	});
});
