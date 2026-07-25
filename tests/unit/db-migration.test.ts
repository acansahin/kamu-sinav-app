// @vitest-environment jsdom
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Şema göçleri (v3 → v4 → v5).
 *
 * Diğer testler veritabanını sıfırdan güncel sürümle açar, dolayısıyla
 * `upgrade` gövdelerine hiç uğramaz. Oysa o kod mevcut HER kullanıcının
 * cihazında bir kez çalışacak ve tek şansı var: yanlış doldurursa senkron
 * damgası kalıcı olarak bozuk kalır. Bu dosya eski şemayı elle kurup göçü
 * tetikler. v4 oturumların/bildirimlerin `updatedAt`'ini, v5 yer imlerininkini
 * doldurur.
 */

const DB_NAME = "kamu-sinav-akademi";

/** v4 öncesi şema — `lib/db/database.ts` içindeki v1–v3 ile birebir. */
function openLegacyDb(): Dexie {
	const db = new Dexie(DB_NAME);

	db.version(1).stores({
		attempts:
			"&id, userId, questionId, topicId, subjectId, createdAt, [userId+topicId], [userId+questionId]",
		topicProgress: "[userId+topicId], userId, subjectId, masteryScore, updatedAt",
		testSessions: "&id, userId, topicId, subjectId, status, startedAt",
		dailyStats: "[userId+date], userId, date",
		settings: "&userId",
		bookmarks: "[userId+refType+refId], userId, refType, createdAt",
		reports: "&id, userId, questionId, status",
	});
	db.version(2).stores({
		examSessions: "&id, userId, status, startedAt, [userId+status]",
	});
	db.version(3).stores({
		reviewSchedule: "[userId+questionId], userId, dueAt, topicId, [userId+dueAt]",
	});

	return db;
}

beforeAll(async () => {
	const legacy = openLegacyDb();
	await legacy.open();

	// v4 öncesi kayıtlar: hiçbirinde `updatedAt` yok.
	await legacy.table("testSessions").add({
		id: "t1",
		userId: "local",
		kind: "topic-test",
		subjectId: "657-dmk",
		topicId: "657-dmk/yasaklar",
		difficulty: "orta",
		questionIds: ["q1"],
		answers: { q1: 0 },
		status: "completed",
		startedAt: "2026-05-01T09:00:00.000Z",
		completedAt: "2026-05-01T09:12:00.000Z",
		score: 100,
	});
	// Yarım kalmış oturum: `completedAt` yok, damga `startedAt`'ten gelmeli.
	await legacy.table("testSessions").add({
		id: "t2",
		userId: "local",
		kind: "topic-test",
		subjectId: "657-dmk",
		topicId: "657-dmk/yasaklar",
		difficulty: "kolay",
		questionIds: ["q2"],
		answers: {},
		status: "in-progress",
		startedAt: "2026-05-02T09:00:00.000Z",
	});
	await legacy.table("examSessions").add({
		id: "e1",
		userId: "local",
		templateId: "gys-80",
		templateName: "GYS 80",
		questionIds: ["q1"],
		answers: {},
		flagged: [],
		status: "abandoned",
		startedAt: "2026-05-03T09:00:00.000Z",
		durationSeconds: 7200,
		remainingSeconds: 6000,
		passingScore: 60,
	});
	await legacy.table("reports").add({
		id: "r1",
		userId: "local",
		questionId: "q1",
		reason: "guncel-degil",
		status: "yerel",
		createdAt: "2026-05-04T09:00:00.000Z",
	});
	// v5 öncesi yer imi: `updatedAt` yok, damga `createdAt`'ten gelmeli.
	await legacy.table("bookmarks").add({
		userId: "local",
		refType: "topic",
		refId: "657-dmk/yasaklar",
		createdAt: "2026-05-05T09:00:00.000Z",
	});

	legacy.close();
});

describe("v3 → v4 → v5 göçü", () => {
	it("eski satırları silmeden updatedAt damgasını doldurur", async () => {
		// Göç, uygulama veritabanı ilk açıldığında çalışır.
		const { getDb } = await import("@/lib/db/database");
		const db = getDb();
		await db.open();

		expect(db.verno).toBe(5);

		// Tamamlanmış oturumda damga bitiş anıdır.
		expect((await db.testSessions.get("t1"))?.updatedAt).toBe(
			"2026-05-01T09:12:00.000Z",
		);
		// Yarım kalmışta elde olan tek tarih başlangıçtır.
		expect((await db.testSessions.get("t2"))?.updatedAt).toBe(
			"2026-05-02T09:00:00.000Z",
		);
		expect((await db.examSessions.get("e1"))?.updatedAt).toBe(
			"2026-05-03T09:00:00.000Z",
		);
		expect((await db.reports.get("r1"))?.updatedAt).toBe(
			"2026-05-04T09:00:00.000Z",
		);
		// v5: yer iminin damgası oluşturulma tarihinden gelir, canlı kalır.
		const bookmark = await db.bookmarks.get([
			"local",
			"topic",
			"657-dmk/yasaklar",
		]);
		expect(bookmark?.updatedAt).toBe("2026-05-05T09:00:00.000Z");
		expect(bookmark?.deletedAt).toBeUndefined();

		// Göç veri kaybettirmemeli.
		expect(await db.testSessions.count()).toBe(2);
		expect((await db.testSessions.get("t1"))?.score).toBe(100);
	});
});
