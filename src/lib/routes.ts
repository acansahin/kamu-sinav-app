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
