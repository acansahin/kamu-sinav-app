import type { MockExamTemplate, Question } from "@/types/content";
import { createRng, seedFromString, shuffle } from "./question-selector";

/**
 * Deneme sınavı soru seti üretimi — saf ve deterministik.
 *
 * Şablonun ders dağılımına uyar. Bir dersin havuzu yetmezse eksik kalan
 * kontenjanı sessizce başka derslerden doldurmaz: kullanıcıya "bu şablon şu an
 * çözülemez" demek, sessizce yanlış dağılımlı bir sınav üretmekten dürüsttür.
 */

export interface ExamBuildResult {
	questions: Question[];
	/** Havuzu yetmeyen dersler; boşsa sınav tam üretilebilmiştir. */
	shortfalls: { subjectId: string; requested: number; available: number }[];
}

export function buildExam(
	template: MockExamTemplate,
	pool: readonly Question[],
	seed: string,
): ExamBuildResult {
	const rng = createRng(seedFromString(seed));
	const published = pool.filter((q) => q.status === "published");

	const questions: Question[] = [];
	const shortfalls: ExamBuildResult["shortfalls"] = [];

	for (const slice of template.distribution) {
		const subjectPool = published.filter((q) => q.subjectId === slice.subjectId);

		if (subjectPool.length < slice.count) {
			shortfalls.push({
				subjectId: slice.subjectId,
				requested: slice.count,
				available: subjectPool.length,
			});
		}
		questions.push(...shuffle(subjectPool, rng).slice(0, slice.count));
	}

	// Dersler blok blok gelmesin; gerçek sınavda olduğu gibi karışık sırala.
	return { questions: shuffle(questions, rng), shortfalls };
}

/** Şablonun mevcut havuzla çözülebilir olup olmadığı. */
export function isTemplateSolvable(
	template: MockExamTemplate,
	pool: readonly Question[],
): boolean {
	return buildExam(template, pool, "probe").shortfalls.length === 0;
}
