"use client";

import type { Question } from "@/types/content";
import type { AnswerIndex } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

/**
 * Soru navigatörü.
 *
 * Gerçek sınav kâğıdındaki "hangi soruyu boş bıraktım" görünümünü taklit eder.
 * Durum yalnızca renkle değil, ayrıca `aria-label` metniyle ve işaretlilerdeki
 * köşe göstergesiyle de belirtilir — renk körlüğü ve yüksek kontrast modu için.
 */
export function ExamNavigator({
	questions,
	answers,
	flagged,
	current,
	onJump,
}: {
	questions: Question[];
	answers: Record<string, AnswerIndex | null>;
	flagged: string[];
	current: number;
	onJump: (index: number) => void;
}) {
	const flaggedSet = new Set(flagged);

	return (
		<nav aria-label="Soru navigatörü">
			<ul className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
				{questions.map((question, index) => {
					const answered = answers[question.id] != null;
					const isFlagged = flaggedSet.has(question.id);
					const isCurrent = index === current;

					const state = isCurrent
						? "aktif"
						: isFlagged
							? "işaretli"
							: answered
								? "cevaplandı"
								: "boş";

					return (
						<li key={question.id}>
							<button
								type="button"
								onClick={() => onJump(index)}
								aria-current={isCurrent ? "true" : undefined}
								aria-label={`Soru ${index + 1}, ${state}`}
								className={cn(
									"relative flex size-full min-h-11 items-center justify-center rounded-lg border-2 text-sm font-semibold tabular-nums transition-colors",
									isCurrent && "border-brand bg-brand text-brand-fg",
									!isCurrent &&
										isFlagged &&
										"border-flag bg-flag-soft text-flag",
									!isCurrent &&
										!isFlagged &&
										answered &&
										"border-correct bg-correct-soft text-correct",
									!isCurrent &&
										!isFlagged &&
										!answered &&
										"border-line bg-surface-raised text-fg-muted",
								)}
							>
								{index + 1}
								{isFlagged && (
									<span
										aria-hidden
										className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-flag"
									/>
								)}
							</button>
						</li>
					);
				})}
			</ul>

			<ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
				<li className="flex items-center gap-1.5">
					<span aria-hidden className="size-3 rounded border-2 border-correct bg-correct-soft" />
					Cevaplandı
				</li>
				<li className="flex items-center gap-1.5">
					<span aria-hidden className="size-3 rounded border-2 border-flag bg-flag-soft" />
					İşaretli
				</li>
				<li className="flex items-center gap-1.5">
					<span aria-hidden className="size-3 rounded border-2 border-line bg-surface-raised" />
					Boş
				</li>
			</ul>
		</nav>
	);
}
