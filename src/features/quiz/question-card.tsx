"use client";

import { Check, Scale, X } from "lucide-react";
import type { Question } from "@/types/content";
import type { AnswerIndex } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

/**
 * Tek soru kartı.
 *
 * Erişilebilirlik: şıklar gerçek radio input'larıdır — ok tuşlarıyla gezinme,
 * ekran okuyucu duyurusu ve form semantiği tarayıcıdan bedava gelir. Doğru/
 * yanlış durumu renkle birlikte ikon ve metinle de belirtilir.
 */
export function QuestionCard({
	question,
	index,
	total,
	selectedIndex,
	onSelect,
	revealed,
}: {
	question: Question;
	index: number;
	total: number;
	selectedIndex: AnswerIndex | null;
	onSelect: (value: AnswerIndex) => void;
	/** true ise doğru cevap ve açıklama gösterilir. */
	revealed: boolean;
}) {
	const isCorrect = selectedIndex === question.correctIndex;

	return (
		<div>
			<p className="mb-2 text-sm font-medium text-fg-subtle">
				Soru {index + 1} / {total}
			</p>

			<fieldset disabled={revealed}>
				<legend className="mb-5 text-lg font-semibold leading-relaxed text-fg">
					{question.stem}
				</legend>

				<div className="space-y-2.5">
					{question.options.map((option, optionIndex) => {
						const value = optionIndex as AnswerIndex;
						const selected = selectedIndex === value;
						const isAnswer = question.correctIndex === value;

						const state = !revealed
							? selected
								? "selected"
								: "idle"
							: isAnswer
								? "correct"
								: selected
									? "wrong"
									: "idle";

						return (
							<label
								key={option}
								className={cn(
									"flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors",
									state === "idle" &&
										"border-line bg-surface-raised hover:border-line-strong",
									state === "selected" && "border-brand bg-brand-soft",
									state === "correct" && "border-correct bg-correct-soft",
									state === "wrong" && "border-wrong bg-wrong-soft",
									revealed && "cursor-default",
								)}
							>
								<input
									type="radio"
									name={`q-${question.id}`}
									value={optionIndex}
									checked={selected}
									onChange={() => onSelect(value)}
									className="sr-only"
								/>
								<span
									aria-hidden
									className={cn(
										"flex size-8 shrink-0 items-center justify-center rounded-lg border-2 text-base font-bold",
										state === "idle" && "border-line-strong text-fg-muted",
										state === "selected" && "border-brand bg-brand text-brand-fg",
										state === "correct" && "border-correct bg-correct text-surface-raised",
										state === "wrong" && "border-wrong bg-wrong text-surface-raised",
									)}
								>
									{OPTION_LABELS[optionIndex]}
								</span>
								<span className="flex-1 pt-0.5 leading-relaxed">{option}</span>
								{revealed && isAnswer && (
									<Check aria-label="Doğru cevap" size={20} className="mt-1 shrink-0 text-correct" />
								)}
								{revealed && state === "wrong" && (
									<X aria-label="Senin cevabın, yanlış" size={20} className="mt-1 shrink-0 text-wrong" />
								)}
							</label>
						);
					})}
				</div>
			</fieldset>

			{revealed && (
				<div
					className={cn(
						"mt-5 rounded-xl border p-4",
						isCorrect
							? "border-correct/40 bg-correct-soft"
							: "border-wrong/40 bg-wrong-soft",
					)}
				>
					<p
						className={cn(
							"mb-2 flex items-center gap-2 font-bold",
							isCorrect ? "text-correct" : "text-wrong",
						)}
					>
						{isCorrect ? <Check aria-hidden size={18} /> : <X aria-hidden size={18} />}
						{isCorrect
							? "Doğru"
							: selectedIndex === null
								? "Boş bıraktın"
								: "Yanlış"}
					</p>
					<p className="leading-relaxed text-fg">{question.explanation}</p>

					{/*
					 * Mevzuat referansı — ürünün farklılaşma tezi.
					 * Her soruda görünür olması şema düzeyinde zorunlu tutulmuştur.
					 */}
					<p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-fg-muted">
						<Scale aria-hidden size={14} className="shrink-0" />
						{question.legalRef.law}
						{question.legalRef.article && `, m. ${question.legalRef.article}`}
						{question.legalRef.clause && `/${question.legalRef.clause}`}
					</p>
				</div>
			)}
		</div>
	);
}
