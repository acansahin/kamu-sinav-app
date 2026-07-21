import { DIFFICULTY_ORDER, type Difficulty, type Question } from "@/types/content";

/**
 * Soru seçimi — saf ve deterministik.
 *
 * Rastgelelik tohumla (seed) beslenir: aynı tohum aynı soru dizisini üretir.
 * Bu sayede hem testler deterministiktir, hem de yarıda kalan bir oturum
 * yeniden açıldığında kullanıcı aynı soruları görür (oturum kimliği tohum olur).
 */

/** Küçük, hızlı ve deterministik PRNG (mulberry32). */
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return function next(): number {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Dizeden kararlı bir sayısal tohum üretir (FNV-1a). */
export function seedFromString(value: string): number {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

/** Fisher-Yates. Girdiyi değiştirmez. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
	const result = items.slice();
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export type DifficultyFilter = Difficulty | "karisik";

export interface SelectOptions {
	pool: readonly Question[];
	difficulty: DifficultyFilter;
	count: number;
	/** Aynı tohum aynı sonucu verir. */
	seed: string;
	/** Bu sorular seçilmez (ör. az önce çözülenler). */
	excludeIds?: readonly string[];
}

/**
 * Havuzdan soru seçer.
 *
 * "karisik" seçildiğinde zorluklar arasında olabildiğince dengeli dağıtır:
 * önce her zorluktan eşit pay alınır, artan kontenjan kalan sorulardan
 * tamamlanır. Havuz istenen sayıdan azsa mevcut olanların tamamı döner —
 * çağıran taraf `length` üzerinden gerçek sayıyı görmelidir.
 */
export function selectQuestions(options: SelectOptions): Question[] {
	const { pool, difficulty, count, seed, excludeIds = [] } = options;
	const excluded = new Set(excludeIds);
	const rng = createRng(seedFromString(seed));

	const available = pool.filter(
		(q) => q.status === "published" && !excluded.has(q.id),
	);

	if (difficulty !== "karisik") {
		const matching = available.filter((q) => q.difficulty === difficulty);
		return shuffle(matching, rng).slice(0, count);
	}

	const byDifficulty = new Map<Difficulty, Question[]>();
	for (const level of DIFFICULTY_ORDER) {
		byDifficulty.set(
			level,
			shuffle(
				available.filter((q) => q.difficulty === level),
				rng,
			),
		);
	}

	const picked: Question[] = [];
	const perLevel = Math.ceil(count / DIFFICULTY_ORDER.length);

	for (const level of DIFFICULTY_ORDER) {
		const bucket = byDifficulty.get(level) ?? [];
		picked.push(...bucket.splice(0, perLevel));
	}

	// Bazı zorluklarda yeterli soru yoksa kalanı diğerlerinden tamamla.
	if (picked.length < count) {
		const leftovers = DIFFICULTY_ORDER.flatMap(
			(level) => byDifficulty.get(level) ?? [],
		);
		picked.push(...shuffle(leftovers, rng).slice(0, count - picked.length));
	}

	return shuffle(picked, rng).slice(0, count);
}

/** Bir havuzda her zorluktan kaç yayımlanmış soru olduğunu sayar. */
export function countByDifficulty(
	pool: readonly Question[],
): Record<Difficulty, number> {
	const counts = Object.fromEntries(
		DIFFICULTY_ORDER.map((level) => [level, 0]),
	) as Record<Difficulty, number>;

	for (const question of pool) {
		if (question.status === "published") counts[question.difficulty] += 1;
	}
	return counts;
}
