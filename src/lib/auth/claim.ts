import type { ExportBundle } from "@/types/progress";

/**
 * Bir yedeğin tüm satırlarını verilen kimlikle damgalar.
 *
 * Faz 3'ün "veri kaybı olmadan yükseltme" sözü (PROJECT_PLAN.md §8) buraya
 * dayanır: kullanıcı hesap açtığında cihazdaki anonim ilerleme silinmez,
 * gerçek `userId` ile damgalanıp hesabın parçası olur.
 *
 * Bilinçli olarak SAF ve Dexie'den bağımsızdır. Faz 3'ün veri kaybı riski en
 * yüksek adımı budur; transaction kurmadan, hızlı ve tam kapsamlı test
 * edilebilmesi gerekiyor. Transaction'ı `progressRepository.reassignOwner`
 * kurar ve bu fonksiyonu içinde çağırır.
 *
 * Kapsam güvencesi derleyicidedir: `ExportBundle`'a yeni bir tablo eklenirse
 * aşağıdaki nesne eksik alan hatası verir ve damgalanması unutulamaz.
 */
export function restampBundle(
	bundle: ExportBundle,
	userId: string,
): ExportBundle {
	const stamp = <T extends { userId: string }>(rows: readonly T[]): T[] =>
		rows.map((row) => ({ ...row, userId }));

	return {
		version: bundle.version,
		exportedAt: bundle.exportedAt,
		attempts: stamp(bundle.attempts),
		topicProgress: stamp(bundle.topicProgress),
		testSessions: stamp(bundle.testSessions),
		examSessions: stamp(bundle.examSessions),
		dailyStats: stamp(bundle.dailyStats),
		bookmarks: stamp(bundle.bookmarks),
		reviewSchedule: stamp(bundle.reviewSchedule),
		reports: stamp(bundle.reports),
		settings: bundle.settings ? { ...bundle.settings, userId } : null,
	};
}
