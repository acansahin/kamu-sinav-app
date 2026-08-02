import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TestSetList } from "@/features/quiz/test-set-list";
import { contentRepository } from "@/lib/repositories/content.repository";
import { routes } from "@/lib/routes";
import { TEST_SIZE, buildTestSets } from "@/lib/selector/test-sets";

interface Props {
	params: Promise<{ subject: string; topic: string }>;
}

/**
 * Statik export: sorusu olan her konu için bir test listesi üretilir.
 * Testlerin içeriği burada değil, `[test]/page.tsx` içinde gömülüdür; bu
 * sayfa yalnızca sayıları taşır.
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
	return { title: found ? `${found.name} — Testler` : "Testler" };
}

export default async function TopicTestListPage({ params }: Props) {
	const { subject: subjectId, topic: topicSlug } = await params;

	const [subject, topic, questions] = await Promise.all([
		contentRepository.getSubject(subjectId),
		contentRepository.getTopic(subjectId, topicSlug),
		contentRepository.getQuestions(subjectId, topicSlug),
	]);

	if (!subject || !topic || questions.length === 0) notFound();

	const sets = buildTestSets(questions, topic.id);

	return (
		<div>
			{/* Konu adı dersin adıyla aynı olabiliyor; iki kez basmayalım. */}
			{subject.name !== topic.name && (
				<p className="text-sm text-fg-muted">{subject.name}</p>
			)}
			<h1 className="mb-2 text-2xl font-bold">{topic.name} — Testler</h1>
			<p className="mb-6 text-fg-muted">
				Her test {TEST_SIZE} sorudur ve kolaydan uzmana dört seviyeyi birlikte
				içerir. Testlerin içeriği sabittir: aynı testi tekrar çözdüğünde aynı
				sorularla karşılaşırsın.
			</p>

			<TestSetList
				subjectId={subject.id}
				topicSlug={topic.slug}
				topicId={topic.id}
				sets={sets.map((set) => ({
					slug: set.slug,
					number: set.number,
					questionCount: set.questions.length,
									}))}
			/>

			<Card className="mt-6 bg-surface-sunken">
				<p className="text-sm text-fg-muted">
					Bu konuda {topic.questionCount} soru var ve hepsi testlere dağıtıldı.
					Yanlış yaptığın sorular{" "}
					<Link href="/yanlislarim" className="font-medium text-brand underline">
						tekrar planına
					</Link>{" "}
					düşer.{" "}
					{topic.hasSummary && (
						<>
							Önce{" "}
							<Link
								href={routes.topic(subject.id, topic.slug)}
								className="font-medium text-brand underline"
							>
								konu özetini
							</Link>{" "}
							okumak istersen oradan da başlayabilirsin.
						</>
					)}
				</p>
			</Card>
		</div>
	);
}
