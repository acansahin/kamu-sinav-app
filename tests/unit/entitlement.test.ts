import { describe, expect, it } from "vitest";
import {
	type Entitlement,
	FREE_TEST_SLUG,
	FREE_TOPIC_BY_SUBJECT,
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

/**
 * Ücretsiz çiftler haritadan türetilir, elle tekrarlanmaz.
 *
 * Elle yazılsaydı ders eklenince buraya satır eklemek unutulur ve yeni dersin
 * ücretsiz konusu hiç sınanmazdı. Haritanın içeriğinin İÇERİKLE tuttuğunu
 * `content-integrity` doğrular; burada yalnızca kilit mantığı sınanır.
 */
const FREE_PAIRS: [string, string][] = [...FREE_TOPIC_BY_SUBJECT];

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
	it("her dersin bir ücretsiz konusu tanımlıdır", () => {
		// Harita boşalırsa aşağıdaki it.each'ler HİÇ çalışmaz ve testler yeşil
		// kalırken paywall her şeyi kilitler.
		expect(FREE_PAIRS.length).toBeGreaterThan(0);
	});

	it.each(FREE_PAIRS)("“%s/%s” konusunun özeti açıktır", (subject, topic) => {
		expect(isTopicUnlocked(subject, topic, FREE)).toBe(true);
	});

	it.each(FREE_PAIRS)("“%s/%s” konusunun ilk testi açıktır", (subject, topic) => {
		expect(isTestSetUnlocked(subject, topic, FREE_TEST_SLUG, FREE)).toBe(true);
	});

	it.each(FREE_PAIRS)(
		"“%s/%s” konusunun sonraki testleri kilitlidir",
		(subject, topic) => {
			expect(isTestSetUnlocked(subject, topic, "test-2", FREE)).toBe(false);
			expect(isTestSetUnlocked(subject, topic, "test-5", FREE)).toBe(false);
		},
	);

	/**
	 * Her derste kapalı: yazdırma sayfası dersin TÜM konu özetlerini tek belgede
	 * basar, yani ücretsiz ilk konunun yanında kilitli olanları da içerir.
	 */
	it("dersin yazdırma sayfası her derste kilitlidir", () => {
		expect(isSubjectPrintUnlocked(FREE)).toBe(false);
	});

	it("deneme sınavı ve arama soru sonuçları kilitlidir", () => {
		expect(isExamUnlocked(FREE)).toBe(false);
		expect(isQuestionSearchUnlocked(FREE)).toBe(false);
	});
});

describe("kilitli yakın-kaçırmalar", () => {
	/**
	 * Ders ve konu AYRI AYRI eşleşmek zorunda. Ücretsiz konu artık ders başına
	 * tanımlı olduğu için asıl risk ÇAPRAZ eşleşmedir: bir dersin ücretsiz
	 * slug'ı başka bir derste de geçerli sayılırsa kapı sessizce genişler.
	 */
	it.each([
		["başka dersin ücretsiz konusu", "anayasa", "genel-hukumler"],
		["başka dersin ücretsiz konusu (ters yön)", "657-dmk", "genel-esaslar"],
		["aynı derste başka konu", "657-dmk", "disiplin-cezalari"],
		["ikisi de farklı", "etik", "etik-davranis-ilkeleri"],
	])("%s kilitlidir", (_ad, subjectId, topicSlug) => {
		expect(isTopicUnlocked(subjectId, topicSlug, FREE)).toBe(false);
		expect(isTestSetUnlocked(subjectId, topicSlug, FREE_TEST_SLUG, FREE)).toBe(
			false,
		);
	});

	/**
	 * Ön ek tuzağı: `657-dmk` dersinin ücretsiz konusu "genel-hukumler" ve bu,
	 * `resmi-yazisma` dersinin ücretsiz konusu olan "genel-hukumler-ve-tanimlar"
	 * ifadesinin ÖN EKİDİR. `startsWith` ile yazılmış bir karşılaştırma
	 * 657 dersindeki her "genel-hukumler…" konusunu bedavaya açardı.
	 *
	 * Karşılaştırmanın birebir kaldığını pinliyoruz; iki slug gerçek içerikten
	 * geldiği için bu ilişki uydurma değildir.
	 */
	it.each([
		["657-dmk", "genel-hukumler-ve-tanimlar"],
		["resmi-yazisma", "genel-hukumler"],
	])("“%s/%s” ön ek yakınlığına rağmen kilitlidir", (subjectId, topicSlug) => {
		expect(isTopicUnlocked(subjectId, topicSlug, FREE)).toBe(false);
		expect(isTestSetUnlocked(subjectId, topicSlug, FREE_TEST_SLUG, FREE)).toBe(
			false,
		);
	});

	/** Test slug'ı da birebir eşleşir; biçim varyantları kabul edilmez. */
	it.each(["", "test-01", "TEST-1", "test-1 ", "test-10", "1"])(
		"“%s” geçerli bir ücretsiz test slug'ı değildir",
		(testSlug) => {
			const [subjectId, topicSlug] = FREE_PAIRS[0];
			expect(isTestSetUnlocked(subjectId, topicSlug, testSlug, FREE)).toBe(
				false,
			);
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
		for (const [subjectId, topicSlug] of FREE_PAIRS) {
			expect(isTopicSnippetUnlocked(subjectId, topicSlug, FREE)).toBe(true);
		}
		expect(isTopicSnippetUnlocked("anayasa", "yasama", FREE)).toBe(false);
		expect(isTopicSnippetUnlocked("anayasa", "yasama", WEB)).toBe(true);
	});
});
