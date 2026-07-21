import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
	type CompiledSubject,
	type CompiledTopic,
	type ContentManifest,
	type Question,
	type SummaryDoc,
	contentManifestSchema,
	questionSchema,
	summaryDocSchema,
} from "@/types/content";

/**
 * İçerik erişim sözleşmesi.
 *
 * UI ve özellik katmanı yalnızca bu arayüzü görür; içeriğin diskten mi, ağdan
 * mı yoksa (Faz 3+) bir API'den mi geldiğini bilmez.
 *
 * Not: MVP'de tüm okumalar derleme zamanında (statik export sırasında) yapılır,
 * çünkü uygulama Capacitor için tam statik üretilir — çalışma anında sunucu yoktur.
 */
export interface IContentRepository {
	getManifest(): Promise<ContentManifest>;
	getSubjects(): Promise<CompiledSubject[]>;
	getSubject(subjectId: string): Promise<CompiledSubject | null>;
	getTopic(subjectId: string, topicSlug: string): Promise<CompiledTopic | null>;
	getSummary(subjectId: string, topicSlug: string): Promise<SummaryDoc | null>;
	getQuestions(subjectId: string, topicSlug: string): Promise<Question[]>;
	/** Tüm derslerin yayımlanmış soru havuzu — deneme sınavı için. */
	getAllQuestions(): Promise<Question[]>;
}

const CONTENT_ROOT = path.join(process.cwd(), "public", "content");

async function readJsonFile(...segments: string[]): Promise<unknown | null> {
	try {
		return JSON.parse(await readFile(path.join(CONTENT_ROOT, ...segments), "utf8"));
	} catch (error) {
		if (
			error instanceof Error &&
			(error as NodeJS.ErrnoException).code === "ENOENT"
		) {
			return null;
		}
		throw error;
	}
}

/**
 * `public/content/` altındaki derlenmiş dosyaları okur.
 *
 * Bu dosyalar `scripts/build-content.ts` tarafından şemaya karşı zaten
 * doğrulanmıştır; buradaki ikinci ayrıştırma, üretilmiş çıktının bayatlaması
 * (şema değişip içerik yeniden derlenmemesi) durumunda sessiz bozulma yerine
 * net hata almak içindir.
 */
class StaticFileContentRepository implements IContentRepository {
	private manifestCache: ContentManifest | null = null;

	async getManifest(): Promise<ContentManifest> {
		if (this.manifestCache) return this.manifestCache;

		const raw = await readJsonFile("manifest.json");
		if (raw === null) {
			throw new Error(
				"public/content/manifest.json yok. Önce `npm run content:build` çalıştırın.",
			);
		}
		const parsed = contentManifestSchema.safeParse(raw);
		if (!parsed.success) {
			throw new Error(
				`Derlenmiş içerik şemayla uyuşmuyor — içeriği yeniden derleyin. ${parsed.error.message}`,
			);
		}
		this.manifestCache = parsed.data;
		return parsed.data;
	}

	async getSubjects(): Promise<CompiledSubject[]> {
		return (await this.getManifest()).subjects;
	}

	async getSubject(subjectId: string): Promise<CompiledSubject | null> {
		const subjects = await this.getSubjects();
		return subjects.find((s) => s.id === subjectId) ?? null;
	}

	async getTopic(
		subjectId: string,
		topicSlug: string,
	): Promise<CompiledTopic | null> {
		const subject = await this.getSubject(subjectId);
		return subject?.topics.find((t) => t.slug === topicSlug) ?? null;
	}

	async getSummary(
		subjectId: string,
		topicSlug: string,
	): Promise<SummaryDoc | null> {
		const raw = await readJsonFile("summaries", subjectId, `${topicSlug}.json`);
		if (raw === null) return null;

		const parsed = summaryDocSchema.safeParse(raw);
		if (!parsed.success) {
			throw new Error(
				`Özet bozuk: ${subjectId}/${topicSlug} — ${parsed.error.message}`,
			);
		}
		return parsed.data;
	}

	async getQuestions(subjectId: string, topicSlug: string): Promise<Question[]> {
		const raw = await readJsonFile("questions", subjectId, `${topicSlug}.json`);
		if (raw === null) return [];

		const parsed = questionSchema.array().safeParse(raw);
		if (!parsed.success) {
			throw new Error(
				`Sorular bozuk: ${subjectId}/${topicSlug} — ${parsed.error.message}`,
			);
		}
		return parsed.data;
	}

	async getAllQuestions(): Promise<Question[]> {
		const subjects = await this.getSubjects();

		const perTopic = await Promise.all(
			subjects.flatMap((subject) =>
				subject.topics
					.filter((topic) => topic.questionCount > 0)
					.map((topic) => this.getQuestions(subject.id, topic.slug)),
			),
		);
		return perTopic.flat();
	}
}

export const contentRepository: IContentRepository =
	new StaticFileContentRepository();
