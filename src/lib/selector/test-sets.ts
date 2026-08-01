import {
	DIFFICULTY_ORDER,
	type Difficulty,
	type Question,
} from "@/types/content";
import {
	createRng,
	seedFromString,
	shuffle,
} from "@/lib/selector/question-selector";

/**
 * Konu havuzunu numaralı testlere böler — saf ve deterministik.
 *
 * Kullanıcı testi başlatırken zorluk ve soru sayısı seçmez: her konu, sabit
 * içerikli "Test 1, Test 2, ..." setlerine önceden ayrılır. Bunun iki sonucu
 * var:
 *   - Test 3 her cihazda ve her açılışta AYNI 10 sorudur; "Test 3'ten 80 aldım"
 *     karşılaştırılabilir bir cümledir.
 *   - Bölme derleme zamanında yapılabilir, statik export bozulmaz.
 *
 * Bölme havuzun kendisine bağlıdır: konuya yeni soru eklenince setler yeniden
 * dağılır ve eski bir "Test 3" skoru artık başka bir soru kümesini gösterir.
 * Bu bilinçli bir ödünç — alternatifi, havuz büyüdükçe hiç dokunulmayan
 * dengesiz setler bırakmaktı.
 */

/** Bir testin standart soru sayısı. */
export const TEST_SIZE = 10;

/**
 * Bir testin hedeflenen zorluk dağılımı. Toplamı `TEST_SIZE` olmalıdır.
 *
 * Hedeftir, garanti değil: konunun havuzunda o seviyeden yeterli soru yoksa
 * eksik, en çok artan seviyeden kapatılır (bkz. `buildTestSets`).
 */
export const TEST_SHAPE: Record<Difficulty, number> = {
	kolay: 2,
	orta: 3,
	zor: 3,
	uzman: 2,
};

export interface TestSet {
	/** URL parçası: "test-1" */
	slug: string;
	/** 1 tabanlı sıra — ekranda "Test 3" olarak görünür. */
	number: number;
	questions: Question[];
	countsByDifficulty: Record<Difficulty, number>;
}

export function testSetSlug(number: number): string {
	return `test-${number}`;
}

/** "test-3" → 3. Biçim tutmuyorsa null. */
export function parseTestSetSlug(slug: string): number | null {
	const match = /^test-(\d+)$/.exec(slug);
	if (!match) return null;
	const number = Number(match[1]);
	return Number.isInteger(number) && number > 0 ? number : null;
}

function emptyCounts(): Record<Difficulty, number> {
	return Object.fromEntries(DIFFICULTY_ORDER.map((level) => [level, 0])) as
		Record<Difficulty, number>;
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}

/**
 * `total`ı ağırlıklara göre tam sayılara böler (en büyük artık yöntemi).
 * Dönen dizinin toplamı her zaman `total`dır ve ağırlığı 0 olan hiçbir gözeye
 * pay düşmez.
 */
function apportion(total: number, weights: readonly number[]): number[] {
	const weightSum = sum(weights);
	if (total <= 0 || weightSum <= 0) return weights.map(() => 0);

	const exact = weights.map((weight) => (weight * total) / weightSum);
	const result = exact.map(Math.floor);
	let remaining = total - sum(result);

	// Artıklar büyükten küçüğe dağıtılır; eşitlikte sıra belirleyicidir ki
	// sonuç deterministik olsun.
	const byFraction = exact
		.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
		.sort((a, b) => b.fraction - a.fraction || a.index - b.index);

	for (const { index } of byFraction) {
		if (remaining === 0) break;
		result[index] += 1;
		remaining -= 1;
	}
	return result;
}

/**
 * Havuzu test boylarına ayırır.
 *
 * Testler 10 soruluktur. Artan 1-2 soru için ayrı bir test açmak anlamsız
 * olurdu ("Test 7 · 1 soru"), bu yüzden son teste eklenir; daha büyük artık
 * kendi kısa testini alır. Her iki durumda da havuzdaki hiçbir soru
 * erişilemez kalmaz.
 */
export function planSizes(total: number): number[] {
	if (total <= 0) return [];
	if (total <= TEST_SIZE) return [total];

	const sizes = Array.from(
		{ length: Math.floor(total / TEST_SIZE) },
		() => TEST_SIZE,
	);
	const rest = total % TEST_SIZE;

	if (rest === 0) return sizes;
	if (rest <= 2) {
		sizes[sizes.length - 1] += rest;
		return sizes;
	}
	return [...sizes, rest];
}

/** `TEST_SHAPE`i verilen boya ölçekler; toplamı tam olarak `size` olur. */
function shapeFor(size: number): Record<Difficulty, number> {
	const shares = apportion(
		size,
		DIFFICULTY_ORDER.map((level) => TEST_SHAPE[level]),
	);
	const shape = emptyCounts();
	DIFFICULTY_ORDER.forEach((level, index) => {
		shape[level] = shares[index];
	});
	return shape;
}

/** En çok artan zorluk; hiç artan yoksa null. */
function pickDonor(surplus: Record<Difficulty, number>): Difficulty | null {
	let donor: Difficulty | null = null;
	for (const level of DIFFICULTY_ORDER) {
		if (surplus[level] > 0 && (donor === null || surplus[level] > surplus[donor])) {
			donor = level;
		}
	}
	return donor;
}

/**
 * Havuzu numaralı testlere böler.
 *
 * Her soru tam olarak bir teste girer. Zorluk dağılımı `TEST_SHAPE`i hedefler;
 * havuz o dengeyi kaldıramıyorsa (ör. 43 soruluk konuda yalnızca 4 uzman soru
 * var) kıtlık testlere ORANTILI dağıtılır — yoksa ilk testler uzman soruları
 * tüketir ve son testler hiç görmezdi.
 *
 * `seed` aynı kaldıkça sonuç aynıdır; konu kimliği tohum olarak yeterlidir.
 */
export function buildTestSets(
	pool: readonly Question[],
	seed: string,
): TestSet[] {
	const published = pool.filter((question) => question.status === "published");
	if (published.length === 0) return [];

	const rng = createRng(seedFromString(seed));
	const buckets = new Map<Difficulty, Question[]>(
		DIFFICULTY_ORDER.map((level) => [
			level,
			shuffle(
				published.filter((question) => question.difficulty === level),
				rng,
			),
		]),
	);

	const sizes = planSizes(published.length);
	const targets = sizes.map(shapeFor);
	const alloc = sizes.map(() => emptyCounts());
	const surplus = emptyCounts();

	// 1. Hedef kotalar. Seviye bollaşıyorsa artanı açıkları kapatmaya sakla,
	//    kıtsa eldekini testlere orantılı böl.
	for (const level of DIFFICULTY_ORDER) {
		const available = buckets.get(level)?.length ?? 0;
		const wanted = targets.map((target) => target[level]);
		const wantedTotal = sum(wanted);

		if (available >= wantedTotal) {
			wanted.forEach((count, index) => {
				alloc[index][level] = count;
			});
			surplus[level] = available - wantedTotal;
		} else {
			apportion(available, wanted).forEach((count, index) => {
				alloc[index][level] = count;
			});
		}
	}

	// 2. Açıkları artan sorularla kapat. Toplam açık ile toplam artan eşittir
	//    (boyların toplamı havuza eşit), bu yüzden döngü her zaman kapanır.
	for (let index = 0; index < sizes.length; index += 1) {
		let deficit = sizes[index] - sum(Object.values(alloc[index]));
		while (deficit > 0) {
			const donor = pickDonor(surplus);
			if (donor === null) break;
			alloc[index][donor] += 1;
			surplus[donor] -= 1;
			deficit -= 1;
		}
	}

	// 3. Soruları kovalardan çek. Test içinde sıra kolaydan uzmana doğrudur:
	//    çözen önce ısınır, sonra zorlanır.
	return sizes.map((_, index) => {
		const picked: Question[] = [];
		for (const level of DIFFICULTY_ORDER) {
			const bucket = buckets.get(level) ?? [];
			picked.push(...bucket.splice(0, alloc[index][level]));
		}

		const questions = shuffle(picked, rng).sort(
			(a, b) =>
				DIFFICULTY_ORDER.indexOf(a.difficulty) -
				DIFFICULTY_ORDER.indexOf(b.difficulty),
		);

		return {
			slug: testSetSlug(index + 1),
			number: index + 1,
			questions,
			countsByDifficulty: alloc[index],
		};
	});
}
