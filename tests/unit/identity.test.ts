import { beforeEach, describe, expect, it, vi } from "vitest";
import { restampBundle } from "@/lib/auth/claim";
import {
	AuthUnavailableError,
	authProvider,
} from "@/lib/auth/auth.provider";
import {
	type Identity,
	LOCAL_IDENTITY,
	currentIdentity,
	currentUserId,
	setIdentity,
	subscribeIdentity,
} from "@/lib/auth/identity";
import type { ExportBundle } from "@/types/progress";

/**
 * Faz 3'ün veri kaybı riski en yüksek adımı damgalamadır: kullanıcı hesap
 * açtığında cihazdaki anonim ilerleme SİLİNMEDEN hesabın parçası olmalı.
 * Bu dosya o adımı Dexie'siz doğrular.
 */

function sampleBundle(userId = "local"): ExportBundle {
	return {
		version: 1,
		exportedAt: "2026-07-22T10:00:00.000Z",
		attempts: [
			{
				id: "a1",
				userId,
				questionId: "q1",
				subjectId: "657-dmk",
				topicId: "657-dmk/disiplin-cezalari",
				difficulty: "orta",
				selectedIndex: 1,
				isCorrect: true,
				durationMs: 12_000,
				context: "practice",
				sessionId: "s1",
				createdAt: "2026-07-22T09:00:00.000Z",
			},
		],
		topicProgress: [
			{
				userId,
				topicId: "657-dmk/disiplin-cezalari",
				subjectId: "657-dmk",
				summaryRead: true,
				summaryReadAt: "2026-07-22T08:00:00.000Z",
				questionsAttempted: 1,
				questionsCorrect: 1,
				masteryScore: 80,
				updatedAt: "2026-07-22T09:00:00.000Z",
			},
		],
		testSessions: [
			{
				id: "s1",
				userId,
				kind: "topic-test",
				subjectId: "657-dmk",
				topicId: "657-dmk/disiplin-cezalari",
				difficulty: "orta",
				questionIds: ["q1"],
				answers: { q1: 1 },
				status: "completed",
				startedAt: "2026-07-22T08:55:00.000Z",
				completedAt: "2026-07-22T09:00:00.000Z",
				score: 100,
				updatedAt: "2026-07-22T09:00:00.000Z",
			},
		],
		examSessions: [
			{
				id: "e1",
				userId,
				templateId: "hizli-20",
				templateName: "Hızlı 20",
				questionIds: ["q1"],
				answers: { q1: 1 },
				flagged: [],
				status: "in-progress",
				startedAt: "2026-07-22T09:10:00.000Z",
				durationSeconds: 1800,
				remainingSeconds: 1500,
				passingScore: 60,
				updatedAt: "2026-07-22T09:15:00.000Z",
			},
		],
		dailyStats: [
			{
				userId,
				date: "2026-07-22",
				questionsAnswered: 1,
				correctAnswers: 1,
				studySeconds: 12,
				topicsCompleted: 0,
			},
		],
		bookmarks: [
			{
				userId,
				refType: "topic",
				refId: "657-dmk/disiplin-cezalari",
				createdAt: "2026-07-22T08:00:00.000Z",
			},
		],
		reviewSchedule: [
			{
				userId,
				questionId: "q1",
				subjectId: "657-dmk",
				topicId: "657-dmk/disiplin-cezalari",
				easeFactor: 2.5,
				intervalDays: 1,
				repetitions: 1,
				lapses: 0,
				dueAt: "2026-07-23T09:00:00.000Z",
				lastGrade: 5,
				updatedAt: "2026-07-22T09:00:00.000Z",
			},
		],
		reports: [
			{
				id: "r1",
				userId,
				questionId: "q1",
				reason: "yazim-hatasi",
				status: "yerel",
				createdAt: "2026-07-22T09:05:00.000Z",
				updatedAt: "2026-07-22T09:05:00.000Z",
			},
		],
		settings: {
			userId,
			dailyGoalQuestions: 20,
			instantFeedback: true,
			updatedAt: "2026-07-22T08:00:00.000Z",
		},
	};
}

/** Yedekteki satır dizisi olan alanlar — meta alanlar hariç. */
function rowTables(bundle: ExportBundle): [string, { userId: string }[]][] {
	return Object.entries(bundle)
		.filter((entry): entry is [string, { userId: string }[]] =>
			Array.isArray(entry[1]),
		);
}

describe("restampBundle", () => {
	it("her tablodaki her satırı yeni kimlikle damgalar", () => {
		const restamped = restampBundle(sampleBundle(), "u-42");

		// Tablolar tek tek sayılmaz: yedeğe yeni bir tablo eklenip damgalanması
		// unutulursa bu test kırılsın diye alanlar üzerinden gezilir.
		const tables = rowTables(restamped);
		expect(tables.length).toBeGreaterThan(0);

		for (const [name, rows] of tables) {
			expect(rows.length, `${name} tablosu boşaltılmış`).toBeGreaterThan(0);
			for (const row of rows) {
				expect(row.userId, `${name} tablosunda damgalanmamış satır`).toBe("u-42");
			}
		}

		expect(restamped.settings?.userId).toBe("u-42");
	});

	it("hiçbir satırı kaybetmez ve içeriği değiştirmez", () => {
		const original = sampleBundle();
		const restamped = restampBundle(original, "u-42");

		for (const [name, rows] of rowTables(original)) {
			const after = (restamped as unknown as Record<string, unknown[]>)[name];
			expect(after, `${name} satır sayısı değişti`).toHaveLength(rows.length);
		}

		// Damga dışında hiçbir alan değişmemeli.
		expect(restamped.attempts[0]).toEqual({
			...original.attempts[0],
			userId: "u-42",
		});
		expect(restamped.topicProgress[0]?.summaryRead).toBe(true);
	});

	it("kaynağı değiştirmez", () => {
		const original = sampleBundle();
		restampBundle(original, "u-42");
		expect(original.attempts[0]?.userId).toBe("local");
	});

	it("boş yedeği ve ayarsız yedeği kabul eder", () => {
		const empty: ExportBundle = {
			...sampleBundle(),
			attempts: [],
			topicProgress: [],
			testSessions: [],
			examSessions: [],
			dailyStats: [],
			bookmarks: [],
			reviewSchedule: [],
			reports: [],
			settings: null,
		};

		const restamped = restampBundle(empty, "u-42");
		expect(restamped.attempts).toEqual([]);
		expect(restamped.settings).toBeNull();
	});

	it("karışık kimlikli yedeği tek kimliğe indirger", () => {
		const mixed = sampleBundle();
		mixed.attempts.push({ ...mixed.attempts[0]!, id: "a2", userId: "baskasi" });

		const restamped = restampBundle(mixed, "u-42");
		expect(restamped.attempts.map((a) => a.userId)).toEqual(["u-42", "u-42"]);
	});
});

describe("kimlik durumu", () => {
	beforeEach(() => {
		setIdentity(LOCAL_IDENTITY);
	});

	it("giriş yapılmamışken anonimdir", () => {
		expect(currentUserId()).toBe("local");
		expect(currentIdentity().kind).toBe("local");
	});

	it("kimlik değişince yeni değeri döner ve dinleyicileri uyarır", () => {
		const seen: Identity[] = [];
		const unsubscribe = subscribeIdentity((identity) => seen.push(identity));

		const account: Identity = {
			kind: "account",
			userId: "u-42",
			email: "memur@ornek.gov.tr",
		};
		setIdentity(account);

		expect(currentUserId()).toBe("u-42");
		expect(seen).toEqual([account]);

		unsubscribe();
		setIdentity(LOCAL_IDENTITY);
		expect(seen).toHaveLength(1);
	});
});

describe("LocalAuthProvider", () => {
	beforeEach(() => {
		setIdentity(LOCAL_IDENTITY);
	});

	it("mevcut kimliği döner", () => {
		expect(authProvider.current()).toEqual(LOCAL_IDENTITY);
	});

	it("hesap açma denemelerini 'özellik yok' olarak reddeder", async () => {
		// Ayrı hata tipi olmasının sebebi: arayüz "yeniden dene" ile
		// "bu özellik henüz yok" durumlarını ayırt edebilmeli.
		await expect(
			authProvider.requestCode("memur@ornek.gov.tr"),
		).rejects.toBeInstanceOf(AuthUnavailableError);
		await expect(
			authProvider.verifyCode("memur@ornek.gov.tr", "123456"),
		).rejects.toBeInstanceOf(AuthUnavailableError);
	});

	it("çıkış yapınca anonim kimliğe döner", async () => {
		setIdentity({ kind: "account", userId: "u-42", email: "a@b.c" });
		await authProvider.signOut();
		expect(currentUserId()).toBe("local");
	});
});

describe("kimlik deposu", () => {
	it("bozuk depo değerini yok sayar", async () => {
		// localStorage kullanıcı tarafından düzenlenebilir; doğrulanmadan
		// kabul edilen bozuk bir userId tüm satırları yanlış damgalardı.
		vi.resetModules();
		vi.stubGlobal("window", {
			localStorage: {
				getItem: () => '{"kind":"account","userId":42}',
				setItem: () => {},
				removeItem: () => {},
			},
		});

		const fresh = await import("@/lib/auth/identity");
		expect(fresh.currentUserId()).toBe("local");

		vi.unstubAllGlobals();
		vi.resetModules();
	});
});
