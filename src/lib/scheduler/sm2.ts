/**
 * Aralıklı tekrar zamanlayıcısı — saf fonksiyonlar.
 *
 * SM-2 algoritması, `IScheduler` arayüzünün arkasında tutulur. Amaç, ileride
 * FSRS'e geçerken çağıran hiçbir kodun değişmemesidir; PROJECT_PLAN.md §16
 * Faz 2 bunu öngörür.
 *
 * Ürün kararı: kullanıcıya "bu soruyu ne kadar iyi hatırladın" diye
 * SORULMAZ. Sınava hazırlanan kullanıcı kendini derecelendirmek istemez ve
 * her soruda ek bir tıklama akışı yavaşlatır. Not, cevabın doğruluğundan ve
 * harcanan süreden otomatik türetilir.
 */

/** SM-2'nin 0-5 arası kalite notu. */
export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface SchedulerState {
	/** SM-2 kolaylık katsayısı. Başlangıç 2.5, alt sınır 1.3. */
	easeFactor: number;
	/** Bir sonraki tekrara kaç gün kaldığı. */
	intervalDays: number;
	/** Üst üste doğru cevap sayısı; yanlışta sıfırlanır. */
	repetitions: number;
	/** Kaç kez unutulduğu — zorlanılan soruları raporlamak için. */
	lapses: number;
}

export interface IScheduler {
	initial(): SchedulerState;
	next(state: SchedulerState, grade: ReviewGrade): SchedulerState;
}

const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;

/** Bu eşiğin altındaki not "hatırlanamadı" sayılır ve aralığı sıfırlar. */
const PASSING_GRADE = 3;

/** Doğru cevapta hız eşikleri (ms). */
const FAST_MS = 15_000;
const SLOW_MS = 45_000;

/**
 * Cevaptan SM-2 notu türetir.
 *
 * Boş bırakmak, yanlış cevaplamaktan daha düşük not alır: kullanıcı soruyu
 * tanımadığını göstermiştir, yanlış cevapta ise en azından bir kanaat vardır.
 */
export function gradeFromAttempt(
	isCorrect: boolean,
	selectedIndex: number | null,
	durationMs: number,
): ReviewGrade {
	if (selectedIndex === null) return 0;
	if (!isCorrect) return 2;
	if (durationMs <= FAST_MS) return 5;
	if (durationMs <= SLOW_MS) return 4;
	return 3;
}

class Sm2Scheduler implements IScheduler {
	initial(): SchedulerState {
		return {
			easeFactor: INITIAL_EASE,
			intervalDays: 0,
			repetitions: 0,
			lapses: 0,
		};
	}

	next(state: SchedulerState, grade: ReviewGrade): SchedulerState {
		// Kolaylık katsayısı her cevapta güncellenir; düşük not katsayıyı
		// düşürür, böylece zor sorular kalıcı olarak daha sık gelir.
		const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
		const easeFactor = Math.max(MIN_EASE, state.easeFactor + delta);

		if (grade < PASSING_GRADE) {
			return {
				easeFactor,
				intervalDays: 1,
				repetitions: 0,
				lapses: state.lapses + 1,
			};
		}

		const repetitions = state.repetitions + 1;
		const intervalDays =
			repetitions === 1
				? 1
				: repetitions === 2
					? 6
					: Math.round(state.intervalDays * easeFactor);

		return { easeFactor, intervalDays, repetitions, lapses: state.lapses };
	}
}

export const scheduler: IScheduler = new Sm2Scheduler();

/** Aralığı takvim tarihine çevirir. */
export function dueDateFrom(intervalDays: number, from = new Date()): string {
	const due = new Date(from);
	due.setDate(due.getDate() + intervalDays);
	return due.toISOString();
}

/** Bir sonraki tekrarın ne zaman olduğunu insan diliyle anlatır. */
export function describeInterval(intervalDays: number): string {
	if (intervalDays <= 1) return "yarın";
	if (intervalDays < 7) return `${intervalDays} gün sonra`;
	if (intervalDays < 30) return `${Math.round(intervalDays / 7)} hafta sonra`;
	return `${Math.round(intervalDays / 30)} ay sonra`;
}
