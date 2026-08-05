import { describe, expect, it } from "vitest";
import {
	type Entitlement,
	FREE_SUBJECT_ID,
	FREE_TEST_SLUG,
	FREE_TOPIC_SLUG,
	OPEN_ENTITLEMENT,
	isExamUnlocked,
	isQuestionSearchUnlocked,
	isSubjectPrintUnlocked,
	isTestSetUnlocked,
	isTopicSnippetUnlocked,
	isTopicUnlocked,
} from "@/lib/billing/entitlement";

/**
 * Kilit kararlarının tamamı burada sabitlenir.
 *
 * Üç hâl var ve üçü de her kural için ayrı ayrı doğrulanır:
 *   - `paywallActive: false` → tarayıcı. HİÇBİR kilit uygulanmaz.
 *   - `fullAccess: true`     → satın alınmış. Her şey açık.
 *   - kısıtlı                → yalnızca ücretsiz ön gösterim açık.
 */

const WEB: Entitlement = { paywallActive: false, fullAccess: false };
const PAID: Entitlement = { paywallActive: true, fullAccess: true };
const FREE: Entitlement = { paywallActive: true, fullAccess: false };

/** Kilitlenebilir her yüzeyin tek argümanlı sorgusu. */
const SURFACES: [string, (e: Entitlement) => boolean][] = [
	["konu özeti", (e) => isTopicUnlocked("anayasa", "yasama", e)],
	["test seti", (e) => isTestSetUnlocked("anayasa", "yasama", "test-2", e)],
	["ders yazdırma", isSubjectPrintUnlocked],
	["deneme sınavı", isExamUnlocked],
	["arama soru sonuçları", isQuestionSearchUnlocked],
];

describe("kilit yok sayılan hâller", () => {
	it.each(SURFACES)("tarayıcıda %s açıktır", (_ad, sorgu) => {
		expect(sorgu(WEB)).toBe(true);
	});

	it.each(SURFACES)("tam erişimde %s açıktır", (_ad, sorgu) => {
		expect(sorgu(PAID)).toBe(true);
	});

	/**
	 * Web sözleşmesi tek bir yüzeyle sınırlı değil: GitHub Pages sürümünde
	 * hiçbir kilit görünmemeli. `OPEN_ENTITLEMENT` ön üretimde ve
	 * `OpenBillingProvider` seçildiğinde kullanılan değerdir.
	 */
	it("OPEN_ENTITLEMENT paywall'ı tamamen kapatır", () => {
		expect(OPEN_ENTITLEMENT.paywallActive).toBe(false);
		for (const [, sorgu] of SURFACES) {
			expect(sorgu(OPEN_ENTITLEMENT)).toBe(true);
		}
	});
});

describe("ücretsiz ön gösterim", () => {
	it("ücretsiz konunun özeti açıktır", () => {
		expect(isTopicUnlocked(FREE_SUBJECT_ID, FREE_TOPIC_SLUG, FREE)).toBe(true);
	});

	it("ücretsiz konunun ilk testi açıktır", () => {
		expect(
			isTestSetUnlocked(FREE_SUBJECT_ID, FREE_TOPIC_SLUG, FREE_TEST_SLUG, FREE),
		).toBe(true);
	});

	it("ücretsiz konunun sonraki testleri kilitlidir", () => {
		expect(
			isTestSetUnlocked(FREE_SUBJECT_ID, FREE_TOPIC_SLUG, "test-2", FREE),
		).toBe(false);
		expect(
			isTestSetUnlocked(FREE_SUBJECT_ID, FREE_TOPIC_SLUG, "test-5", FREE),
		).toBe(false);
	});

	/**
	 * Ücretsiz derste bile kapalı: yazdırma sayfası dersin TÜM konu özetlerini
	 * tek belgede basar, yani kilitli olanları da içerir.
	 */
	it("ücretsiz dersin yazdırma sayfası da kilitlidir", () => {
		expect(isSubjectPrintUnlocked(FREE)).toBe(false);
	});

	it("deneme sınavı ve arama soru sonuçları kilitlidir", () => {
		expect(isExamUnlocked(FREE)).toBe(false);
		expect(isQuestionSearchUnlocked(FREE)).toBe(false);
	});
});

describe("kilitli yakın-kaçırmalar", () => {
	/**
	 * Ders ve konu AYRI AYRI eşleşmek zorunda. Bir zamanlar bunlar tek bir
	 * dizede birleştirilse ya da yalnızca konu slug'ına bakılsa, aşağıdaki
	 * çiftlerin bir kısmı sessizce açılırdı.
	 */
	it.each([
		["başka derste aynı konu slug'ı", "anayasa", FREE_TOPIC_SLUG],
		["aynı derste başka konu", FREE_SUBJECT_ID, "disiplin-cezalari"],
		["ikisi de farklı", "etik", "etik-davranis-ilkeleri"],
	])("%s kilitlidir", (_ad, subjectId, topicSlug) => {
		expect(isTopicUnlocked(subjectId, topicSlug, FREE)).toBe(false);
		expect(isTestSetUnlocked(subjectId, topicSlug, FREE_TEST_SLUG, FREE)).toBe(
			false,
		);
	});

	/**
	 * GERÇEK çakışma riski: `resmi-yazisma` dersinin ilk konusu
	 * "genel-hukumler-ve-tanimlar". Ücretsiz konu slug'ı bunun ÖN EKİDİR —
	 * `startsWith` ile yazılmış bir karşılaştırma bu konuyu bedavaya açardı.
	 */
	it("ücretsiz slug'ın ön eki olduğu gerçek konu kilitlidir", () => {
		expect(
			isTopicUnlocked("resmi-yazisma", "genel-hukumler-ve-tanimlar", FREE),
		).toBe(false);
		expect(
			isTestSetUnlocked(
				"resmi-yazisma",
				"genel-hukumler-ve-tanimlar",
				FREE_TEST_SLUG,
				FREE,
			),
		).toBe(false);
	});

	/** Test slug'ı da birebir eşleşir; biçim varyantları kabul edilmez. */
	it.each(["", "test-01", "TEST-1", "test-1 ", "test-10", "1"])(
		"“%s” geçerli bir ücretsiz test slug'ı değildir",
		(testSlug) => {
			expect(
				isTestSetUnlocked(FREE_SUBJECT_ID, FREE_TOPIC_SLUG, testSlug, FREE),
			).toBe(false);
		},
	);

	it("boş ders veya konu kimliği açmaz", () => {
		expect(isTopicUnlocked("", "", FREE)).toBe(false);
		expect(isTestSetUnlocked("", "", "", FREE)).toBe(false);
	});
});

describe("arama parçacığı", () => {
	/**
	 * Parçacık `keyPoints` + özet başlıklarından üretilir, yani kilitli özetin
	 * içeriğidir. Bu yüzden konu özetiyle AYNI kapıdan geçer; ikisinin
	 * ayrışması sessiz bir sızıntı olurdu.
	 */
	it("özetle aynı kararı verir", () => {
		expect(isTopicSnippetUnlocked(FREE_SUBJECT_ID, FREE_TOPIC_SLUG, FREE)).toBe(
			true,
		);
		expect(isTopicSnippetUnlocked("anayasa", "yasama", FREE)).toBe(false);
		expect(isTopicSnippetUnlocked("anayasa", "yasama", WEB)).toBe(true);
	});
});
