// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_IDENTITY, setIdentity } from "@/lib/auth/identity";
import { getDb } from "@/lib/db/database";
import {
	type RecordAttemptInput,
	progressRepository,
} from "@/lib/repositories/progress.repository";
import type { ExportBundle } from "@/types/progress";

/**
 * Kimlik farkındalığının veri katmanındaki karşılığı.
 *
 * Saf `restampBundle` testi `identity.test.ts` içinde; burada asıl mesele
 * gerçek Dexie davranışı: `topicProgress`, `dailyStats`, `bookmarks` ve
 * `reviewSchedule` tablolarının BİRİNCİL ANAHTARI `userId` içerdiği için bu
 * satırlar güncellenerek damgalanamaz, silinip yeniden eklenmeleri gerekir.
 * Sessizce kaybolmadıklarını yalnızca gerçek bir veritabanı gösterebilir.
 */

const attempt: RecordAttemptInput = {
	questionId: "q1",
	subjectId: "657-dmk",
	topicId: "657-dmk/disiplin-cezalari",
	difficulty: "orta",
	selectedIndex: 1,
	isCorrect: true,
	durationMs: 12_000,
	context: "practice",
	sessionId: "s1",
};

async function seed(): Promise<void> {
	await progressRepository.recordAttempt(attempt);
	await progressRepository.recordAttempt({
		...attempt,
		questionId: "q2",
		isCorrect: false,
		sessionId: "s1",
	});
	await progressRepository.markSummaryRead(attempt.subjectId, attempt.topicId);
	await progressRepository.createTestSession({
		id: "s1",
		kind: "topic-test",
		subjectId: attempt.subjectId,
		topicId: attempt.topicId,
		difficulty: "orta",
		questionIds: ["q1", "q2"],
		answers: {},
		status: "in-progress",
		startedAt: new Date().toISOString(),
	});
	await progressRepository.saveSettings({ dailyGoalQuestions: 40 });
	await progressRepository.toggleBookmark("topic", attempt.topicId);
	await progressRepository.saveReport({
		questionId: "q1",
		reason: "yazim-hatasi",
		status: "yerel",
	});
}

beforeEach(async () => {
	setIdentity(LOCAL_IDENTITY);
	await progressRepository.clearAll();
});

describe("kimlik damgası", () => {
	it("oturumu açan kod userId vermez; repository damgalar", async () => {
		await progressRepository.createTestSession({
			id: "s9",
			kind: "topic-test",
			subjectId: "657-dmk",
			topicId: "657-dmk/genel-hukumler",
			difficulty: "kolay",
			questionIds: ["q1"],
			answers: {},
			status: "in-progress",
			startedAt: new Date().toISOString(),
		});

		const stored = await getDb().testSessions.get("s9");
		expect(stored?.userId).toBe("local");
		expect(stored?.updatedAt).toBeTruthy();
	});

	it("kimlik değişince kayıtlar yeni kimlikle damgalanır", async () => {
		setIdentity({ kind: "account", userId: "u-42", email: "a@b.c" });
		await progressRepository.recordAttempt(attempt);

		const rows = await getDb().attempts.toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.userId).toBe("u-42");
	});
});

describe("reassignOwner", () => {
	it("hiçbir satırı kaybetmez ve hepsini yeni kimlikle damgalar", async () => {
		await seed();

		const before = await progressRepository.exportAll();
		await progressRepository.reassignOwner("u-42");

		const db = getDb();
		const tables = {
			attempts: await db.attempts.toArray(),
			topicProgress: await db.topicProgress.toArray(),
			testSessions: await db.testSessions.toArray(),
			dailyStats: await db.dailyStats.toArray(),
			bookmarks: await db.bookmarks.toArray(),
			reviewSchedule: await db.reviewSchedule.toArray(),
			reports: await db.reports.toArray(),
			settings: await db.settings.toArray(),
		};

		for (const [name, rows] of Object.entries(tables)) {
			expect(rows.length, `${name} boşaldı`).toBeGreaterThan(0);
			for (const row of rows) {
				expect(row.userId, `${name} damgalanmadı`).toBe("u-42");
			}
		}

		// Satır sayıları birebir korunmalı — bileşik anahtarlı tablolarda
		// sil/yeniden ekle sırasında çakışma olsaydı burada eksilirdi.
		expect(tables.attempts).toHaveLength(before.attempts.length);
		expect(tables.topicProgress).toHaveLength(before.topicProgress.length);
		expect(tables.reviewSchedule).toHaveLength(before.reviewSchedule.length);
		expect(tables.dailyStats).toHaveLength(before.dailyStats.length);
	});

	it("taşınan veri yeni kimlikle aynı şekilde okunur", async () => {
		await seed();
		const before = await progressRepository.getStatistics(7);

		await progressRepository.reassignOwner("u-42");
		setIdentity({ kind: "account", userId: "u-42", email: "a@b.c" });

		const after = await progressRepository.getStatistics(7);
		expect(after.totalAttempts).toBe(before.totalAttempts);
		expect(after.totalCorrect).toBe(before.totalCorrect);
		expect(after.bySubject).toEqual(before.bySubject);

		// Okuma işareti günlükten türetilemez; taşınırken korunmalı.
		const progress = await progressRepository.getTopicProgress(attempt.topicId);
		expect(progress?.summaryRead).toBe(true);

		const settings = await progressRepository.getSettings();
		expect(settings.dailyGoalQuestions).toBe(40);
		expect(settings.userId).toBe("u-42");

		expect(await progressRepository.isBookmarked("topic", attempt.topicId)).toBe(
			true,
		);
	});

	it("eski kimlikten satır bırakmaz", async () => {
		await seed();
		await progressRepository.reassignOwner("u-42");

		// Kimlik hâlâ anonim; taşınmış veri buradan görünmemeli.
		expect(await progressRepository.getAllTopicProgress()).toEqual([]);
		expect((await progressRepository.getStatistics(7)).totalAttempts).toBe(0);
	});

	it("aynı kimliğe taşımak işlemsizdir", async () => {
		await seed();
		const before = await progressRepository.exportAll();

		await progressRepository.reassignOwner("local");

		const after = await progressRepository.exportAll();
		expect(after.attempts).toHaveLength(before.attempts.length);
		expect(after.topicProgress).toHaveLength(before.topicProgress.length);
	});
});

describe("eski yedekler", () => {
	it("updatedAt içermeyen v1 yedeğini kabul eder ve damgayı doldurur", async () => {
		// Şema v4 öncesinde alınmış yedek: oturumlarda updatedAt yok.
		const legacy = {
			version: 1,
			exportedAt: "2026-01-01T00:00:00.000Z",
			attempts: [],
			topicProgress: [],
			dailyStats: [],
			bookmarks: [],
			reviewSchedule: [],
			settings: null,
			testSessions: [
				{
					id: "eski-1",
					userId: "local",
					kind: "topic-test",
					subjectId: "657-dmk",
					topicId: "657-dmk/genel-hukumler",
					difficulty: "orta",
					questionIds: ["q1"],
					answers: {},
					status: "completed",
					startedAt: "2026-01-01T09:00:00.000Z",
					completedAt: "2026-01-01T09:10:00.000Z",
					score: 100,
				},
			],
			examSessions: [
				{
					id: "eski-2",
					userId: "local",
					templateId: "hizli-20",
					templateName: "Hızlı 20",
					questionIds: ["q1"],
					answers: {},
					flagged: [],
					status: "abandoned",
					startedAt: "2026-01-01T10:00:00.000Z",
					durationSeconds: 1800,
					remainingSeconds: 900,
					passingScore: 60,
				},
			],
			reports: [
				{
					id: "eski-3",
					userId: "local",
					questionId: "q1",
					reason: "diger",
					status: "yerel",
					createdAt: "2026-01-01T11:00:00.000Z",
				},
			],
		} as unknown as ExportBundle;

		await progressRepository.importAll(legacy);

		const db = getDb();
		expect((await db.testSessions.get("eski-1"))?.updatedAt).toBe(
			"2026-01-01T09:10:00.000Z",
		);
		expect((await db.examSessions.get("eski-2"))?.updatedAt).toBe(
			"2026-01-01T10:00:00.000Z",
		);
		expect((await db.reports.get("eski-3"))?.updatedAt).toBe(
			"2026-01-01T11:00:00.000Z",
		);
	});
});

describe("yer imi mezar taşı", () => {
	it("kaldırma satırı silmez, mezar taşına çevirir", async () => {
		await progressRepository.toggleBookmark("question", "q1");
		expect(await progressRepository.isBookmarked("question", "q1")).toBe(true);

		const removed = await progressRepository.toggleBookmark("question", "q1");
		expect(removed).toBe(false);
		// Kullanıcıya kaldırılmış görünür...
		expect(await progressRepository.isBookmarked("question", "q1")).toBe(false);
		// ...ama satır durur (mezar taşı), yoksa silme senkronla taşınamazdı.
		const row = await getDb().bookmarks.get(["local", "question", "q1"]);
		expect(row).toBeDefined();
		expect(row?.deletedAt).toBeTruthy();
	});

	it("yeniden ekleme mezar taşını canlandırır, özgün createdAt'i korur", async () => {
		await progressRepository.toggleBookmark("question", "q1");
		const first = await getDb().bookmarks.get(["local", "question", "q1"]);

		await progressRepository.toggleBookmark("question", "q1"); // kaldır
		const readded = await progressRepository.toggleBookmark("question", "q1");

		expect(readded).toBe(true);
		expect(await progressRepository.isBookmarked("question", "q1")).toBe(true);
		const row = await getDb().bookmarks.get(["local", "question", "q1"]);
		expect(row?.deletedAt).toBeUndefined();
		expect(row?.createdAt).toBe(first?.createdAt);
	});

	it("mezar taşları yedekte taşınır (senkron için)", async () => {
		await progressRepository.toggleBookmark("question", "q1");
		await progressRepository.toggleBookmark("question", "q1"); // mezar taşı

		const bundle = await progressRepository.exportAll();
		expect(bundle.bookmarks).toHaveLength(1);
		expect(bundle.bookmarks[0]?.deletedAt).toBeTruthy();
	});
});
