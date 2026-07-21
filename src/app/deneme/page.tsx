import type { Metadata } from "next";
import { ExamRunner } from "@/features/exam/exam-runner";
import { getAllTopicRefs } from "@/lib/content/topic-refs";
import { contentRepository } from "@/lib/repositories/content.repository";

export const metadata: Metadata = { title: "Deneme Sınavları" };

/**
 * Deneme sınavı sayfası.
 *
 * Havuzun tamamı derleme zamanında sayfaya gömülür. Statik export nedeniyle
 * çalışma anında veri çekilemez; karşılığında sınav tamamen çevrimdışı
 * çalışır ve soru geçişleri ağ beklemez.
 */
export default async function ExamPage() {
	const [manifest, pool, topics] = await Promise.all([
		contentRepository.getManifest(),
		contentRepository.getAllQuestions(),
		getAllTopicRefs(),
	]);

	const subjectNames = Object.fromEntries(
		manifest.subjects.map((subject) => [subject.id, subject.name]),
	);

	return (
		<ExamRunner
			templates={manifest.examTemplates}
			pool={pool}
			subjectNames={subjectNames}
			topics={topics}
		/>
	);
}
