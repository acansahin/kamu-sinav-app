"use client";

import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	RotateCcw,
	Scale,
	Trophy,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { QuestionCard } from "@/features/quiz/question-card";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import {
	PASSING_SCORE,
	computeTestResult,
	isPassing,
} from "@/lib/scoring/test-result";
import {
	type DifficultyFilter,
	selectQuestions,
} from "@/lib/selector/question-selector";
import {
	DIFFICULTY_LABELS,
	DIFFICULTY_ORDER,
	type Difficulty,
	type Question,
} from "@/types/content";
import { type AnswerIndex, LOCAL_USER_ID, type TestResult } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

type Phase = "setup" | "running" | "result";

interface Props {
	subjectId: string;
	subjectName: string;
	topicId: string;
	topicSlug: string;
	topicName: string;
	/** Konunun yayımlanmış soru havuzunun tamamı (derleme zamanında gömülür). */
	pool: Question[];
}

const COUNT_CHOICES = [5, 10, 20] as const;

/**
 * Konu testi motoru.
 *
 * Kurulum, çözme ve sonuç tek rotada tutulur. Sebebi teknik: uygulama tam
 * statik üretiliyor (Capacitor kısıtı), dolayısıyla `/sonuc/[oturumId]` gibi
 * çalışma anında doğan bir rota önceden üretilemez. Oturum durumu bileşende,
 * kalıcı kayıt Dexie'de tutulur.
 */
export function QuizRunner({
	subjectId,
	subjectName,
	topicId,
	topicSlug,
	topicName,
	pool,
}: Props) {
	const [phase, setPhase] = useState<Phase>("setup");
	const [difficulty, setDifficulty] = useState<DifficultyFilter>("karisik");
	const [requestedCount, setRequestedCount] = useState<number>(10);
	const [instantFeedback, setInstantFeedback] = useState(true);

	const [questions, setQuestions] = useState<Question[]>([]);
	const [answers, setAnswers] = useState<Record<string, AnswerIndex | null>>({});
	const [revealed, setRevealed] = useState<Record<string, boolean>>({});
	const [current, setCurrent] = useState(0);
	const [sessionId, setSessionId] = useState("");
	const [startedAt, setStartedAt] = useState(0);
	const [result, setResult] = useState<TestResult | null>(null);

	const availableByDifficulty = useMemo(() => {
		const counts = Object.fromEntries(
			DIFFICULTY_ORDER.map((level) => [level, 0]),
		) as Record<Difficulty, number>;
		for (const question of pool) counts[question.difficulty] += 1;
		return counts;
	}, [pool]);

	const availableForChoice =
		difficulty === "karisik" ? pool.length : availableByDifficulty[difficulty];
	const effectiveCount = Math.min(requestedCount, availableForChoice);

	const start = useCallback(async () => {
		const id = globalThis.crypto.randomUUID();
		const picked = selectQuestions({
			pool,
			difficulty,
			count: requestedCount,
			seed: id,
		});
		if (picked.length === 0) return;

		setSessionId(id);
		setQuestions(picked);
		setAnswers(Object.fromEntries(picked.map((q) => [q.id, null])));
		setRevealed({});
		setCurrent(0);
		setStartedAt(Date.now());
		setPhase("running");

		await progressRepository.createTestSession({
			id,
			userId: LOCAL_USER_ID,
			kind: "topic-test",
			subjectId,
			topicId,
			difficulty,
			questionIds: picked.map((q) => q.id),
			answers: {},
			status: "in-progress",
			startedAt: new Date().toISOString(),
		});
	}, [pool, difficulty, requestedCount, subjectId, topicId]);

	const question = questions[current];
	const isRevealed = question ? (revealed[question.id] ?? false) : false;
	const answeredCount = Object.values(answers).filter((a) => a !== null).length;

	const select = useCallback(
		(value: AnswerIndex) => {
			if (!question || isRevealed) return;
			setAnswers((prev) => ({ ...prev, [question.id]: value }));
			if (instantFeedback) {
				setRevealed((prev) => ({ ...prev, [question.id]: true }));
			}
		},
		[question, isRevealed, instantFeedback],
	);

	const finish = useCallback(async () => {
		const answered = questions.map((q) => ({
			question: q,
			selectedIndex: answers[q.id] ?? null,
		}));
		const computed = computeTestResult(
			sessionId,
			answered,
			Date.now() - startedAt,
		);
		setResult(computed);
		setPhase("result");

		await progressRepository.recordAttempts(
			answered.map(({ question: q, selectedIndex }) => ({
				questionId: q.id,
				subjectId: q.subjectId,
				topicId: q.topicId,
				difficulty: q.difficulty,
				selectedIndex,
				isCorrect: selectedIndex === q.correctIndex,
				// Oturum süresini sorulara eşit dağıtmak bir yaklaşıklıktır;
				// soru başına ölçüm Faz 2'de aralıklı tekrarla birlikte gelecek.
				durationMs: Math.round((Date.now() - startedAt) / questions.length),
				context: "practice" as const,
				sessionId,
			})),
		);
		await progressRepository.completeTestSession(
			sessionId,
			Object.fromEntries(
				answered.map(({ question: q, selectedIndex }) => [q.id, selectedIndex]),
			),
			computed.score,
		);
	}, [questions, answers, sessionId, startedAt]);

	const goNext = useCallback(() => {
		if (current < questions.length - 1) setCurrent((c) => c + 1);
		else void finish();
	}, [current, questions.length, finish]);

	// Klavye kısayolları: 1-4 şık seçer, ok tuşları soru değiştirir.
	useEffect(() => {
		if (phase !== "running") return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement) return;
			if (["1", "2", "3", "4"].includes(event.key)) {
				select((Number(event.key) - 1) as AnswerIndex);
			} else if (event.key === "ArrowRight") {
				goNext();
			} else if (event.key === "ArrowLeft" && current > 0) {
				setCurrent((c) => c - 1);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [phase, select, goNext, current]);

	// --- Kurulum -------------------------------------------------------------
	if (phase === "setup") {
		return (
			<div>
				<p className="text-sm text-fg-muted">{subjectName}</p>
				<h1 className="mb-6 text-2xl font-bold">{topicName} — Test</h1>

				<Card>
					<fieldset>
						<legend className="mb-3 font-semibold">Zorluk seviyesi</legend>
						<div className="grid gap-2 sm:grid-cols-2">
							{(["karisik", ...DIFFICULTY_ORDER] as DifficultyFilter[]).map(
								(level) => {
									const count =
										level === "karisik"
											? pool.length
											: availableByDifficulty[level];
									const disabled = count === 0;
									const selected = difficulty === level;

									return (
										<label
											key={level}
											className={cn(
												"flex min-h-14 items-center gap-3 rounded-xl border-2 p-3",
												disabled
													? "cursor-not-allowed border-line opacity-50"
													: "cursor-pointer",
												selected && !disabled
													? "border-brand bg-brand-soft"
													: "border-line bg-surface-raised",
											)}
										>
											<input
												type="radio"
												name="difficulty"
												checked={selected}
												disabled={disabled}
												onChange={() => setDifficulty(level)}
												className="size-5 accent-[var(--brand)]"
											/>
											<span className="flex-1">
												<span className="block font-semibold">
													{level === "karisik"
														? "Karışık"
														: DIFFICULTY_LABELS[level].label}
												</span>
												<span className="block text-sm text-fg-muted">
													{level === "karisik"
														? "Tüm seviyelerden"
														: DIFFICULTY_LABELS[level].description}
												</span>
											</span>
											<span className="text-sm font-medium text-fg-subtle">
												{count} soru
											</span>
										</label>
									);
								},
							)}
						</div>
					</fieldset>

					<fieldset className="mt-6">
						<legend className="mb-3 font-semibold">Soru sayısı</legend>
						<div className="flex flex-wrap gap-2">
							{COUNT_CHOICES.map((choice) => (
								<label
									key={choice}
									className={cn(
										"secim-etiketi flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-4",
										requestedCount === choice
											? "border-brand bg-brand-soft font-semibold"
											: "border-line bg-surface-raised",
									)}
								>
									<input
										type="radio"
										name="count"
										checked={requestedCount === choice}
										onChange={() => setRequestedCount(choice)}
										className="sr-only"
									/>
									{choice} soru
								</label>
							))}
						</div>
						{effectiveCount < requestedCount && (
							<p className="mt-2 text-sm text-flag">
								Bu seçimde havuzda {availableForChoice} soru var; test{" "}
								{effectiveCount} soruyla açılacak.
							</p>
						)}
					</fieldset>

					<label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							checked={instantFeedback}
							onChange={(e) => setInstantFeedback(e.target.checked)}
							className="size-5 accent-[var(--brand)]"
						/>
						<span>
							<span className="block font-medium">Anında geri bildirim</span>
							<span className="block text-sm text-fg-muted">
								Kapalıysa doğru cevaplar testin sonunda gösterilir.
							</span>
						</span>
					</label>

					<Button
						size="lg"
						block
						className="mt-6"
						onClick={() => void start()}
						disabled={effectiveCount === 0}
					>
						Testi başlat
					</Button>
				</Card>
			</div>
		);
	}

	// --- Çözme ---------------------------------------------------------------
	if (phase === "running" && question) {
		const isLast = current === questions.length - 1;
		const canAdvance = instantFeedback ? isRevealed : true;

		return (
			<div>
				<div className="mb-5">
					<ProgressBar
						value={current + 1}
						max={questions.length}
						label={`Test ilerlemesi: ${current + 1} / ${questions.length}`}
					/>
					<p className="mt-2 text-sm text-fg-muted">
						{answeredCount} / {questions.length} cevaplandı
					</p>
				</div>

				<Card>
					<QuestionCard
						question={question}
						index={current}
						total={questions.length}
						selectedIndex={answers[question.id] ?? null}
						onSelect={select}
						revealed={isRevealed}
					/>
				</Card>

				<div className="mt-4 flex items-center gap-3">
					<Button
						variant="secondary"
						onClick={() => setCurrent((c) => Math.max(0, c - 1))}
						disabled={current === 0}
					>
						<ArrowLeft aria-hidden size={18} />
						Önceki
					</Button>

					<Button className="flex-1" onClick={goNext} disabled={!canAdvance}>
						{isLast ? "Testi bitir" : "Sonraki"}
						{!isLast && <ArrowRight aria-hidden size={18} />}
					</Button>
				</div>

				<p className="mt-3 text-center text-sm text-fg-subtle">
					Klavye: <kbd>1</kbd>–<kbd>4</kbd> şık seçer, <kbd>←</kbd> <kbd>→</kbd>{" "}
					soru değiştirir.
				</p>
			</div>
		);
	}

	// --- Sonuç ---------------------------------------------------------------
	if (phase === "result" && result) {
		const passed = isPassing(result.score);
		const wrongQuestions = questions.filter((q) =>
			result.wrongQuestionIds.includes(q.id),
		);

		return (
			<div>
				<h1 className="mb-1 text-2xl font-bold">Test sonucu</h1>
				<p className="mb-6 text-fg-muted">
					{subjectName} · {topicName}
				</p>

				<Card
					className={cn(
						"text-center",
						passed
							? "border-correct/40 bg-correct-soft"
							: "border-flag/40 bg-flag-soft",
					)}
				>
					<Trophy
						aria-hidden
						size={32}
						className={cn("mx-auto", passed ? "text-correct" : "text-flag")}
					/>
					<p className="mt-2 text-4xl font-bold tabular-nums">{result.score}</p>
					<p className="text-fg-muted">100 üzerinden puan</p>
					<p
						className={cn(
							"mt-3 font-semibold",
							passed ? "text-correct" : "text-flag",
						)}
					>
						{passed
							? `Başarı eşiğini (${PASSING_SCORE}) geçtin`
							: `Başarı eşiği ${PASSING_SCORE} — biraz daha çalışman gerek`}
					</p>
				</Card>

				<div className="mt-4 grid grid-cols-3 gap-3">
					<Card className="text-center">
						<p className="text-2xl font-bold text-correct tabular-nums">
							{result.correct}
						</p>
						<p className="text-sm text-fg-muted">Doğru</p>
					</Card>
					<Card className="text-center">
						<p className="text-2xl font-bold text-wrong tabular-nums">
							{result.wrong}
						</p>
						<p className="text-sm text-fg-muted">Yanlış</p>
					</Card>
					<Card className="text-center">
						<p className="text-2xl font-bold text-fg-subtle tabular-nums">
							{result.empty}
						</p>
						<p className="text-sm text-fg-muted">Boş</p>
					</Card>
				</div>

				{wrongQuestions.length > 0 && (
					<section className="mt-8">
						<h2 className="mb-3 text-xl font-bold">
							Yanlış ve boş bıraktıkların
						</h2>
						<div className="space-y-4">
							{wrongQuestions.map((q, index) => (
								<Card key={q.id}>
									<QuestionCard
										question={q}
										index={index}
										total={wrongQuestions.length}
										selectedIndex={answers[q.id] ?? null}
										onSelect={() => undefined}
										revealed
									/>
								</Card>
							))}
						</div>
					</section>
				)}

				<div className="mt-8 flex flex-col gap-3 sm:flex-row">
					<Button
						variant="secondary"
						className="flex-1"
						onClick={() => setPhase("setup")}
					>
						<RotateCcw aria-hidden size={18} />
						Yeni test
					</Button>
					<ButtonLink
						href={routes.topic(subjectId, topicSlug)}
						variant="secondary"
						className="flex-1"
					>
						<BookOpen aria-hidden size={18} />
						Konu özetine dön
					</ButtonLink>
					<ButtonLink href="/ilerleme" className="flex-1">
						<Scale aria-hidden size={18} />
						İlerlememi gör
					</ButtonLink>
				</div>

				<p className="mt-6 text-center text-sm text-fg-subtle">
					<Link href="/testler" className="underline hover:text-fg">
						Başka bir konuyu test et
					</Link>
				</p>
			</div>
		);
	}

	return null;
}
