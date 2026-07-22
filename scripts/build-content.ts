/**
 * İçerik derleyicisi.
 *
 * `content/**` altındaki insan tarafından yazılan kaynakları okur, Zod şemalarına
 * karşı doğrular, bütünlük ve telif kurallarını uygular ve `public/content/`
 * altına uygulamanın tükettiği doğrulanmış JSON'ları yazar.
 *
 * Bu betik CI kapısıdır: tek bir ihlal bile çıkış kodunu 1 yapar, dolayısıyla
 * hatalı içerik üretime çıkamaz (bkz. PROJECT_PLAN.md §7.3 ve §14).
 *
 * Çalıştırma: npm run content:build
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import {
	type CompiledSubject,
	type CompiledTopic,
	DIFFICULTY_ORDER,
	type Difficulty,
	type MockExamTemplate,
	type Question,
	mockExamTemplateSchema,
	questionSchema,
	subjectSchema,
	summaryFrontmatterSchema,
} from "../src/types/content";
import type { SearchEntry } from "../src/types/search";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "public", "content");

/** Ortalama sessiz okuma hızı (kelime/dakika). */
const READING_WPM = 190;

const errors: string[] = [];
const warnings: string[] = [];

function fail(where: string, message: string): void {
	errors.push(`${where}: ${message}`);
}

function warn(where: string, message: string): void {
	warnings.push(`${where}: ${message}`);
}

/** Zod hatalarını okunabilir tek satırlara indirger. */
function formatIssues(
	issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): string {
	return issues
		.map((issue) => {
			const at = issue.path.map(String).join(".");
			return at ? `${at} → ${issue.message}` : issue.message;
		})
		.join("; ");
}

async function readJson(file: string): Promise<unknown> {
	const raw = await readFile(file, "utf8");
	try {
		return JSON.parse(raw);
	} catch (error) {
		throw new Error(
			`geçersiz JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function listDirs(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function listFiles(dir: string, ext: string): Promise<string[]> {
	if (!existsSync(dir)) return [];
	const entries = await readdir(dir, { withFileTypes: true });
	return entries
		.filter((e) => e.isFile() && e.name.endsWith(ext))
		.map((e) => e.name);
}

/**
 * TELİF KAPISI.
 *
 * Kaynağı doğrulanamayan içerik yayımlanamaz. Bu kural, telif riskini üretimden
 * derleme zamanına çeker — bkz. PROJECT_PLAN.md §14.1.
 */
function checkLicense(question: Question, where: string): void {
	if (question.status === "published" && question.source.license === "unknown") {
		fail(
			where,
			`kaynağı doğrulanmamış soru yayımlanamaz (license: "unknown", status: "published"). ` +
				`Ya kaynağı netleştirin ya da status'ü "draft" yapın.`,
		);
	}
	if (
		question.source.kind === "ai-draft" &&
		question.status === "published"
	) {
		fail(
			where,
			`AI üretimi soru insan onayından geçmeden yayımlanamaz (kind: "ai-draft", status: "published").`,
		);
	}
}

interface SubjectBundle {
	subject: CompiledSubject;
	questionsByTopic: Map<string, Question[]>;
	summariesByTopic: Map<string, { frontmatter: unknown; body: string; readingMinutes: number }>;
}

async function buildSubject(subjectDir: string): Promise<SubjectBundle | null> {
	const dir = path.join(CONTENT_DIR, "subjects", subjectDir);
	const subjectFile = path.join(dir, "subject.json");
	const rel = path.relative(ROOT, subjectFile);

	if (!existsSync(subjectFile)) {
		fail(rel, "subject.json bulunamadı");
		return null;
	}

	const parsed = subjectSchema.safeParse(await readJson(subjectFile));
	if (!parsed.success) {
		fail(rel, formatIssues(parsed.error.issues));
		return null;
	}
	const subject = parsed.data;

	if (subject.id !== subjectDir) {
		fail(rel, `klasör adı "${subjectDir}" ile subject.id "${subject.id}" uyuşmuyor`);
	}

	const topicIds = new Set(subject.topics.map((t) => t.id));

	// --- Sorular -------------------------------------------------------------
	const questionsByTopic = new Map<string, Question[]>();
	const seenIds = new Set<string>();
	const questionsDir = path.join(dir, "questions");

	for (const fileName of await listFiles(questionsDir, ".json")) {
		const file = path.join(questionsDir, fileName);
		const fileRel = path.relative(ROOT, file);
		const data = await readJson(file);

		if (!Array.isArray(data)) {
			fail(fileRel, "soru dosyası bir dizi olmalıdır");
			continue;
		}

		data.forEach((raw, index) => {
			const where = `${fileRel}[${index}]`;
			const result = questionSchema.safeParse(raw);
			if (!result.success) {
				fail(where, formatIssues(result.error.issues));
				return;
			}
			const question = result.data;

			if (seenIds.has(question.id)) {
				fail(where, `yinelenen soru id: ${question.id}`);
				return;
			}
			seenIds.add(question.id);

			if (question.subjectId !== subject.id) {
				fail(where, `subjectId "${question.subjectId}" bu dersin id'si değil`);
				return;
			}
			if (!topicIds.has(question.topicId)) {
				fail(where, `bilinmeyen topicId: ${question.topicId}`);
				return;
			}
			const distinctOptions = new Set(question.options.map((o) => o.trim()));
			if (distinctOptions.size !== 4) {
				fail(where, "dört şık birbirinden farklı olmalıdır");
				return;
			}

			checkLicense(question, where);

			const list = questionsByTopic.get(question.topicId) ?? [];
			list.push(question);
			questionsByTopic.set(question.topicId, list);
		});
	}

	// --- Konu özetleri -------------------------------------------------------
	const summariesByTopic = new Map<
		string,
		{ frontmatter: unknown; body: string; readingMinutes: number }
	>();
	const topicsDir = path.join(dir, "topics");

	for (const fileName of await listFiles(topicsDir, ".mdx")) {
		const file = path.join(topicsDir, fileName);
		const fileRel = path.relative(ROOT, file);
		const { data, content } = matter(await readFile(file, "utf8"));

		const result = summaryFrontmatterSchema.safeParse(data);
		if (!result.success) {
			fail(fileRel, `frontmatter geçersiz — ${formatIssues(result.error.issues)}`);
			continue;
		}
		const frontmatter = result.data;

		if (!topicIds.has(frontmatter.topicId)) {
			fail(fileRel, `bilinmeyen topicId: ${frontmatter.topicId}`);
			continue;
		}
		const expectedSlug = frontmatter.topicId.split("/").pop();
		if (fileName.replace(/\.mdx$/, "") !== expectedSlug) {
			fail(
				fileRel,
				`dosya adı "${expectedSlug}.mdx" olmalı (topicId ile eşleşmeli)`,
			);
			continue;
		}
		if (content.trim().length < 200) {
			fail(fileRel, "özet gövdesi çok kısa (en az 200 karakter)");
			continue;
		}

		const words = content.trim().split(/\s+/).length;
		summariesByTopic.set(frontmatter.topicId, {
			frontmatter: { ...frontmatter, subjectId: subject.id },
			body: content,
			readingMinutes: Math.max(1, Math.round(words / READING_WPM)),
		});
	}

	// --- Derlenmiş konular ---------------------------------------------------
	const topics: CompiledTopic[] = subject.topics
		.slice()
		.sort((a, b) => a.order - b.order)
		.map((topic) => {
			const questions = questionsByTopic.get(topic.id) ?? [];
			const published = questions.filter((q) => q.status === "published");
			const countsByDifficulty = Object.fromEntries(
				DIFFICULTY_ORDER.map((d) => [
					d,
					published.filter((q) => q.difficulty === d).length,
				]),
			) as Record<Difficulty, number>;

			const hasSummary = summariesByTopic.has(topic.id);
			if (!hasSummary && published.length > 0) {
				warn(
					`${subject.id}/${topic.slug}`,
					"soruları var ama konu özeti yok — özetten teste geçiş akışı çalışmaz",
				);
			}
			if (hasSummary && published.length === 0) {
				warn(
					`${subject.id}/${topic.slug}`,
					"konu özeti var ama yayımlanmış sorusu yok — testi boş açılır",
				);
			}
			if (questions.length > 0 && published.length === 0) {
				warn(
					`${subject.id}/${topic.slug}`,
					`${questions.length} soru yazılmış ama hiçbiri "published" değil`,
				);
			}

			return {
				...topic,
				subjectId: subject.id,
				questionCount: published.length,
				countsByDifficulty,
				hasSummary,
			};
		});

	return {
		subject: {
			...subject,
			topics,
			questionCount: topics.reduce((sum, t) => sum + t.questionCount, 0),
		},
		questionsByTopic,
		summariesByTopic,
	};
}

async function main(): Promise<void> {
	const started = Date.now();
	const subjectsRoot = path.join(CONTENT_DIR, "subjects");

	if (!existsSync(subjectsRoot)) {
		console.error(`content/subjects bulunamadı: ${subjectsRoot}`);
		process.exit(1);
	}

	const bundles: SubjectBundle[] = [];
	for (const dirName of (await listDirs(subjectsRoot)).sort()) {
		const bundle = await buildSubject(dirName);
		if (bundle) bundles.push(bundle);
	}
	bundles.sort((a, b) => a.subject.order - b.subject.order);

	// --- Deneme şablonları ---------------------------------------------------
	const templatesFile = path.join(CONTENT_DIR, "exam-templates.json");
	const templates: MockExamTemplate[] = [];
	if (existsSync(templatesFile)) {
		const rel = path.relative(ROOT, templatesFile);
		const raw = await readJson(templatesFile);
		if (!Array.isArray(raw)) {
			fail(rel, "deneme şablonu dosyası bir dizi olmalıdır");
		} else {
			const subjectIds = new Set(bundles.map((b) => b.subject.id));
			raw.forEach((entry, index) => {
				const result = mockExamTemplateSchema.safeParse(entry);
				if (!result.success) {
					fail(`${rel}[${index}]`, formatIssues(result.error.issues));
					return;
				}
				const template = result.data;
				const total = template.distribution.reduce((s, d) => s + d.count, 0);
				if (total !== template.questionCount) {
					fail(
						`${rel}[${index}]`,
						`dağılım toplamı ${total}, questionCount ${template.questionCount} ile uyuşmuyor`,
					);
					return;
				}
				for (const d of template.distribution) {
					if (!subjectIds.has(d.subjectId)) {
						fail(`${rel}[${index}]`, `bilinmeyen subjectId: ${d.subjectId}`);
						return;
					}
					// Havuz yetmiyorsa şablon çözülemez. İçerik doldurulana kadar
					// bu bir uyarıdır; hata yapılırsa MVP boyunca build kırık kalır.
					const available =
						bundles.find((b) => b.subject.id === d.subjectId)?.subject
							.questionCount ?? 0;
					if (available < d.count) {
						warn(
							`${template.id}`,
							`${d.subjectId} dersinden ${d.count} soru istiyor ama havuzda ${available} var — şablon şu an çözülemez`,
						);
					}
				}
				templates.push(template);
			});
		}
	}

	// --- Hata varsa hiçbir şey yazma ----------------------------------------
	if (errors.length > 0) {
		console.error(`\n✖ İçerik doğrulaması başarısız — ${errors.length} hata:\n`);
		for (const error of errors) console.error(`  • ${error}`);
		console.error("");
		process.exit(1);
	}

	// --- Çıktı ---------------------------------------------------------------
	await rm(OUT_DIR, { recursive: true, force: true });
	await mkdir(path.join(OUT_DIR, "questions"), { recursive: true });
	await mkdir(path.join(OUT_DIR, "summaries"), { recursive: true });

	for (const { subject, questionsByTopic, summariesByTopic } of bundles) {
		for (const topic of subject.topics) {
			const published = (questionsByTopic.get(topic.id) ?? []).filter(
				(q) => q.status === "published",
			);
			if (published.length > 0) {
				await mkdir(path.join(OUT_DIR, "questions", subject.id), {
					recursive: true,
				});
				await writeFile(
					path.join(OUT_DIR, "questions", subject.id, `${topic.slug}.json`),
					JSON.stringify(published, null, "\t"),
					"utf8",
				);
			}
			const summary = summariesByTopic.get(topic.id);
			if (summary) {
				await mkdir(path.join(OUT_DIR, "summaries", subject.id), {
					recursive: true,
				});
				await writeFile(
					path.join(OUT_DIR, "summaries", subject.id, `${topic.slug}.json`),
					JSON.stringify(
						{
							...(summary.frontmatter as Record<string, unknown>),
							body: summary.body,
							readingMinutes: summary.readingMinutes,
						},
						null,
						"\t",
					),
					"utf8",
				);
			}
		}
	}

	// --- Arama indeksi -------------------------------------------------------
	//
	// Özetlerin TAM gövdesi indekslenmez: 17 konu × ~8 KB, aramanın değerinden
	// çok sayfa yükünü büyütür. Başlık, "bir bakışta" maddeleri ve bölüm
	// başlıkları arama niyetinin çoğunu karşılar.
	const searchIndex: SearchEntry[] = [];

	for (const { subject, questionsByTopic, summariesByTopic } of bundles) {
		for (const topic of subject.topics) {
			const summary = summariesByTopic.get(topic.id);
			if (summary) {
				const frontmatter = summary.frontmatter as {
					title: string;
					keyPoints: string[];
				};
				const headings = summary.body
					.split("\n")
					.filter((line) => line.startsWith("##"))
					.map((line) => line.replace(/^#+\s*/, ""));

				searchIndex.push({
					kind: "topic",
					id: topic.id,
					title: frontmatter.title,
					context: subject.shortName,
					body: [...frontmatter.keyPoints, ...headings].join(" · "),
					subjectId: subject.id,
					topicSlug: topic.slug,
				});
			}

			for (const question of questionsByTopic.get(topic.id) ?? []) {
				if (question.status !== "published") continue;
				searchIndex.push({
					kind: "question",
					id: question.id,
					title: question.stem,
					context: `${subject.shortName} · ${topic.name}`,
					body: [...question.options, question.explanation].join(" "),
					subjectId: subject.id,
					topicSlug: topic.slug,
				});
			}
		}
	}

	await writeFile(
		path.join(OUT_DIR, "search-index.json"),
		JSON.stringify(searchIndex),
		"utf8",
	);

	const subjects = bundles.map((b) => b.subject);
	const manifest = {
		generatedAt: new Date().toISOString(),
		subjects,
		examTemplates: templates,
		totals: {
			subjects: subjects.length,
			topics: subjects.reduce((s, subject) => s + subject.topics.length, 0),
			publishedQuestions: subjects.reduce((s, subject) => s + subject.questionCount, 0),
		},
	};
	await writeFile(
		path.join(OUT_DIR, "manifest.json"),
		JSON.stringify(manifest, null, "\t"),
		"utf8",
	);

	// --- Kapsam raporu -------------------------------------------------------
	console.log(`\n✔ İçerik derlendi (${Date.now() - started} ms)\n`);
	for (const subject of subjects) {
		const withSummary = subject.topics.filter((t) => t.hasSummary).length;
		console.log(
			`  ${subject.shortName.padEnd(10)} ${String(subject.questionCount).padStart(4)} soru · ` +
				`${withSummary}/${subject.topics.length} konu özeti`,
		);
		for (const topic of subject.topics) {
			const mix = DIFFICULTY_ORDER.map(
				(d) => `${d[0].toUpperCase()}${topic.countsByDifficulty[d]}`,
			).join(" ");
			const flag = topic.hasSummary ? "özet ✓" : "özet ✗";
			console.log(
				`    ${topic.slug.padEnd(34)} ${String(topic.questionCount).padStart(3)} soru  ${mix}  ${flag}`,
			);
		}
	}
	console.log(
		`\n  Toplam: ${manifest.totals.subjects} ders · ${manifest.totals.topics} konu · ` +
			`${manifest.totals.publishedQuestions} yayımlanmış soru\n`,
	);

	if (warnings.length > 0) {
		console.log(`  ${warnings.length} uyarı:`);
		for (const warning of warnings) console.log(`  ! ${warning}`);
		console.log("");
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
