import { describe, expect, it } from "vitest";
import {
	TEST_SHAPE,
	TEST_SIZE,
	buildTestSets,
	parseTestSetSlug,
	planSizes,
} from "@/lib/selector/test-sets";
import { DIFFICULTY_ORDER, type Difficulty, type Question } from "@/types/content";

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

/** Verilen dağılıma göre havuz üretir. */
function makePool(counts: Partial<Record<Difficulty, number>>): Question[] {
	return DIFFICULTY_ORDER.flatMap((level) =>
		Array.from({ length: counts[level] ?? 0 }, (_, index) =>
			makeQuestion(`${level}-${index}`, level),
		),
	);
}

function countLevels(questions: Question[]): Record<Difficulty, number> {
	const counts = Object.fromEntries(
		DIFFICULTY_ORDER.map((level) => [level, 0]),
	) as Record<Difficulty, number>;
	for (const question of questions) counts[question.difficulty] += 1;
	return counts;
}

describe("planSizes", () => {
	it("tam bölünen havuzu 10'luk testlere ayırır", () => {
		expect(planSizes(40)).toEqual([10, 10, 10, 10]);
	});

	it("küçük artığı ayrı test açmak yerine son teste ekler", () => {
		expect(planSizes(41)).toEqual([10, 10, 10, 11]);
		expect(planSizes(42)).toEqual([10, 10, 10, 12]);
	});

	it("büyük artık kendi kısa testini alır", () => {
		expect(planSizes(43)).toEqual([10, 10, 10, 10, 3]);
		expect(planSizes(17)).toEqual([10, 7]);
	});

	it("havuz bir testten küçükse tek test üretir", () => {
		expect(planSizes(6)).toEqual([6]);
		expect(planSizes(0)).toEqual([]);
	});
});

describe("parseTestSetSlug", () => {
	it("geçerli slug'ı numaraya çevirir", () => {
		expect(parseTestSetSlug("test-1")).toBe(1);
		expect(parseTestSetSlug("test-12")).toBe(12);
	});

	it("geçersiz biçimi reddeder", () => {
		for (const slug of ["test", "test-0", "test-a", "1", "deneme-1", "test-1x"]) {
			expect(parseTestSetSlug(slug)).toBeNull();
		}
	});
});

describe("buildTestSets", () => {
	it("dengeli havuzda hedeflenen zorluk dağılımını verir", () => {
		const sets = buildTestSets(
			makePool({ kolay: 4, orta: 6, zor: 6, uzman: 4 }),
			"konu",
		);

		expect(sets).toHaveLength(2);
		for (const set of sets) {
			expect(set.questions).toHaveLength(TEST_SIZE);
			expect(countLevels(set.questions)).toEqual(TEST_SHAPE);
		}
	});

	it("her soruyu tam olarak bir teste koyar", () => {
		const pool = makePool({ kolay: 8, orta: 20, zor: 11, uzman: 4 });
		const sets = buildTestSets(pool, "genel-hukumler");
		const ids = sets.flatMap((set) => set.questions.map((q) => q.id));

		expect(ids).toHaveLength(pool.length);
		expect(new Set(ids).size).toBe(pool.length);
	});

	it("kıt seviyeyi ilk testlerde tüketmeyip testlere yayar", () => {
		// 43 soruluk gerçek bir konu: yalnızca 4 uzman soru var, 5 test çıkıyor.
		// Kıtlık orantılı dağıtılmazsa ilk iki test uzman soruları bitirir.
		const sets = buildTestSets(
			makePool({ kolay: 8, orta: 20, zor: 11, uzman: 4 }),
			"genel-hukumler",
		);

		const uzmanBaşına = sets.map((set) => set.countsByDifficulty.uzman);
		expect(uzmanBaşına).toEqual([1, 1, 1, 1, 0]);
		expect(Math.max(...uzmanBaşına)).toBeLessThanOrEqual(1);
	});

	it("planlanan boyları birebir doldurur", () => {
		const sets = buildTestSets(
			makePool({ kolay: 8, orta: 20, zor: 11, uzman: 4 }),
			"genel-hukumler",
		);

		expect(sets.map((set) => set.questions.length)).toEqual([10, 10, 10, 10, 3]);
	});

	it("dolu testlerin her birinde dört seviye de bulunur", () => {
		// Havuz seviyelerden birinde çok kıt olmadıkça her test dört seviyeyi
		// birden içermelidir — testin amacı seviye yaymak.
		const sets = buildTestSets(
			makePool({ kolay: 12, orta: 30, zor: 24, uzman: 14 }),
			"disiplin",
		);

		for (const set of sets.filter((s) => s.questions.length === TEST_SIZE)) {
			for (const level of DIFFICULTY_ORDER) {
				expect(set.countsByDifficulty[level]).toBeGreaterThan(0);
			}
		}
	});

	it("test içinde sorular kolaydan uzmana sıralanır", () => {
		const sets = buildTestSets(
			makePool({ kolay: 4, orta: 6, zor: 6, uzman: 4 }),
			"konu",
		);
		const sıra = sets[0].questions.map((q) =>
			DIFFICULTY_ORDER.indexOf(q.difficulty),
		);

		expect(sıra).toEqual([...sıra].sort((a, b) => a - b));
	});

	it("aynı havuz ve tohumla aynı testleri üretir", () => {
		const pool = makePool({ kolay: 8, orta: 20, zor: 11, uzman: 4 });
		const ilk = buildTestSets(pool, "konu").map((s) =>
			s.questions.map((q) => q.id),
		);
		const ikinci = buildTestSets(pool, "konu").map((s) =>
			s.questions.map((q) => q.id),
		);

		expect(ilk).toEqual(ikinci);
	});

	it("farklı tohum farklı bölme üretir", () => {
		const pool = makePool({ kolay: 8, orta: 20, zor: 11, uzman: 4 });
		const a = buildTestSets(pool, "konu-a")[0].questions.map((q) => q.id);
		const b = buildTestSets(pool, "konu-b")[0].questions.map((q) => q.id);

		expect(a).not.toEqual(b);
	});

	it("yayımlanmamış soruları hiçbir teste almaz", () => {
		const pool = [
			...makePool({ kolay: 4, orta: 6, zor: 6, uzman: 4 }),
			makeQuestion("taslak", "kolay", "draft"),
			makeQuestion("inceleme", "orta", "review"),
		];
		const sets = buildTestSets(pool, "konu");
		const ids = sets.flatMap((set) => set.questions.map((q) => q.id));

		expect(ids).toHaveLength(20);
		expect(ids).not.toContain("taslak");
		expect(ids).not.toContain("inceleme");
	});

	it("bir seviye tamamen boşsa kalanı diğer seviyelerden tamamlar", () => {
		const sets = buildTestSets(makePool({ kolay: 5, orta: 10, zor: 5 }), "konu");

		expect(sets.map((s) => s.questions.length)).toEqual([10, 10]);
		for (const set of sets) {
			expect(set.countsByDifficulty.uzman).toBe(0);
		}
	});

	it("boş havuzda test üretmez", () => {
		expect(buildTestSets([], "konu")).toEqual([]);
	});

	it("sayılan dağılım gerçek sorularla uyuşur", () => {
		const sets = buildTestSets(
			makePool({ kolay: 8, orta: 20, zor: 11, uzman: 4 }),
			"konu",
		);

		for (const set of sets) {
			expect(set.countsByDifficulty).toEqual(countLevels(set.questions));
		}
	});
});
