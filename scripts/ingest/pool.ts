import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { dedupeKey } from "./dedupe";
import type { CandidateQuestion } from "./types";

/**
 * İthal adaylarını MEVCUT havuza karşı eler.
 *
 * `dedupe.ts` yalnızca tek bir ithal koşusunun İÇİNE bakar; `content/subjects/**`
 * altında zaten duran sorular görüş alanında değildir. Bu yüzden ikinci bir
 * kitapçık partisi, ilk partide alınmış soruları yeniden inceleme kuyruğuna
 * sokabiliyordu — ve editör aynı soruyu ikinci kez doldurmuş oluyordu. Bu modül
 * o boşluğu kapatır: aday havuza yazılmadan önce depodakilerle karşılaştırılır.
 *
 * İki ayrı kesinlik düzeyi vardır ve farklı davranırlar:
 *
 * - **Birebir** (aynı gövde + aynı şık kümesi, `dedupeKey`): kesin tekrardır,
 *   sessizce düşülür. Editöre götürmenin bir faydası yok.
 * - **Yakın** (benzerlik eşiği, `near-duplicates.ts`): karar hüküm düzeyinde
 *   verilir, makine bilemez. Aday tutulur, uyarı basılır.
 */

/** Havuzdaki bir sorunun karşılaştırma için gereken alanları. */
export interface PoolQuestion {
	id: string;
	stem: string;
	options: string[];
	correctIndex: number;
	status: string;
}

/**
 * `content/subjects/<ders>/questions/*.json` altındaki tüm soruları okur.
 *
 * Şema doğrulaması YAPILMAZ — o `content:build`in işidir. Burada amaç
 * karşılaştırma; bozuk bir dosya ithal hattını durdurmamalı.
 */
export async function loadPoolQuestions(subjectsDir: string): Promise<PoolQuestion[]> {
	if (!existsSync(subjectsDir)) return [];

	const questions: PoolQuestion[] = [];
	const subjects = await readdir(subjectsDir, { withFileTypes: true });

	for (const subject of subjects) {
		if (!subject.isDirectory()) continue;
		const questionsDir = path.join(subjectsDir, subject.name, "questions");
		if (!existsSync(questionsDir)) continue;

		for (const file of await readdir(questionsDir)) {
			if (!file.endsWith(".json")) continue;
			const raw = await readFile(path.join(questionsDir, file), "utf8");
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) continue;
			for (const entry of parsed as PoolQuestion[]) {
				if (typeof entry?.stem === "string" && Array.isArray(entry.options)) {
					questions.push(entry);
				}
			}
		}
	}

	return questions;
}

export interface PoolSplit {
	/** Havuzda birebir karşılığı olmayan adaylar — yazılacak olanlar. */
	fresh: CandidateQuestion[];
	/** Havuzda zaten bulunan adaylar; hangi soruyla eşleştikleriyle birlikte. */
	alreadyInPool: { candidate: CandidateQuestion; poolId: string }[];
}

/** Adayları havuzda birebir karşılığı olanlar / olmayanlar diye ayırır. */
export function splitByPool(
	candidates: readonly CandidateQuestion[],
	pool: readonly PoolQuestion[],
): PoolSplit {
	const byKey = new Map<string, string>();
	for (const question of pool) byKey.set(dedupeKey(question), question.id);

	const split: PoolSplit = { fresh: [], alreadyInPool: [] };
	for (const candidate of candidates) {
		const poolId = byKey.get(dedupeKey(candidate));
		if (poolId === undefined) split.fresh.push(candidate);
		else split.alreadyInPool.push({ candidate, poolId });
	}
	return split;
}
