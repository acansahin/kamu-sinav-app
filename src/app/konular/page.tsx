import type { Metadata } from "next";
import { CardLink } from "@/components/ui/card";
import { BookmarkedTopics } from "@/features/study/bookmarked-topics";
import { getAllTopicRefs } from "@/lib/content/topic-refs";
import { contentRepository } from "@/lib/repositories/content.repository";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Konu Özetleri" };

export default async function SubjectsPage() {
	const [subjects, topics] = await Promise.all([
		contentRepository.getSubjects(),
		getAllTopicRefs(),
	]);

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Konu Özetleri</h1>
			<p className="mb-6 text-fg-muted">
				Ortak konular — tüm kurumların görevde yükselme ve unvan değişikliği
				sınavlarında geçerlidir.
			</p>

			{/* Yer imi yoksa hiç render edilmez */}
			<BookmarkedTopics topics={topics} />

			<ul className="grid gap-3 sm:grid-cols-2">
				{subjects.map((subject) => {
					const ready = subject.topics.filter((t) => t.hasSummary).length;
					return (
						<li key={subject.id}>
							<CardLink href={routes.subject(subject.id)} className="h-full">
								<h2 className="text-lg font-bold">{subject.name}</h2>
								<p className="mt-1 text-sm text-fg-muted">
									{subject.description}
								</p>
								<p className="mt-3 text-sm font-medium text-fg-subtle">
									{subject.topics.length} konu · {ready} özet hazır ·{" "}
									{subject.questionCount} soru
								</p>
							</CardLink>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
