import { describe, expect, it } from "vitest";
import { pushBundle } from "@/lib/sync/push";
import type { ServerRow } from "@/lib/sync/sync-tables";
import type { SyncTransport } from "@/lib/sync/transport";
import type { ExportBundle } from "@/types/progress";

/**
 * Gönderim mantığı, ağdan bağımsız.
 *
 * Sahte transport aldığı her çağrıyı kaydeder; böylece hangi tablonun
 * gittiğini VE hangisinin gitmediğini doğrulayabiliriz. İkincisi asıl mesele:
 * dailyStats, reviewSchedule ve bookmarks bilinçli olarak senkronlanmaz
 * (sunucuda tabloları bile yok) ve bir gün yanlışlıkla listeye eklenirse
 * bu testin patlaması gerekir.
 */

interface Call {
	table: string;
	onConflict: string;
	rows: readonly ServerRow[];
}

function recordingTransport(): { transport: SyncTransport; calls: Call[] } {
	const calls: Call[] = [];
	return {
		calls,
		transport: {
			async upsert(table, onConflict, rows) {
				calls.push({ table, onConflict, rows });
			},
			// Gönderim testi çekmeye dokunmaz; sözleşmeyi karşılamak için boş.
			async fetchAll() {
				return [];
			},
		},
	};
}

const UID = "hesap-uuid-1";

function fullBundle(): ExportBundle {
	return {
		version: 1,
		exportedAt: "2026-07-23T10:00:00.000Z",
		attempts: [
			{
				id: "a1",
				userId: UID,
				questionId: "q1",
				subjectId: "657-dmk",
				topicId: "657-dmk/yasaklar",
				difficulty: "orta",
				selectedIndex: 1,
				isCorrect: true,
				durationMs: 12_000,
				context: "practice",
				sessionId: "s1",
				createdAt: "2026-07-23T09:00:00.000Z",
			},
		],
		topicProgress: [
			{
				userId: UID,
				topicId: "657-dmk/yasaklar",
				subjectId: "657-dmk",
				summaryRead: true,
				summaryReadAt: "2026-07-23T08:00:00.000Z",
				questionsAttempted: 1,
				questionsCorrect: 1,
				masteryScore: 80,
				updatedAt: "2026-07-23T09:00:00.000Z",
			},
		],
		testSessions: [
			{
				id: "s1",
				userId: UID,
				kind: "topic-test",
				subjectId: "657-dmk",
				topicId: "657-dmk/yasaklar",
				difficulty: "orta",
				questionIds: ["q1"],
				answers: { q1: 1 },
				status: "completed",
				startedAt: "2026-07-23T08:55:00.000Z",
				completedAt: "2026-07-23T09:00:00.000Z",
				score: 100,
				updatedAt: "2026-07-23T09:00:00.000Z",
			},
		],
		examSessions: [
			{
				id: "e1",
				userId: UID,
				templateId: "hizli-20",
				templateName: "Hızlı 20",
				questionIds: ["q1"],
				answers: { q1: 1 },
				flagged: [],
				status: "in-progress",
				startedAt: "2026-07-23T09:10:00.000Z",
				durationSeconds: 1800,
				remainingSeconds: 1500,
				passingScore: 60,
				updatedAt: "2026-07-23T09:15:00.000Z",
			},
		],
		reports: [
			{
				id: "r1",
				userId: UID,
				questionId: "q1",
				reason: "yazim-hatasi",
				status: "yerel",
				createdAt: "2026-07-23T09:05:00.000Z",
				updatedAt: "2026-07-23T09:05:00.000Z",
			},
		],
		settings: {
			userId: UID,
			dailyGoalQuestions: 40,
			instantFeedback: true,
			updatedAt: "2026-07-23T08:00:00.000Z",
		},
		bookmarks: [
			{
				userId: UID,
				refType: "topic",
				refId: "657-dmk/yasaklar",
				createdAt: "2026-07-23T08:00:00.000Z",
				updatedAt: "2026-07-23T08:00:00.000Z",
			},
		],
		// Aşağıdaki ikisi dolu — ama yine de GÖNDERİLMEMELİ (türetilir).
		dailyStats: [
			{
				userId: UID,
				date: "2026-07-23",
				questionsAnswered: 1,
				correctAnswers: 1,
				studySeconds: 12,
				topicsCompleted: 0,
			},
		],
		reviewSchedule: [
			{
				userId: UID,
				questionId: "q1",
				subjectId: "657-dmk",
				topicId: "657-dmk/yasaklar",
				easeFactor: 2.5,
				intervalDays: 1,
				repetitions: 1,
				lapses: 0,
				dueAt: "2026-07-24T09:00:00.000Z",
				lastGrade: 5,
				updatedAt: "2026-07-23T09:00:00.000Z",
			},
		],
	};
}

describe("pushBundle", () => {
	it("yalnızca senkronlanan yedi tabloya yazar", async () => {
		const { transport, calls } = recordingTransport();
		await pushBundle(fullBundle(), UID, transport);

		expect(calls.map((c) => c.table).sort()).toEqual([
			"attempts",
			"bookmarks",
			"exam_sessions",
			"reports",
			"settings",
			"test_sessions",
			"topic_progress",
		]);
	});

	it("dailyStats ve reviewSchedule'ı ASLA göndermez (türetilir)", async () => {
		const { transport, calls } = recordingTransport();
		await pushBundle(fullBundle(), UID, transport);

		const tables = calls.map((c) => c.table);
		expect(tables).not.toContain("daily_stats");
		expect(tables).not.toContain("dailyStats");
		expect(tables).not.toContain("review_schedule");
		expect(tables).not.toContain("reviewSchedule");
	});

	it("her satırı oturum sahibinin user_id'siyle damgalar", async () => {
		const { transport, calls } = recordingTransport();
		await pushBundle(fullBundle(), UID, transport);

		for (const call of calls) {
			for (const row of call.rows) {
				expect(row.user_id).toBe(UID);
			}
		}
	});

	it("append-only attempts'i created_at ve id ile, id çakışmasıyla gönderir", async () => {
		const { transport, calls } = recordingTransport();
		await pushBundle(fullBundle(), UID, transport);

		const attempts = calls.find((c) => c.table === "attempts");
		expect(attempts?.onConflict).toBe("id");
		expect(attempts?.rows[0]).toMatchObject({
			id: "a1",
			user_id: UID,
			created_at: "2026-07-23T09:00:00.000Z",
		});
	});

	it("bileşik anahtarlı topic_progress'i user_id+topic_id ile gönderir", async () => {
		const { transport, calls } = recordingTransport();
		await pushBundle(fullBundle(), UID, transport);

		const tp = calls.find((c) => c.table === "topic_progress");
		expect(tp?.onConflict).toBe("user_id,topic_id");
		expect(tp?.rows[0]).toMatchObject({
			user_id: UID,
			topic_id: "657-dmk/yasaklar",
			updated_at: "2026-07-23T09:00:00.000Z",
		});
	});

	it("tek satırlık settings'i user_id çakışmasıyla gönderir", async () => {
		const { transport, calls } = recordingTransport();
		await pushBundle(fullBundle(), UID, transport);

		const settings = calls.find((c) => c.table === "settings");
		expect(settings?.onConflict).toBe("user_id");
		expect(settings?.rows).toHaveLength(1);
	});

	it("bileşik anahtarlı bookmarks'ı ref sütunlarıyla ve mezar taşları dâhil gönderir", async () => {
		const bundle: ExportBundle = {
			...fullBundle(),
			bookmarks: [
				{
					userId: UID,
					refType: "topic",
					refId: "657-dmk/yasaklar",
					createdAt: "2026-07-23T08:00:00.000Z",
					updatedAt: "2026-07-23T08:00:00.000Z",
				},
				{
					userId: UID,
					refType: "question",
					refId: "q9",
					createdAt: "2026-07-23T08:00:00.000Z",
					updatedAt: "2026-07-23T10:00:00.000Z",
					// Mezar taşı: kaldırılmış ama yine de GÖNDERİLMELİ.
					deletedAt: "2026-07-23T10:00:00.000Z",
				},
			],
		};

		const { transport, calls } = recordingTransport();
		await pushBundle(bundle, UID, transport);

		const bm = calls.find((c) => c.table === "bookmarks");
		expect(bm?.onConflict).toBe("user_id,ref_type,ref_id");
		expect(bm?.rows).toHaveLength(2);
		expect(bm?.rows[0]).toMatchObject({
			user_id: UID,
			ref_type: "topic",
			ref_id: "657-dmk/yasaklar",
			updated_at: "2026-07-23T08:00:00.000Z",
		});
		// Mezar taşı da transporta ulaşır; silmenin taşınması buna bağlı.
		expect(
			(bm?.rows[1]?.data as { deletedAt?: string })?.deletedAt,
		).toBe("2026-07-23T10:00:00.000Z");
	});

	it("boş tablo için istek atmaz", async () => {
		const empty: ExportBundle = {
			...fullBundle(),
			attempts: [],
			topicProgress: [],
			testSessions: [],
			examSessions: [],
			reports: [],
			bookmarks: [],
			settings: null,
		};

		const { transport, calls } = recordingTransport();
		await pushBundle(empty, UID, transport);

		expect(calls).toEqual([]);
	});
});
