/**
 * Çalışma serisi (streak) — saf fonksiyon.
 *
 * Ürün kararı: seri, BUGÜN çalışılmamış olsa bile dün çalışıldıysa devam eder.
 * Sabah uygulamayı açan kullanıcıya "serin bozuldu" demek, gerçekte
 * bozulmamışken cezalandırıcı ve yanlıştır. Seri ancak bir gün tamamen
 * atlandığında kopar.
 */

/** "2026-07-21" biçiminde yerel gün anahtarı. */
export function dayKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function shiftDays(key: string, delta: number): string {
	const [year, month, day] = key.split("-").map(Number);
	const date = new Date(year, month - 1, day + delta);
	return dayKey(date);
}

/**
 * @param activeDays Çalışma yapılan günlerin anahtarları (sıralı olmak zorunda değil).
 * @param today Bugünün anahtarı.
 * @returns Kesintisiz gün sayısı.
 */
export function computeStreak(
	activeDays: readonly string[],
	today: string,
): number {
	const active = new Set(activeDays);

	// Bugün çalışılmadıysa seriyi dünden başlat; bugün henüz bitmedi.
	let cursor = active.has(today) ? today : shiftDays(today, -1);
	if (!active.has(cursor)) return 0;

	let streak = 0;
	while (active.has(cursor)) {
		streak += 1;
		cursor = shiftDays(cursor, -1);
	}
	return streak;
}
