import "server-only";
import { contentRepository } from "@/lib/repositories/content.repository";
import type { TopicRef } from "@/types/ui";

/** Tüm derslerin konularını istemciye geçirilebilir düz bir listeye indirger. */
export async function getAllTopicRefs(): Promise<TopicRef[]> {
	const subjects = await contentRepository.getSubjects();

	return subjects.flatMap((subject) =>
		subject.topics.map((topic) => ({
			topicId: topic.id,
			subjectId: subject.id,
			subjectName: subject.name,
			topicSlug: topic.slug,
			topicName: topic.name,
			questionCount: topic.questionCount,
			hasSummary: topic.hasSummary,
		})),
	);
}
