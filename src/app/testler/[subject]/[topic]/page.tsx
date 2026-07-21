import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizRunner } from "@/features/quiz/quiz-runner";
import { contentRepository } from "@/lib/repositories/content.repository";

interface Props {
	params: Promise<{ subject: string; topic: string }>;
}

/**
 * Statik export: sorusu olan her konu için bir test sayfası üretilir ve
 * havuz sayfaya gömülür. Böylece test çevrimdışı da açılır — çalışma anında
 * hiçbir ağ isteği yapılmaz.
 */
export async function generateStaticParams() {
	const subjects = await contentRepository.getSubjects();
	return subjects.flatMap((subject) =>
		subject.topics
			.filter((topic) => topic.questionCount > 0)
			.map((topic) => ({ subject: subject.id, topic: topic.slug })),
	);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { subject, topic } = await params;
	const found = await contentRepository.getTopic(subject, topic);
	return { title: found ? `${found.name} — Test` : "Test" };
}

export default async function TopicTestPage({ params }: Props) {
	const { subject: subjectId, topic: topicSlug } = await params;

	const [subject, topic, questions] = await Promise.all([
		contentRepository.getSubject(subjectId),
		contentRepository.getTopic(subjectId, topicSlug),
		contentRepository.getQuestions(subjectId, topicSlug),
	]);

	if (!subject || !topic || questions.length === 0) notFound();

	return (
		<QuizRunner
			subjectId={subject.id}
			subjectName={subject.name}
			topicId={topic.id}
			topicSlug={topic.slug}
			topicName={topic.name}
			pool={questions}
		/>
	);
}
