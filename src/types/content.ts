import { z } from "zod";

/**
 * İçerik şemaları. Tek gerçek kaynak burasıdır: TypeScript tipleri bu
 * şemalardan türetilir ve `scripts/build-content.ts` derleme sırasında
 * `content/**` altındaki her dosyayı bunlara karşı doğrular.
 *
 * Doğrulama başarısızsa build kırılır — hatalı içerik üretime çıkamaz.
 * Bkz. PROJECT_PLAN.md §9 ve §14.
 */

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}/, "ISO tarih bekleniyor (YYYY-AA-GG)");

export const scopeSchema = z.enum(["ortak", "alan"]);
export const difficultySchema = z.enum(["kolay", "orta", "zor", "uzman"]);
export const contentStatusSchema = z.enum(["draft", "review", "published"]);
export const examKindSchema = z.enum(["gorevde-yukselme", "unvan-degisikligi"]);

/** Mevzuat dayanağı. Sorularda ZORUNLU — farklılaşma tezimizin taşıyıcısı. */
export const legalRefSchema = z.object({
	/** Okunabilir ad: "657 sayılı Devlet Memurları Kanunu" */
	law: z.string().min(3),
	/** Kısa kimlik: "657", "2709", "5176" */
	lawId: z.string().min(1).optional(),
	/** Madde numarası: "125" */
	article: z.string().min(1).optional(),
	/** Fıkra/bent: "A/a" */
	clause: z.string().min(1).optional(),
	url: z.string().url().optional(),
});

/**
 * Kaynak izlenebilirliği. Telif denetimini derleme zamanına taşır.
 * `license: "unknown"` olan bir soru asla `published` olamaz — bkz. build-content.ts.
 */
export const questionSourceSchema = z.object({
	kind: z.enum(["official-past-exam", "compiled", "original", "ai-draft"]),
	/** "MEB GYS 2023 Şube Müdürlüğü" gibi somut köken */
	origin: z.string().min(3),
	year: z.number().int().min(1990).max(2100).optional(),
	url: z.string().url().optional(),
	license: z.enum(["public-official", "own-work", "unknown"]),
});

export const questionSchema = z.object({
	id: z.string().min(3),
	subjectId: z.string().min(1),
	topicId: z.string().min(1),
	scope: scopeSchema.default("ortak"),
	difficulty: difficultySchema,
	stem: z.string().min(10),
	/**
	 * 4 VEYA 5 şık. Resmî çıkmış sınavlar karışık gelir: Sayıştay 4 şıklı,
	 * MEB/ÖSYM 5 şıklıdır. İkisini de tahrif etmeden içeri alabilmek için şık
	 * sayısı sabit değildir.
	 */
	options: z.array(z.string().min(1)).min(4).max(5),
	// Union literal (0–4), z.number() değil: çıkarımı `0|1|2|3|4` olarak tutar ve
	// `AnswerIndex` ile birebir uyumludur (aksi hâlde `number` çıkar, atanamaz).
	correctIndex: z.union([
		z.literal(0),
		z.literal(1),
		z.literal(2),
		z.literal(3),
		z.literal(4),
	]),
	/** Neden doğru olduğunu anlatan açıklama — ZORUNLU */
	explanation: z.string().min(20),
	legalRef: legalRefSchema,
	source: questionSourceSchema,
	status: contentStatusSchema.default("draft"),
	tags: z.array(z.string()).default([]),
	version: z.number().int().min(1).default(1),
	updatedAt: isoDate,
}).refine((q) => q.correctIndex < q.options.length, {
	// Doğru cevap indeksi şık sayısını aşamaz: 4 şıklı bir soruda correctIndex 4
	// (5. şık) sessiz bir hatadır; şema düzeyinde yakalanır.
	message: "correctIndex şık sayısından küçük olmalıdır",
	path: ["correctIndex"],
});

export const topicSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1),
	name: z.string().min(2),
	order: z.number().int().min(0),
	estimatedMinutes: z.number().int().min(1).max(120),
});

export const subjectSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(2),
	shortName: z.string().min(2),
	description: z.string().min(10),
	scope: scopeSchema.default("ortak"),
	order: z.number().int().min(0),
	/** lucide-react ikon adı */
	icon: z.string().min(2),
	topics: z.array(topicSchema).min(1),
});

/** Konu özetinin MDX dosyasındaki frontmatter'ı. */
export const summaryFrontmatterSchema = z.object({
	topicId: z.string().min(1),
	title: z.string().min(2),
	/** "Bir bakışta" kutusundaki maddeler */
	keyPoints: z.array(z.string().min(5)).min(2),
	/** İçeriğin dayandığı mevzuatın hangi tarihli hâli olduğu */
	legislationVersion: z.string().min(4),
	/** İçeriğin en son ne zaman doğrulandığı — güven rozetinde gösterilir */
	lastVerifiedAt: isoDate,
	legalRefs: z.array(legalRefSchema).default([]),
});

export const mockExamTemplateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(2),
	examKind: examKindSchema,
	questionCount: z.union([
		z.literal(20),
		z.literal(50),
		z.literal(80),
		z.literal(100),
	]),
	durationSeconds: z.number().int().min(60),
	passingScore: z.number().min(0).max(100).default(60),
	/** Yanlış doğruyu götürmez — mevzuat gereği sabit */
	negativeMarking: z.literal(false).default(false),
	distribution: z
		.array(
			z.object({
				subjectId: z.string().min(1),
				count: z.number().int().min(1),
			}),
		)
		.min(1),
});

// --- Derlenmiş (runtime) biçimler -------------------------------------------

/** Konu, derleme sırasında hesaplanan sayaçlarla zenginleştirilir. */
export const compiledTopicSchema = topicSchema.extend({
	subjectId: z.string(),
	questionCount: z.number().int().min(0),
	countsByDifficulty: z.record(difficultySchema, z.number().int()),
	hasSummary: z.boolean(),
});

export const compiledSubjectSchema = subjectSchema
	.omit({ topics: true })
	.extend({
		topics: z.array(compiledTopicSchema),
		questionCount: z.number().int().min(0),
	});

export const summaryDocSchema = summaryFrontmatterSchema.extend({
	subjectId: z.string(),
	/** Ham MDX gövdesi — sunucu bileşeninde derlenir */
	body: z.string().min(1),
	readingMinutes: z.number().int().min(1),
});

export const contentManifestSchema = z.object({
	generatedAt: z.string(),
	subjects: z.array(compiledSubjectSchema),
	examTemplates: z.array(mockExamTemplateSchema),
	totals: z.object({
		subjects: z.number().int(),
		topics: z.number().int(),
		publishedQuestions: z.number().int(),
	}),
});

// --- Türetilmiş tipler ------------------------------------------------------

export type Scope = z.infer<typeof scopeSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type ContentStatus = z.infer<typeof contentStatusSchema>;
export type ExamKind = z.infer<typeof examKindSchema>;
export type LegalRef = z.infer<typeof legalRefSchema>;
export type QuestionSource = z.infer<typeof questionSourceSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type SummaryFrontmatter = z.infer<typeof summaryFrontmatterSchema>;
export type MockExamTemplate = z.infer<typeof mockExamTemplateSchema>;
export type CompiledTopic = z.infer<typeof compiledTopicSchema>;
export type CompiledSubject = z.infer<typeof compiledSubjectSchema>;
export type SummaryDoc = z.infer<typeof summaryDocSchema>;
export type ContentManifest = z.infer<typeof contentManifestSchema>;

export const DIFFICULTY_ORDER: readonly Difficulty[] = [
	"kolay",
	"orta",
	"zor",
	"uzman",
] as const;

export const DIFFICULTY_LABELS: Record<
	Difficulty,
	{ label: string; description: string }
> = {
	kolay: { label: "Kolay", description: "Temel bilgi soruları" },
	orta: { label: "Orta", description: "Kavrama soruları" },
	zor: { label: "Zor", description: "Yorum ve uygulama soruları" },
	uzman: { label: "Uzman", description: "Gerçek sınav seviyesinde sorular" },
};
