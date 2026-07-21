import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import {
	contentManifestSchema,
	questionSchema,
	summaryDocSchema,
} from "@/types/content";

/**
 * Gerçek içeriğin bütünlüğü.
 *
 * `build-content.ts` zaten bir CI kapısıdır; bu testler o kapının kurallarını
 * ikinci kez, bağımsız olarak doğrular. Ürünün tezi içeriğe güven olduğu için
 * bu kuralların sessizce gevşemesi kabul edilemez.
 *
 * Önkoşul: `npm run content:build` çalışmış olmalı (test betiği öncesinde
 * pretest ile bağlanmıştır).
 */

const CONTENT_ROOT = path.join(process.cwd(), "public", "content");

async function loadManifest() {
	const raw = JSON.parse(
		await readFile(path.join(CONTENT_ROOT, "manifest.json"), "utf8"),
	);
	return contentManifestSchema.parse(raw);
}

async function loadAllQuestions() {
	const root = path.join(CONTENT_ROOT, "questions");
	const subjects = await readdir(root, { withFileTypes: true });
	const questions = [];

	for (const subject of subjects.filter((e) => e.isDirectory())) {
		const dir = path.join(root, subject.name);
		for (const file of await readdir(dir)) {
			const raw = JSON.parse(await readFile(path.join(dir, file), "utf8"));
			questions.push(...questionSchema.array().parse(raw));
		}
	}
	return questions;
}

describe("derlenmiş içerik", () => {
	it("manifest şemaya uyar", async () => {
		const manifest = await loadManifest();
		expect(manifest.subjects.length).toBeGreaterThan(0);
	});

	it("manifestteki soru sayısı gerçek dosyalarla tutarlıdır", async () => {
		const [manifest, questions] = await Promise.all([
			loadManifest(),
			loadAllQuestions(),
		]);
		expect(questions).toHaveLength(manifest.totals.publishedQuestions);
	});

	it("konu özetleri şemaya uyar ve güven damgası taşır", async () => {
		const root = path.join(CONTENT_ROOT, "summaries");
		const subjects = await readdir(root, { withFileTypes: true });

		for (const subject of subjects.filter((e) => e.isDirectory())) {
			const dir = path.join(root, subject.name);
			for (const file of await readdir(dir)) {
				const raw = JSON.parse(await readFile(path.join(dir, file), "utf8"));
				const summary = summaryDocSchema.parse(raw);

				expect(summary.legislationVersion.length).toBeGreaterThan(3);
				expect(summary.lastVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
				expect(summary.keyPoints.length).toBeGreaterThanOrEqual(2);
			}
		}
	});
});

describe("yayımlanmış sorular", () => {
	it("hepsi 'published' durumundadır", async () => {
		const questions = await loadAllQuestions();
		expect(questions.every((q) => q.status === "published")).toBe(true);
	});

	it("kimlikler benzersizdir", async () => {
		const questions = await loadAllQuestions();
		const ids = questions.map((q) => q.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("her sorunun mevzuat dayanağı vardır", async () => {
		// Farklılaşma tezi (PROJECT_PLAN.md §4, taahhüt 1): referanssız soru olamaz.
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(question.legalRef.law.length).toBeGreaterThan(3);
		}
	});

	it("kaynağı doğrulanmamış hiçbir soru yayımlanmamıştır", async () => {
		// Telif kapısı (PROJECT_PLAN.md §14.1).
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(question.source.license).not.toBe("unknown");
		}
	});

	it("AI taslağı insan onayından geçmeden yayımlanmamıştır", async () => {
		const questions = await loadAllQuestions();
		expect(questions.some((q) => q.source.kind === "ai-draft")).toBe(false);
	});

	it("dört şık birbirinden farklıdır ve doğru cevap geçerlidir", async () => {
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(new Set(question.options.map((o) => o.trim())).size).toBe(4);
			expect(question.options[question.correctIndex]).toBeTruthy();
		}
	});

	it("her sorunun açıklaması vardır", async () => {
		const questions = await loadAllQuestions();
		for (const question of questions) {
			expect(question.explanation.length).toBeGreaterThanOrEqual(20);
		}
	});
});
