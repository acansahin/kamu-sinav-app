"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { progressRepository } from "@/lib/repositories/progress.repository";

/** Günün çalışma özeti ve günlük hedefe göre ilerleme. */
export function TodaySummary() {
	const data = useLiveQuery(
		async () => {
			const [stats, settings] = await Promise.all([
				progressRepository.getDailyStats(1),
				progressRepository.getSettings(),
			]);
			return { today: stats.at(-1) ?? null, settings };
		},
		[],
		undefined,
	);

	if (data === undefined) {
		return <Card className="h-28 animate-pulse bg-surface-sunken" />;
	}

	const answered = data.today?.questionsAnswered ?? 0;
	const correct = data.today?.correctAnswers ?? 0;
	const goal = data.settings.dailyGoalQuestions;

	return (
		<Card>
			<div className="mb-2 flex items-baseline justify-between gap-4">
				<p className="font-semibold">Günlük hedef</p>
				<p className="text-sm tabular-nums text-fg-muted">
					{answered} / {goal} soru
				</p>
			</div>
			<ProgressBar
				value={answered}
				max={goal}
				label={`Günlük hedef: ${answered} / ${goal} soru`}
				tone={answered >= goal ? "correct" : "brand"}
			/>
			<p className="mt-3 text-sm text-fg-muted">
				{answered === 0
					? "Bugün henüz soru çözmedin."
					: `Bugün ${answered} soru çözdün, ${correct} tanesi doğru.`}
			</p>
		</Card>
	);
}
