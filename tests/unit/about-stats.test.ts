import { describe, expect, it } from "vitest";
import {
	countByLicense,
	countBySourceKind,
	countWithLegalRef,
	summarizeSubjectTrust,
} from "@/lib/content/about-stats";
import type {
	CompiledSubject,
	CompiledTopic,
	Question,
	SummaryDoc,
} from "@/types/content";

/**
 * "Hakkında" sayfasının sayıları.
 *
 * Bu sayfa ürünün güven iddiasını denetlenebilir kılıyor; yanlış bir sayı
 * iddianın kendisini çürütür. Sayımlar saf olduğu için diske ve ağa çıkmadan
 * tam olarak sınanabilir.
 */

function topic(slug: string, questionCount: number, hasSummary = true): CompiledTopic {
	return {
		id: `ders-1/${slug}`,
		slug,
		name: slug,
		order: 1,
		estimatedMinutes: 10,
		subjectId: "ders-1",
		questionCount,
		countsByDifficulty: { kolay: 0, orta: questionCount, zor: 0, uzman: 0 },
		hasSummary,
	};
}

function subject(id: string, topics: CompiledTopic[]): CompiledSubject {
	return {
		id,
		name: `Ders ${id}`,
		shortName: id,
		description: "Deneme dersi açıklaması",
		scope: "ortak",
		order: 1,
		icon: "Scale",
		topics: topics.map((t) => ({ ...t, subjectId: id })),
		questionCount: topics.reduce((sum, t) => sum + t.questionCount, 0),
	};
}

function summary(
	subjectId: string,
	slug: string,
	lastVerifiedAt: string,
	legislationVersion = "2026-01-01 tarihli hâli",
): SummaryDoc {
	return {
		topicId: `${subjectId}/${slug}`,
		subjectId,
		title: slug,
		keyPoints: ["Birinci madde metni", "İkinci madde metni"],
		legislationVersion,
		lastVerifiedAt,
		legalRefs: [],
		body: "gövde",
		readingMinutes: 5,
	};
}

function question(
	id: string,
	kind: Question["source"]["kind"],
	license: Question["source"]["license"],
): Question {
	return {
		id,
		subjectId: "ders-1",
		topicId: "ders-1/konu-1",
		scope: "ortak",
		difficulty: "orta",
		stem: "Bir soru metni buraya gelir",
		options: ["A", "B", "C", "D"],
		correctIndex: 0,
		explanation: "Yeterince uzun bir açıklama metni buraya yazılır.",
		legalRef: { law: "657", article: "125" },
		source: { kind, origin: "Kaynak bilgisi", license },
		status: "published",
		tags: [],
		version: 1,
		updatedAt: "2026-07-01",
	};
}

describe("summarizeSubjectTrust", () => {
	it("ders başına konu, özet ve soru sayısını toplar", () => {
		const subjects = [subject("ders-1", [topic("a", 12), topic("b", 8)])];
		const summaries = [
			summary("ders-1", "a", "2026-06-01"),
			summary("ders-1", "b", "2026-07-01"),
		];

		const [row] = summarizeSubjectTrust(subjects, summaries);
		expect(row?.topics).toBe(2);
		expect(row?.summaries).toBe(2);
		expect(row?.questions).toBe(20);
	});

	it("doğrulama tarihi olarak EN ESKİ olanı seçer", () => {
		// Güven en zayıf halkadan okunur: en yeni tarih, aylardır doğrulanmamış
		// bir konuyu gizlerdi.
		const subjects = [subject("ders-1", [topic("a", 1), topic("b", 1)])];
		const summaries = [
			summary("ders-1", "a", "2026-07-20"),
			summary("ders-1", "b", "2026-03-05"),
		];

		expect(summarizeSubjectTrust(subjects, summaries)[0]?.oldestVerifiedAt).toBe(
			"2026-03-05",
		);
	});

	it("özeti olmayan derste doğrulama tarihi null döner", () => {
		const subjects = [subject("ders-1", [topic("a", 4, false)])];
		const [row] = summarizeSubjectTrust(subjects, []);

		expect(row?.summaries).toBe(0);
		expect(row?.oldestVerifiedAt).toBeNull();
	});

	it("mevzuat sürümlerini tekilleştirir", () => {
		const subjects = [subject("ders-1", [topic("a", 1), topic("b", 1)])];
		const summaries = [
			summary("ders-1", "a", "2026-06-01", "2026 hâli"),
			summary("ders-1", "b", "2026-07-01", "2026 hâli"),
		];

		expect(summarizeSubjectTrust(subjects, summaries)[0]?.legislationVersions).toEqual(
			["2026 hâli"],
		);
	});

	it("başka derse ait özetleri saymaz", () => {
		const subjects = [subject("ders-1", [topic("a", 1)])];
		const summaries = [
			summary("ders-1", "a", "2026-06-01"),
			summary("ders-2", "x", "2026-01-01"),
		];

		const [row] = summarizeSubjectTrust(subjects, summaries);
		expect(row?.summaries).toBe(1);
		expect(row?.oldestVerifiedAt).toBe("2026-06-01");
	});
});

describe("kaynak ve lisans sayımı", () => {
	const questions = [
		question("q1", "official-past-exam", "public-official"),
		question("q2", "official-past-exam", "public-official"),
		question("q3", "compiled", "own-work"),
	];

	it("kökenleri çoktan aza sıralar", () => {
		expect(countBySourceKind(questions)).toEqual([
			{ key: "official-past-exam", count: 2 },
			{ key: "compiled", count: 1 },
		]);
	});

	it("lisansları sayar", () => {
		expect(countByLicense(questions)).toEqual([
			{ key: "public-official", count: 2 },
			{ key: "own-work", count: 1 },
		]);
	});

	it("boş havuzda boş dizi döner", () => {
		expect(countBySourceKind([])).toEqual([]);
		expect(countByLicense([])).toEqual([]);
	});

	it("mevzuat dayanağı olan soruları sayar", () => {
		expect(countWithLegalRef(questions)).toBe(3);
	});
});
