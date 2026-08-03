import type { Route } from "next";

/**
 * İçerikten türeyen rotalar.
 *
 * `typedRoutes` açık olduğu için Next.js, statik olarak doğrulayamadığı şablon
 * dizesi bağlantılarını reddeder. Uygulamanın neredeyse tüm bağlantıları ders
 * ve konu kimliklerinden üretildiğinden, dönüştürme (cast) tek yerde toplanır:
 * çağrı yerleri temiz kalır ve URL şeması değişirse burası güncellenir.
 */
export const routes = {
	subject: (subjectId: string) => `/konular/${subjectId}` as Route,
	subjectPrint: (subjectId: string) => `/konular/${subjectId}/yazdir` as Route,
	topic: (subjectId: string, topicSlug: string) =>
		`/konular/${subjectId}/${topicSlug}` as Route,
	topicTest: (subjectId: string, topicSlug: string) =>
		`/testler/${subjectId}/${topicSlug}` as Route,
	topicTestSet: (subjectId: string, topicSlug: string, testSlug: string) =>
		`/testler/${subjectId}/${topicSlug}/${testSlug}` as Route,
} as const;

/**
 * Bir rotanın hiyerarşik üstü.
 *
 * Geri tuşunun YEDEK yoludur: uygulama içi geçmiş yoksa (derin bağlantı, soğuk
 * açılış) `router.back()` ölü kalır ve bunun yerine buraya düşülür. Geçmiş
 * varsa bu fonksiyon hiç çağrılmaz — Ayarlar'ın hiyerarşik üstü, kullanıcının
 * geldiği test sayfası DEĞİLDİR ve o senaryoyu ancak geçmiş çözer.
 *
 * Saf ve React'ten bağımsızdır; testi `tests/unit/routes.test.ts` içindedir.
 */
export function parentRoute(pathname: string): Route {
	const segments = pathname.split("/").filter(Boolean);
	const [section, subjectId, topicSlug] = segments;

	if (section === "konular" && subjectId) {
		// /konular/<ders>/<konu> ve /konular/<ders>/yazdir → /konular/<ders>
		return segments.length >= 3
			? routes.subject(subjectId)
			: ("/konular" as Route);
	}

	if (section === "testler" && subjectId) {
		// /testler/<ders>/<konu>/<test> → /testler/<ders>/<konu>
		if (segments.length >= 4 && topicSlug) {
			return routes.topicTest(subjectId, topicSlug);
		}
		// Ara bir /testler/<ders> rotası YOKTUR; konu listesinin üstü doğrudan
		// /testler'dir. Bu yüzden burada iki segment birden düşer.
		return "/testler" as Route;
	}

	// İstatistik, İlerleme sayfasının detayıdır.
	if (section === "istatistik") return "/ilerleme" as Route;

	return "/" as Route;
}
