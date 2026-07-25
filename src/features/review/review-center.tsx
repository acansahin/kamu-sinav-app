"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, CalendarClock, CheckCheck, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { QuestionCard } from "@/features/quiz/question-card";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import { describeInterval } from "@/lib/scheduler/sm2";
import type { Question } from "@/types/content";
import { type AnswerIndex } from "@/types/progress";
import type { TopicRef } from "@/types/ui";
import { cn } from "@/lib/utils/cn";

/** Tek oturumda çözülecek en fazla tekrar sayısı. */
const SESSION_LIMIT = 20;

type Phase = "overview" | "session" | "done";

/**
 * Tekrar merkezi.
 *
 * "Yanlışlarım" listesi elle yönetilen bir kuyruk değildir: her cevap SM-2
 * zamanlayıcısını besler, doğru bilinen soru uzun aralığa itilir, unutulan
 * ertesi gün geri gelir. Kullanıcı ne çalışacağına karar vermek zorunda kalmaz.
 */
export function ReviewCenter({
	pool,
	topics,
}: {
	pool: Question[];
	topics: TopicRef[];
}) {
	const [phase, setPhase] = useState<Phase>("overview");
	const [queue, setQueue] = useState<Question[]>([]);
	const [current, setCurrent] = useState(0);
	const [selected, setSelected] = useState<AnswerIndex | null>(null);
	const [revealed, setRevealed] = useState(false);
	const [startedAt, setStartedAt] = useState(0);
	const [correctCount, setCorrectCount] = useState(0);
	const [sessionId, setSessionId] = useState("");

	const byId = useMemo(() => new Map(pool.map((q) => [q.id, q])), [pool]);
	const topicById = useMemo(
		() => new Map(topics.map((t) => [t.topicId, t])),
		[topics],
	);

	const summary = useLiveQuery(
		() => progressRepository.getReviewSummary(),
		[],
		undefined,
	);
	const struggling = useLiveQuery(
		() => progressRepository.getStrugglingReviews(8),
		[],
		undefined,
	);
	const mistakes = useLiveQuery(
		() => progressRepository.getRecentMistakes(SESSION_LIMIT),
		[],
		undefined,
	);

	const beginSession = useCallback((questions: Question[]) => {
		if (questions.length === 0) return;

		setQueue(questions);
		setCurrent(0);
		setSelected(null);
		setRevealed(false);
		setCorrectCount(0);
		setSessionId(globalThis.crypto.randomUUID());
		setStartedAt(Date.now());
		setPhase("session");
	}, []);

	const startDue = useCallback(async () => {
		const due = await progressRepository.getDueReviews(SESSION_LIMIT);
		beginSession(
			due
				.map((entry) => byId.get(entry.questionId))
				.filter((q): q is Question => q !== undefined),
		);
	}, [byId, beginSession]);

	/**
	 * Zamanlayıcıyı beklemeden yanlışları çözme.
	 *
	 * SM-2'nin en kısa aralığı bir gündür, dolayısıyla az önce yanlış yapılan
	 * soru "bugün vadesi gelenler" listesine girmez. Kullanıcının hatalarını
	 * hemen çözme isteği ayrı bir ihtiyaçtır ve engellenmemelidir.
	 */
	const startMistakes = useCallback(async () => {
		const mistakes = await progressRepository.getRecentMistakes(SESSION_LIMIT);
		beginSession(
			mistakes
				.map((attempt) => byId.get(attempt.questionId))
				.filter((q): q is Question => q !== undefined),
		);
	}, [byId, beginSession]);

	const question = queue[current];

	const answer = useCallback(
		async (value: AnswerIndex) => {
			if (!question || revealed) return;

			const isCorrect = value === question.correctIndex;
			setSelected(value);
			setRevealed(true);
			if (isCorrect) setCorrectCount((c) => c + 1);

			// Süre soru bazında ölçülür; SM-2 notu buna göre türetilir.
			await progressRepository.recordAttempt({
				questionId: question.id,
				subjectId: question.subjectId,
				topicId: question.topicId,
				difficulty: question.difficulty,
				selectedIndex: value,
				isCorrect,
				durationMs: Date.now() - startedAt,
				context: "review",
				sessionId,
			});
		},
		[question, revealed, startedAt, sessionId],
	);

	const advance = useCallback(() => {
		if (current < queue.length - 1) {
			setCurrent((c) => c + 1);
			setSelected(null);
			setRevealed(false);
			setStartedAt(Date.now());
		} else {
			setPhase("done");
		}
	}, [current, queue.length]);

	/*
	 * Klavye kısayolları test ve deneme motorlarıyla aynı olmak zorunda:
	 * kullanıcı 1-5 tuşunu testte öğrenip tekrarda ölü bulmamalı.
	 * Şık seçiliyken ok tuşu sonraki soruya geçer.
	 */
	useEffect(() => {
		if (phase !== "session") return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement) return;
			if (["1", "2", "3", "4", "5"].includes(event.key)) {
				// Sınır kontrolü: 4 şıklı soruda "5" olmayan şıkkı seçmemeli.
				const optionIndex = Number(event.key) - 1;
				if (optionIndex < (question?.options.length ?? 0)) {
					void answer(optionIndex as AnswerIndex);
				}
			} else if (event.key === "ArrowRight" && revealed) {
				advance();
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [phase, answer, advance, revealed, question]);

	// --- Oturum ---------------------------------------------------------------
	if (phase === "session" && question) {
		return (
			<div>
				<div className="mb-5">
					<ProgressBar
						value={current + 1}
						max={queue.length}
						label={`Tekrar ilerlemesi: ${current + 1} / ${queue.length}`}
					/>
					<p className="mt-2 text-sm text-fg-muted">
						Tekrar {current + 1} / {queue.length}
					</p>
				</div>

				<Card>
					<QuestionCard
						question={question}
						index={current}
						total={queue.length}
						selectedIndex={selected}
						onSelect={(value) => void answer(value)}
						revealed={revealed}
					/>
				</Card>

				<Button block size="lg" className="mt-4" onClick={advance} disabled={!revealed}>
					{current === queue.length - 1 ? "Tekrarı bitir" : "Sonraki"}
					<ArrowRight aria-hidden size={20} />
				</Button>

				<p className="mt-3 text-center text-sm text-fg-subtle">
					{revealed ? (
						<>
							Klavye: <kbd>→</kbd> sonraki soru.
						</>
					) : (
						<>
							Devam etmek için bir şık seç. Klavye: <kbd>1</kbd>–<kbd>4</kbd>.
						</>
					)}
				</p>
			</div>
		);
	}

	// --- Oturum sonu ----------------------------------------------------------
	if (phase === "done") {
		return (
			<div>
				<Card className="border-correct/40 bg-correct-soft text-center">
					<CheckCheck aria-hidden size={32} className="mx-auto text-correct" />
					<p className="mt-2 text-2xl font-bold">Tekrar tamamlandı</p>
					<p className="mt-1 text-fg-muted">
						{queue.length} soruda {correctCount} doğru
					</p>
					<p className="mt-3 text-sm text-fg-muted">
						Doğru bildiklerin daha uzun aralıklarla, zorlandıkların yakın
						zamanda tekrar karşına çıkacak.
					</p>
				</Card>

				<div className="mt-6 flex flex-col gap-3 sm:flex-row">
					<Button
						variant="secondary"
						className="flex-1"
						onClick={() => setPhase("overview")}
					>
						<RotateCcw aria-hidden size={18} />
						Tekrar merkezine dön
					</Button>
					<ButtonLink href="/ilerleme" className="flex-1">
						İlerlememi gör
					</ButtonLink>
				</div>
			</div>
		);
	}

	// --- Genel görünüm --------------------------------------------------------
	if (
		summary === undefined ||
		struggling === undefined ||
		mistakes === undefined
	) {
		return <Card className="h-40 animate-pulse bg-surface-sunken" />;
	}

	if (summary.tracked === 0) {
		return (
			<Card className="text-center">
				<CalendarClock aria-hidden size={28} className="mx-auto text-fg-subtle" />
				<p className="mt-3 font-semibold">Henüz tekrar edilecek soru yok</p>
				<p className="mt-1 text-sm text-fg-muted">
					Bir test veya deneme çözdüğünde sorular otomatik olarak tekrar planına
					girer. Doğru bildiklerin seyrekleşir, zorlandıkların sık sık geri gelir.
				</p>
				<ButtonLink href="/testler" className="mt-4">
					Test çözmeye başla
				</ButtonLink>
			</Card>
		);
	}

	return (
		<div className="space-y-8">
			<Card
				className={cn(
					summary.due > 0 && "border-brand/40 bg-brand-soft",
				)}
			>
				<div className="flex flex-wrap items-baseline justify-between gap-3">
					<div>
						<p className="text-3xl font-bold tabular-nums">{summary.due}</p>
						<p className="text-fg-muted">bugün tekrar edilecek soru</p>
					</div>
					<Badge>{summary.tracked} soru takipte</Badge>
				</div>

				{summary.due > 0 ? (
					<Button
						size="lg"
						block
						className="mt-5"
						onClick={() => void startDue()}
					>
						Tekrara başla
						{summary.due > SESSION_LIMIT && ` (ilk ${SESSION_LIMIT})`}
						<ArrowRight aria-hidden size={20} />
					</Button>
				) : (
					<p className="mt-4 text-sm text-fg-muted">
						Bugünlük planlı tekrarın bitti.
						{summary.nextDueAt &&
							` Sıradaki tekrar ${new Date(summary.nextDueAt).toLocaleDateString(
								"tr-TR",
								{ day: "numeric", month: "long" },
							)} tarihinde.`}
					</p>
				)}
			</Card>

			{/*
			 * Planlı tekrardan ayrı bir yol: SM-2 en erken yarına randevu verdiği
			 * için az önce yanlış yapılan soru yukarıdaki sayıya girmez. Kullanıcı
			 * hatalarını beklemeden çözebilmeli.
			 */}
			{mistakes.length > 0 && (
				<Card>
					<div className="flex flex-wrap items-baseline justify-between gap-3">
						<div>
							<p className="text-2xl font-bold tabular-nums">
								{mistakes.length}
							</p>
							<p className="text-fg-muted">
								son cevabın yanlış olan soru
							</p>
						</div>
					</div>
					<p className="mt-2 text-sm text-fg-muted">
						Planı beklemeden şimdi çözebilirsin. Doğru bildiğin sorular bu
						listeden kendiliğinden çıkar.
					</p>
					<Button
						variant="secondary"
						block
						className="mt-4"
						onClick={() => void startMistakes()}
					>
						Yanlışlarımı şimdi çöz
						<ArrowRight aria-hidden size={18} />
					</Button>
				</Card>
			)}

			{struggling.length > 0 && (
				<section>
					<SectionHeading>Zorlandığın sorular</SectionHeading>
					<p className="mb-3 text-sm text-fg-muted">
						En az bir kez unuttuğun sorular. Konularına dönmek işe yarayabilir.
					</p>
					<ul className="space-y-2">
						{struggling.map((entry) => {
							const q = byId.get(entry.questionId);
							const topic = topicById.get(entry.topicId);
							if (!q) return null;

							return (
								<li key={entry.questionId}>
									<Card>
										<p className="font-medium leading-relaxed">{q.stem}</p>
										<div className="mt-2 flex flex-wrap items-center gap-2">
											<Badge tone="wrong">{entry.lapses} kez unutuldu</Badge>
											<Badge>
												Sıradaki: {describeInterval(entry.intervalDays)}
											</Badge>
											{topic && (
												<a
													href={routes.topic(topic.subjectId, topic.topicSlug)}
													className="text-sm font-medium text-brand underline"
												>
													{topic.topicName} özetine git
												</a>
											)}
										</div>
									</Card>
								</li>
							);
						})}
					</ul>
				</section>
			)}
		</div>
	);
}
