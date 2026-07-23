// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { setIdentity } from "@/lib/auth/identity";
import { progressRepository } from "@/lib/repositories/progress.repository";
import type { ServerRow } from "@/lib/sync/sync-tables";
import { runSync } from "@/lib/sync/sync";
import type { SyncTransport } from "@/lib/sync/transport";
import type { QuestionAttempt } from "@/types/progress";

/**
 * Tam senkron döngüsü, gerçek Dexie üzerinde.
 *
 * Saf birleştirme `sync-merge.test.ts`'te kanıtlandı; buradaki mesele döngünün
 * bütünü: sunucudan gelen veri yerelle birleşiyor, sonuç Dexie'ye yazılıyor,
 * türetilmiş tablolar (dailyStats, reviewSchedule) `attempts`'ten yeniden
 * üretiliyor ve — en kritiği — özet okuma işareti korunuyor.
 */

const USER = "hesap-uuid-1";

function attempt(
	id: string,
	questionId: string,
	isCorrect: boolean,
): QuestionAttempt {
	return {
		id,
		userId: USER,
		questionId,
		subjectId: "657-dmk",
		topicId: "657-dmk/yasaklar",
		difficulty: "orta",
		selectedIndex: isCorrect ? 0 : 1,
		isCorrect,
		durationMs: 10_000,
		context: "practice",
		sessionId: "s1",
		createdAt: `2026-07-23T09:0${id.slice(-1)}:00.000Z`,
	};
}

/** Sunucuyu taklit eden transport: verilen satırları döndürür, push'ları kaydeder. */
function fakeServer(seed: Record<string, ServerRow[]>): {
	transport: SyncTransport;
	pushed: Record<string, ServerRow[]>;
} {
	const pushed: Record<string, ServerRow[]> = {};
	return {
		pushed,
		transport: {
			async fetchAll(table) {
				return seed[table] ?? [];
			},
			async upsert(table, _onConflict, rows) {
				pushed[table] = [...rows];
			},
		},
	};
}

beforeEach(async () => {
	setIdentity({ kind: "account", userId: USER, email: "a@b.c" });
	await progressRepository.clearAll();
});

describe("runSync", () => {
	it("sunucudaki denemeyi yerele getirir ve hiçbirini kaybetmez", async () => {
		// Yerelde a1, sunucuda a2 (yerelde yok).
		await progressRepository.recordAttempts([
			{
				questionId: "q1",
				subjectId: "657-dmk",
				topicId: "657-dmk/yasaklar",
				difficulty: "orta",
				selectedIndex: 0,
				isCorrect: true,
				durationMs: 10_000,
				context: "practice",
				sessionId: "s1",
			},
		]);

		const { transport, pushed } = fakeServer({
			attempts: [
				{
					id: "srv-a2",
					user_id: USER,
					created_at: "2026-07-23T09:30:00.000Z",
					data: attempt("srv-a2", "q2", false),
				},
			],
		});

		await runSync(USER, transport);

		// Yerelde iki deneme de var.
		const stats = await progressRepository.getStatistics(7);
		expect(stats.totalAttempts).toBe(2);
		expect(stats.totalCorrect).toBe(1);

		// Push edilen birleşim de her iki denemeyi taşır (sunucu da güncellenir).
		expect(pushed.attempts).toHaveLength(2);
		expect(pushed.attempts?.map((r) => r.id)).toContain("srv-a2");
	});

	it("türetilmiş tabloları birleşim sonrası yeniden üretir", async () => {
		await progressRepository.recordAttempt({
			questionId: "q1",
			subjectId: "657-dmk",
			topicId: "657-dmk/yasaklar",
			difficulty: "orta",
			selectedIndex: 0,
			isCorrect: true,
			durationMs: 10_000,
			context: "practice",
			sessionId: "s1",
		});

		const { transport } = fakeServer({
			attempts: [
				{
					id: "srv-a2",
					user_id: USER,
					created_at: "2026-07-23T09:30:00.000Z",
					data: attempt("srv-a2", "q2", false),
				},
			],
		});

		await runSync(USER, transport);

		// reviewSchedule iki soru için de kurulmalı (q1 doğru, q2 yanlış).
		const summary = await progressRepository.getReviewSummary();
		expect(summary.tracked).toBe(2);

		// topicProgress sayaçları birleşik günlüğü yansıtmalı.
		const tp = await progressRepository.getTopicProgress("657-dmk/yasaklar");
		expect(tp?.questionsAttempted).toBe(2);
		expect(tp?.questionsCorrect).toBe(1);
	});

	it("özet okuma işaretini birleşim boyunca korur", async () => {
		// Yerelde özet okundu ama sunucuda bu konunun kaydı yok.
		await progressRepository.markSummaryRead("657-dmk", "657-dmk/yasaklar");

		const { transport } = fakeServer({
			attempts: [
				{
					id: "srv-a2",
					user_id: USER,
					created_at: "2026-07-23T09:30:00.000Z",
					data: attempt("srv-a2", "q2", false),
				},
			],
		});

		await runSync(USER, transport);

		const tp = await progressRepository.getTopicProgress("657-dmk/yasaklar");
		// summaryRead attempts'ten türetilemez; korunmuş olmalı.
		expect(tp?.summaryRead).toBe(true);
		// Ama sayaçlar yine de sunucudan gelen denemeyi görmeli.
		expect(tp?.questionsAttempted).toBe(1);
	});

	it("daha yeni sunucu ayarı yereli günceller", async () => {
		await progressRepository.saveSettings({ dailyGoalQuestions: 20 });

		const { transport } = fakeServer({
			settings: [
				{
					user_id: USER,
					updated_at: "2030-01-01T00:00:00.000Z", // yerelden kesinlikle yeni
					data: {
						userId: USER,
						dailyGoalQuestions: 50,
						instantFeedback: true,
						updatedAt: "2030-01-01T00:00:00.000Z",
					},
				},
			],
		});

		await runSync(USER, transport);

		const settings = await progressRepository.getSettings();
		expect(settings.dailyGoalQuestions).toBe(50);
	});

	it("boş sunucuda yerel veriyi olduğu gibi yukarı gönderir", async () => {
		await progressRepository.recordAttempt({
			questionId: "q1",
			subjectId: "657-dmk",
			topicId: "657-dmk/yasaklar",
			difficulty: "orta",
			selectedIndex: 0,
			isCorrect: true,
			durationMs: 10_000,
			context: "practice",
			sessionId: "s1",
		});

		const { transport, pushed } = fakeServer({});
		await runSync(USER, transport);

		expect(pushed.attempts).toHaveLength(1);
		// Yerel veri korunur.
		expect((await progressRepository.getStatistics(7)).totalAttempts).toBe(1);
	});
});
