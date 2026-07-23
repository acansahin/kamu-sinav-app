import type {
	ExamSession,
	ExportBundle,
	QuestionAttempt,
	QuestionReport,
	StudySettings,
	TestSession,
	TopicProgress,
} from "@/types/progress";
import type { SyncTransport } from "./transport";

/**
 * Sunucudaki veriyi bir yedek biçiminde geri getirir.
 *
 * Her sunucu satırının `data` alanı, gönderilirken olduğu gibi istemci
 * nesnesini taşır; burada yalnızca geri açılır. Sunucuda hiç bulunmayan üç
 * tablo (dailyStats, reviewSchedule, bookmarks) boş döner — bunlar birleştirme
 * sonrası `attempts`'ten yeniden üretilir ya da yerelde korunur.
 */
export async function pullServerBundle(
	userId: string,
	transport: SyncTransport,
): Promise<ExportBundle> {
	const [attempts, topicProgress, testSessions, examSessions, reports, settings] =
		await Promise.all([
			transport.fetchAll("attempts", userId),
			transport.fetchAll("topic_progress", userId),
			transport.fetchAll("test_sessions", userId),
			transport.fetchAll("exam_sessions", userId),
			transport.fetchAll("reports", userId),
			transport.fetchAll("settings", userId),
		]);

	return {
		version: 1,
		exportedAt: new Date().toISOString(),
		attempts: attempts.map((row) => row.data as QuestionAttempt),
		topicProgress: topicProgress.map((row) => row.data as TopicProgress),
		testSessions: testSessions.map((row) => row.data as TestSession),
		examSessions: examSessions.map((row) => row.data as ExamSession),
		reports: reports.map((row) => row.data as QuestionReport),
		settings: (settings[0]?.data as StudySettings | undefined) ?? null,
		// Sunucuda tutulmaz; çağıran türetir ya da yerelde korur.
		dailyStats: [],
		reviewSchedule: [],
		bookmarks: [],
	};
}
