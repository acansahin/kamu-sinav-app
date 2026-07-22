"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Card, SectionHeading } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from "@/types/content";
import type { AttemptContext } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

const ACTIVITY_DAYS = 28;

const CONTEXT_LABELS: Record<AttemptContext, string> = {
	practice: "Konu testi",
	exam: "Deneme sınavı",
	review: "Tekrar",
};

export function StatisticsPanel({
	subjectNames,
}: {
	subjectNames: Record<string, string>;
}) {
	const stats = useLiveQuery(
		() => progressRepository.getStatistics(ACTIVITY_DAYS),
		[],
		undefined,
	);

	if (stats === undefined) {
		return (
			<div className="space-y-3">
				<Card className="h-24 animate-pulse bg-surface-sunken" />
				<Card className="h-48 animate-pulse bg-surface-sunken" />
			</div>
		);
	}

	if (stats.totalAttempts === 0) {
		return (
			<Card className="text-center">
				<TrendingUp aria-hidden size={28} className="mx-auto text-fg-subtle" />
				<p className="mt-3 font-semibold">Henüz istatistik yok</p>
				<p className="mt-1 text-sm text-fg-muted">
					Soru çözdükçe buradaki grafikler dolmaya başlar.
				</p>
				<Link
					href="/testler"
					className="mt-4 inline-block font-medium text-brand underline"
				>
					Test çözmeye başla
				</Link>
			</Card>
		);
	}

	const accuracy = stats.totalCorrect / stats.totalAttempts;
	const peak = Math.max(...stats.activity.map((d) => d.answered), 1);

	return (
		<div className="space-y-8">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<Card className="text-center">
					<p className="text-2xl font-bold tabular-nums">{stats.totalAttempts}</p>
					<p className="text-sm text-fg-muted">Toplam cevap</p>
				</Card>
				<Card className="text-center">
					<p className="text-2xl font-bold tabular-nums">
						%{Math.round(accuracy * 100)}
					</p>
					<p className="text-sm text-fg-muted">Doğruluk</p>
				</Card>
				<Card className="col-span-2 text-center sm:col-span-1">
					<p className="flex items-center justify-center gap-1.5 text-2xl font-bold tabular-nums">
						<Flame
							aria-hidden
							size={22}
							className={stats.streakDays > 0 ? "text-flag" : "text-fg-subtle"}
						/>
						{stats.streakDays}
					</p>
					<p className="text-sm text-fg-muted">Günlük seri</p>
				</Card>
			</div>

			<section>
				<SectionHeading>Son {ACTIVITY_DAYS} gün</SectionHeading>
				{/*
				 * Yükseklikler oransal; her sütunun başlığında (title) tam sayı var.
				 * Grafik tek başına anlam taşımasın diye altında toplam da yazıyor.
				 */}
				<Card>
					<ul className="flex h-28 items-end gap-1">
						{stats.activity.map((day) => {
							const height = day.answered === 0 ? 4 : (day.answered / peak) * 100;
							const label = new Date(day.date).toLocaleDateString("tr-TR", {
								day: "numeric",
								month: "long",
							});
							return (
								<li
									key={day.date}
									className="flex-1"
									title={`${label}: ${day.answered} soru`}
								>
									<div
										className={cn(
											"w-full rounded-sm",
											day.answered === 0 ? "bg-surface-sunken" : "bg-brand",
										)}
										style={{ height: `${height}%` }}
									/>
									<span className="sr-only">
										{label}: {day.answered} soru
									</span>
								</li>
							);
						})}
					</ul>
					<p className="mt-3 text-sm text-fg-muted">
						Bu dönemde{" "}
						<strong className="font-semibold text-fg">
							{stats.activity.reduce((sum, d) => sum + d.answered, 0)}
						</strong>{" "}
						soru çözdün. En yoğun gün: {peak} soru.
					</p>
				</Card>
			</section>

			<section>
				<SectionHeading>Ders bazlı doğruluk</SectionHeading>
				<ul className="space-y-3">
					{stats.bySubject
						.slice()
						.sort((a, b) => b.total - a.total)
						.map((row) => {
							const rate = row.correct / row.total;
							return (
								<li key={row.subjectId}>
									<Card>
										<div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
											<h3 className="font-semibold">
												{subjectNames[row.subjectId] ?? row.subjectId}
											</h3>
											<p className="text-sm tabular-nums text-fg-muted">
												{row.correct} / {row.total} · %{Math.round(rate * 100)}
											</p>
										</div>
										<ProgressBar
											value={rate * 100}
											label={`${subjectNames[row.subjectId] ?? row.subjectId} doğruluk oranı`}
											tone={rate >= 0.6 ? "correct" : "wrong"}
										/>
									</Card>
								</li>
							);
						})}
				</ul>
			</section>

			<section>
				<SectionHeading>Zorluk bazlı performans</SectionHeading>
				<Card>
					<ul className="space-y-4">
						{DIFFICULTY_ORDER.map((level) => {
							const row = stats.byDifficulty.find((d) => d.difficulty === level);
							if (!row) return null;
							const rate = row.correct / row.total;
							return (
								<li key={level}>
									<div className="mb-1.5 flex items-baseline justify-between gap-2">
										<span className="font-medium">
											{DIFFICULTY_LABELS[level].label}
										</span>
										<span className="text-sm tabular-nums text-fg-muted">
											{row.correct} / {row.total} · %{Math.round(rate * 100)}
										</span>
									</div>
									<ProgressBar
										value={rate * 100}
										label={`${DIFFICULTY_LABELS[level].label} doğruluk oranı`}
										tone={rate >= 0.6 ? "correct" : "wrong"}
									/>
								</li>
							);
						})}
					</ul>
				</Card>
			</section>

			<section>
				<SectionHeading>Nerede çözdün?</SectionHeading>
				<div className="grid gap-3 sm:grid-cols-3">
					{stats.byContext.map((row) => (
						<Card key={row.context} className="text-center">
							<p className="text-xl font-bold tabular-nums">{row.total}</p>
							<p className="text-sm text-fg-muted">
								{CONTEXT_LABELS[row.context]}
							</p>
							<p className="mt-1 text-sm tabular-nums text-fg-subtle">
								%{Math.round((row.correct / row.total) * 100)} doğru
							</p>
						</Card>
					))}
				</div>
			</section>
		</div>
	);
}
