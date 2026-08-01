import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardLink } from "@/components/ui/card";
import { contentRepository } from "@/lib/repositories/content.repository";
import { routes } from "@/lib/routes";
import { TEST_SIZE, planSizes } from "@/lib/selector/test-sets";
import { DIFFICULTY_ORDER } from "@/types/content";

export const metadata: Metadata = { title: "Testler" };

export default async function TestsPage() {
	const subjects = await contentRepository.getSubjects();
	const withQuestions = subjects.filter((s) => s.questionCount > 0);

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Testler</h1>
			<p className="mb-6 text-fg-muted">
				Konu seç, numaralı testlerden birini aç ve çözmeye başla. Her test{" "}
				{TEST_SIZE} sorudur, kolaydan uzmana dört seviyeyi birlikte içerir; her
				sorunun açıklaması ve mevzuat dayanağı gösterilir.
			</p>

			{withQuestions.length === 0 ? (
				<Card className="text-center">
					<ListChecks aria-hidden size={28} className="mx-auto text-fg-subtle" />
					<p className="mt-3 font-semibold">Henüz test hazır değil</p>
					<p className="mt-1 text-sm text-fg-muted">
						Soru havuzu hazırlanıyor. Bu arada konu özetlerini okuyabilirsin.
					</p>
				</Card>
			) : (
				<div className="space-y-8">
					{withQuestions.map((subject) => (
						<section key={subject.id}>
							<h2 className="mb-3 text-xl font-bold">{subject.name}</h2>
							<ul className="space-y-3">
								{subject.topics
									.filter((topic) => topic.questionCount > 0)
									.map((topic) => (
										<li key={topic.id}>
											<CardLink href={routes.topicTest(subject.id, topic.slug)}>
												<h3 className="font-semibold">{topic.name}</h3>
												<p className="mt-1 text-sm text-fg-muted">
													{planSizes(topic.questionCount).length} test ·{" "}
													{topic.questionCount} soru ·{" "}
													{DIFFICULTY_ORDER.filter(
														(level) => topic.countsByDifficulty[level] > 0,
													)
														.map(
															(level) =>
																`${level} ${topic.countsByDifficulty[level]}`,
														)
														.join(" · ")}
												</p>
											</CardLink>
										</li>
									))}
							</ul>
						</section>
					))}
				</div>
			)}
		</div>
	);
}
