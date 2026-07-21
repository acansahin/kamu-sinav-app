/**
 * Konu hakimiyeti (mastery) hesabı — saf fonksiyon.
 *
 * Ham doğruluk oranı kullanılmaz: bir konuyu ilk çözüşünde %40 yapıp sonradan
 * %90'a çıkan kullanıcının hâlâ zayıf görünmesi yanlış olur. Bu yüzden son
 * denemelere üstel olarak daha çok ağırlık verilir.
 */

/** Her bir eski deneme, bir öncekinin bu oranı kadar ağırlık taşır. */
const DECAY = 0.85;

/** "Hakim" sayılmak için gereken en düşük puan. */
export const MASTERY_THRESHOLD = 70;

/** Puanın anlamlı olması için gereken en az deneme sayısı. */
export const MASTERY_MIN_ATTEMPTS = 8;

/**
 * @param outcomes Eskiden yeniye sıralı doğru/yanlış dizisi.
 * @returns 0-100 arası hakimiyet puanı.
 */
export function computeMastery(outcomes: readonly boolean[]): number {
	if (outcomes.length === 0) return 0;

	let weightedCorrect = 0;
	let weightTotal = 0;

	// En yeni deneme ağırlık 1, bir öncekiler DECAY katsayısıyla azalır.
	for (let i = outcomes.length - 1, step = 0; i >= 0; i -= 1, step += 1) {
		const weight = DECAY ** step;
		weightTotal += weight;
		if (outcomes[i]) weightedCorrect += weight;
	}

	return Math.round((weightedCorrect / weightTotal) * 1000) / 10;
}

export function isMastered(
	masteryScore: number,
	questionsAttempted: number,
): boolean {
	return (
		masteryScore >= MASTERY_THRESHOLD &&
		questionsAttempted >= MASTERY_MIN_ATTEMPTS
	);
}

export type MasteryLevel = "baslangic" | "gelisiyor" | "iyi" | "hakim";

export function masteryLevel(
	masteryScore: number,
	questionsAttempted: number,
): MasteryLevel {
	if (questionsAttempted < 3) return "baslangic";
	if (isMastered(masteryScore, questionsAttempted)) return "hakim";
	if (masteryScore >= 50) return "iyi";
	return "gelisiyor";
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
	baslangic: "Başlangıç",
	gelisiyor: "Gelişiyor",
	iyi: "İyi",
	hakim: "Hakim",
};
