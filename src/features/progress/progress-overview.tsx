"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import { MASTERY_LABELS, masteryLevel } from "@/lib/scoring/mastery";
import type { TopicRef } from "@/types/ui";

export function ProgressOverview({ topics }: { topics: TopicRef[] }) {
	const progress = useLiveQuery(
		() => progressRepository.getAllTopicProgress(),
		[],
		undefined,
	);

	if (progress === undefined) {
		return (
			<div className="space-y-3">
				<Card elevation="duz" className="h-28 animate-pulse bg-surface-sunken" />
				<Card elevation="duz" className="h-48 animate-pulse bg-surface-sunken" />
			</div>
		);
	}

	const byTopic = new Map(progress.map((p) => [p.topicId, p]));
	const studied = topics.filter((t) => byTopic.has(t.topicId));

	const totalAttempted = progress.reduce(
		(sum, p) => sum + p.questionsAttempted,
		0,
	);
	const totalCorrect = progress.reduce((sum, p) => sum + p.questionsCorrect, 0);
	const readCount = progress.filter((p) => p.summaryRead).length;
	const summaryTopics = topics.filter((t) => t.hasSummary).length;

	if (totalAttempted === 0 && readCount === 0) {
		return (
			<Card className="text-center">
				<TrendingUp aria-hidden size={28} className="mx-auto text-fg-subtle" />
				<p className="mt-3 font-semibold">Henüz veri yok</p>
				<p className="mt-1 text-sm text-fg-muted">
					Bir konu özeti okuduğunda veya test çözdüğünde ilerlemen burada
					görünecek.
				</p>
				<Link
					href="/konular"
					className="mt-4 inline-block font-medium text-brand underline"
				>
					Konu özetlerine git
				</Link>
			</Card>
		);
	}

	return (
		<div className="space-y-8">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Card className="text-center">
					<p className="text-2xl font-bold tabular-nums">{totalAttempted}</p>
					<p className="text-sm text-fg-muted">Çözülen soru</p>
				</Card>
				<Card className="text-center">
					<p className="text-2xl font-bold text-correct tabular-nums">
						{totalCorrect}
					</p>
					<p className="text-sm text-fg-muted">Doğru</p>
				</Card>
				<Card className="text-center">
					<p className="text-2xl font-bold tabular-nums">
						%
						{totalAttempted > 0
							? Math.round((totalCorrect / totalAttempted) * 100)
							: 0}
					</p>
					<p className="text-sm text-fg-muted">Başarı oranı</p>
				</Card>
				<Card className="text-center">
					<p className="text-2xl font-bold tabular-nums">
						{readCount}
						<span className="text-base font-normal text-fg-subtle">
							/{summaryTopics}
						</span>
					</p>
					<p className="text-sm text-fg-muted">Okunan konu</p>
				</Card>
			</div>

			<section>
				<SectionHeading>Konu bazlı durum</SectionHeading>
				<ul className="space-y-3">
					{studied.map((topic) => {
						const p = byTopic.get(topic.topicId);
						if (!p) return null;
						const level = masteryLevel(p.masteryScore, p.questionsAttempted);

						return (
							<li key={topic.topicId}>
								{/*
								 * Halka solda, metin sağda. Yatay çubuk kartın tamamını
								 * kaplayıp her satırı iki kat uzatıyordu; halka aynı bilgiyi
								 * satır yüksekliğinde veriyor. Yüzde halkanın ortasında metin
								 * olarak da yazılı — renk tek başına anlam taşımaz.
								 */}
								<Card className="flex items-start gap-4">
									{p.questionsAttempted > 0 && (
										<ProgressRing
											value={p.masteryScore}
											label={`${topic.topicName} hakimiyeti`}
											tone={level === "hakim" ? "correct" : "brand"}
											size="sm"
										/>
									)}

									<div className="min-w-0 flex-1">
										<h3 className="font-semibold">{topic.topicName}</h3>
										<p className="text-sm text-fg-muted">{topic.subjectName}</p>

										<div className="mt-2 flex flex-wrap items-center gap-2">
											{p.summaryRead && (
												<Badge tone="correct">
													<Check aria-hidden size={13} />
													Okundu
												</Badge>
											)}
											<Badge tone={level === "hakim" ? "correct" : "neutral"}>
												{MASTERY_LABELS[level]}
											</Badge>
											{p.questionsAttempted > 0 && (
												<span className="text-sm tabular-nums text-fg-muted">
													{p.questionsCorrect} / {p.questionsAttempted} doğru
												</span>
											)}
										</div>

										{topic.questionCount > 0 && (
											<Link
												href={routes.topicTest(topic.subjectId, topic.topicSlug)}
												className="mt-3 inline-block min-h-11 text-sm font-medium leading-[2.75rem] text-brand underline"
											>
												Tekrar test et
											</Link>
										)}
									</div>
								</Card>
							</li>
						);
					})}
				</ul>
			</section>
		</div>
	);
}
