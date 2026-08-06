"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
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
		return (
			<Card elevation="duz" className="h-28 animate-pulse bg-surface-sunken" />
		);
	}

	const answered = data.today?.questionsAnswered ?? 0;
	const correct = data.today?.correctAnswers ?? 0;
	const goal = data.settings.dailyGoalQuestions;
	const reached = answered >= goal;

	return (
		<Card className="flex items-center gap-5">
			{/*
			 * Halka ortasında yüzde değil çözülen SORU SAYISI durur: hedef
			 * kullanıcının kafasındaki birim soru sayısıdır, yüzde değil.
			 * Yüzdeyi `aria-valuenow` yine taşır.
			 */}
			<ProgressRing
				value={answered}
				max={goal}
				label={`Günlük hedef: ${answered} / ${goal} soru`}
				tone={reached ? "correct" : "brand"}
				display={answered}
			/>

			<div className="min-w-0">
				<p className="font-semibold">
					Günlük hedef{" "}
					<span className="font-normal tabular-nums text-fg-muted">
						{answered} / {goal} soru
					</span>
				</p>
				<p className="mt-1 text-sm text-fg-muted">
					{answered === 0
						? "Bugün henüz soru çözmedin."
						: reached
							? `Bugün ${answered} soru çözdün, ${correct} tanesi doğru. Hedefi tamamladın.`
							: `Bugün ${answered} soru çözdün, ${correct} tanesi doğru.`}
				</p>
			</div>
		</Card>
	);
}
