"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import { MASTERY_THRESHOLD } from "@/lib/scoring/mastery";
import type { TopicRef } from "@/types/ui";

/**
 * Ana sayfanın tek baskın çağrısı: "bugün ne çalışmalıyım?"
 *
 * Öncelik sırası bilinçlidir (PROJECT_PLAN.md §11, ekran 1):
 *   1. Zayıf konu varsa onu kapat.
 *   2. Yoksa okunmamış ilk konuya başla.
 *   3. Her şey bittiyse tekrar öner.
 */
export function ContinueCard({ topics }: { topics: TopicRef[] }) {
	const progress = useLiveQuery(
		() => progressRepository.getAllTopicProgress(),
		[],
		undefined,
	);

	// Veri henüz yüklenmediyse iskelet göster — düzen sıçraması olmasın.
	if (progress === undefined) {
		return (
			<Card elevation="duz" className="h-40 animate-pulse bg-surface-sunken" />
		);
	}

	const byTopic = new Map(progress.map((p) => [p.topicId, p]));

	const weak = topics
		.filter((topic) => {
			const p = byTopic.get(topic.topicId);
			return (
				p !== undefined &&
				p.questionsAttempted >= 3 &&
				p.masteryScore < MASTERY_THRESHOLD &&
				topic.questionCount > 0
			);
		})
		.sort(
			(a, b) =>
				(byTopic.get(a.topicId)?.masteryScore ?? 0) -
				(byTopic.get(b.topicId)?.masteryScore ?? 0),
		);

	const unread = topics.filter(
		(topic) => topic.hasSummary && !byTopic.get(topic.topicId)?.summaryRead,
	);

	const target = weak[0] ?? unread[0] ?? topics.find((t) => t.hasSummary);

	if (!target) {
		return (
			<Card>
				<h2 className="text-lg font-bold">İçerik hazırlanıyor</h2>
				<p className="mt-1 text-fg-muted">
					Konu özetleri ve sorular eklendikçe burada çalışma önerin görünecek.
				</p>
			</Card>
		);
	}

	const targetProgress = byTopic.get(target.topicId);
	const isWeak = weak[0]?.topicId === target.topicId;

	const showsMastery =
		targetProgress !== undefined && targetProgress.questionsAttempted > 0;

	/*
	 * Ana sayfanın tek gradyan yüzeyi. Sayfadaki diğer her şey düz kart kalır —
	 * ikinci bir gradyan hiyerarşiyi yeniden düzleştirirdi.
	 */
	return (
		<Card
			elevation="kahraman"
			className="kahraman-yuzey belir rounded-kahraman border-transparent"
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-80">
						{isWeak ? (
							<Target aria-hidden size={16} />
						) : (
							<BookOpen aria-hidden size={16} />
						)}
						{isWeak ? "Zayıf konun" : "Kaldığın yerden devam"}
					</p>

					<h2 className="mt-2 text-2xl font-bold">{target.topicName}</h2>
					<p className="opacity-80">{target.subjectName}</p>
				</div>

				{showsMastery && (
					<ProgressRing
						value={targetProgress.masteryScore}
						label={`${target.topicName} hakimiyeti`}
						tone="gradyan"
					/>
				)}
			</div>

			{/*
			 * Halka yüzdeyi zaten yazıyor; buradaki satır ne olduğunu söylüyor.
			 * Renk tek başına anlam taşımaz kuralı gereği eşik durumu da metinde.
			 */}
			{showsMastery && (
				<p className="mt-3 text-sm opacity-80">
					Hakimiyet
					{targetProgress.masteryScore >= MASTERY_THRESHOLD
						? " — eşiği geçtin"
						: " — eşiğin altında"}
				</p>
			)}

			<ButtonLink
				href={
					isWeak
						? routes.topicTest(target.subjectId, target.topicSlug)
						: routes.topic(target.subjectId, target.topicSlug)
				}
				variant="kahraman"
				size="lg"
				block
				className="mt-5"
			>
				{isWeak ? "Tekrar çöz" : "Okumaya başla"}
				<ArrowRight aria-hidden size={20} />
			</ButtonLink>
		</Card>
	);
}
