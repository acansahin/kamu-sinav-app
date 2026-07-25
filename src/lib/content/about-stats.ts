import type {
	CompiledSubject,
	Question,
	QuestionSource,
	SummaryDoc,
} from "@/types/content";

/**
 * "Hakkında" sayfasının şeffaflık tablolarını üretir.
 *
 * Saf ve dosya sistemi görmez: veriyi çağıran (`contentRepository`) okur,
 * burası yalnızca özetler. `lib/` kuralı gereği React de import etmez, bu
 * yüzden sayımlar ağ ve disk olmadan tam olarak sınanabilir.
 *
 * Sayılan şey ÜRÜNÜN TEZİDİR (PROJECT_PLAN.md §4): her sorunun mevzuat
 * dayanağı ve kaynağı, her özetin doğrulanma tarihi vardır. Bu sayfa o
 * iddiayı kullanıcının denetleyebileceği rakamlara çevirir.
 */

export interface SubjectTrust {
	subjectId: string;
	name: string;
	topics: number;
	/** Özeti yazılmış konu sayısı. */
	summaries: number;
	questions: number;
	/**
	 * Dersteki EN ESKİ doğrulama tarihi.
	 *
	 * Bilinçli olarak en eskisi: güven en zayıf halkadan okunur. Ortalama ya da
	 * en yeni tarih, bir konunun aylardır doğrulanmadığını gizlerdi.
	 */
	oldestVerifiedAt: string | null;
	/** Derste geçen mevzuat sürümleri, tekilleştirilmiş ve sıralı. */
	legislationVersions: string[];
}

/** Ders başına kapsam ve güncellik tablosu. */
export function summarizeSubjectTrust(
	subjects: readonly CompiledSubject[],
	summaries: readonly SummaryDoc[],
): SubjectTrust[] {
	return subjects.map((subject) => {
		const own = summaries.filter((s) => s.subjectId === subject.id);
		const verifiedDates = own.map((s) => s.lastVerifiedAt).sort();

		return {
			subjectId: subject.id,
			name: subject.name,
			topics: subject.topics.length,
			summaries: own.length,
			questions: subject.topics.reduce((sum, t) => sum + t.questionCount, 0),
			// ISO tarihler sözlüksel sıralamada kronolojiktir; ilki en eskisidir.
			oldestVerifiedAt: verifiedDates[0] ?? null,
			legislationVersions: [
				...new Set(own.map((s) => s.legislationVersion)),
			].sort(),
		};
	});
}

/** Bir alana göre sayım; sonuç çoktan aza sıralı. */
function tally<T extends string>(values: readonly T[]): { key: T; count: number }[] {
	const counts = new Map<T, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

	return [...counts.entries()]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count);
}

export type SourceKind = QuestionSource["kind"];
export type License = QuestionSource["license"];

/** Soru havuzunun köken dağılımı — "bu sorular nereden geldi?" */
export function countBySourceKind(
	questions: readonly Question[],
): { key: SourceKind; count: number }[] {
	return tally(questions.map((q) => q.source.kind));
}

/** Soru havuzunun lisans dağılımı — telif iddiasının denetlenebilir hâli. */
export function countByLicense(
	questions: readonly Question[],
): { key: License; count: number }[] {
	return tally(questions.map((q) => q.source.license));
}

/**
 * Mevzuat dayanağı olan soru oranı.
 *
 * Şema `legalRef`i zaten zorunlu kılar, yani sağlıklı bir havuzda bu sayı
 * soru sayısına eşittir. Yine de sayılır: iddia "her soruda dayanak var" ise
 * kullanıcı onu bir rakam olarak görebilmelidir.
 */
export function countWithLegalRef(questions: readonly Question[]): number {
	return questions.filter((q) => q.legalRef.law.length > 0).length;
}

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
	"official-past-exam": "Kurumların yayımladığı çıkmış sınav soruları",
	compiled: "Mevzuat metninden derlenen sorular",
	original: "Özgün olarak yazılan sorular",
	"ai-draft": "Yapay zekâ taslağı (insan onayından geçmeden yayımlanmaz)",
};

export const LICENSE_LABELS: Record<License, string> = {
	"public-official": "Kamu kurumunun kendi sitesinde yayımladığı açık kaynak",
	"own-work": "Bu projeye ait özgün çalışma",
	unknown: "Kaynağı doğrulanmamış (yayımlanamaz)",
};
