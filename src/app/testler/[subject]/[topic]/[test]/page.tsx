import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuizGate } from "@/features/quiz/quiz-gate";
import { QuizRunner } from "@/features/quiz/quiz-runner";
import { contentRepository } from "@/lib/repositories/content.repository";
import { buildTestSets, parseTestSetSlug } from "@/lib/selector/test-sets";

interface Props {
	params: Promise<{ subject: string; topic: string; test: string }>;
}

/**
 * Statik export: her konunun her testi için ayrı bir sayfa üretilir ve o
 * testin soruları sayfaya gömülür. Böylece test çevrimdışı da açılır —
 * çalışma anında hiçbir ağ isteği yapılmaz.
 *
 * Bölme (`buildTestSets`) saf ve deterministiktir: liste sayfası ile bu sayfa
 * aynı havuzdan aynı setleri üretir.
 */
export async function generateStaticParams() {
	const subjects = await contentRepository.getSubjects();

	const params: { subject: string; topic: string; test: string }[] = [];
	for (const subject of subjects) {
		for (const topic of subject.topics) {
			if (topic.questionCount === 0) continue;
			const questions = await contentRepository.getQuestions(
				subject.id,
				topic.slug,
			);
			for (const set of buildTestSets(questions, topic.id)) {
				params.push({ subject: subject.id, topic: topic.slug, test: set.slug });
			}
		}
	}
	return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { subject, topic, test } = await params;
	const found = await contentRepository.getTopic(subject, topic);
	const number = parseTestSetSlug(test);
	return {
		title: found && number ? `${found.name} — Test ${number}` : "Test",
	};
}

export default async function TopicTestSetPage({ params }: Props) {
	const { subject: subjectId, topic: topicSlug, test: testSlug } = await params;

	const number = parseTestSetSlug(testSlug);
	if (number === null) notFound();

	const [subject, topic, questions] = await Promise.all([
		contentRepository.getSubject(subjectId),
		contentRepository.getTopic(subjectId, topicSlug),
		contentRepository.getQuestions(subjectId, topicSlug),
	]);

	if (!subject || !topic) notFound();

	const sets = buildTestSets(questions, topic.id);
	const set = sets.find((candidate) => candidate.number === number);
	if (!set) notFound();

	/*
	 * Kilit kapısı koşucunun ETRAFINDA: `QuizRunner` monte edilir edilmez bir
	 * test oturumu yazar, dolayısıyla kilit içeriden uygulanamaz. Kilitliyken
	 * koşucu hiç mount edilmez.
	 */
	return (
		<QuizGate
			subjectId={subject.id}
			subjectName={subject.name}
			topicSlug={topic.slug}
			topicName={topic.name}
			setNumber={set.number}
			setSlug={set.slug}
			setCount={sets.length}
		>
			<QuizRunner
				subjectId={subject.id}
				subjectName={subject.name}
				topicId={topic.id}
				topicSlug={topic.slug}
				topicName={topic.name}
				setNumber={set.number}
				setSlug={set.slug}
				setCount={sets.length}
				questions={set.questions}
			/>
		</QuizGate>
	);
}
