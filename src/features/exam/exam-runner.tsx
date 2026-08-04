"use client";

import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Clock,
	Flag,
	RotateCcw,
	Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ExamNavigator } from "@/features/exam/exam-navigator";
import { QuestionCard } from "@/features/quiz/question-card";
import {
	type NewExamSession,
	progressRepository,
} from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import { computeExamResult, formatDuration } from "@/lib/scoring/exam-result";
import { buildExam } from "@/lib/selector/exam-selector";
import type { MockExamTemplate, Question } from "@/types/content";
import type {
	AnswerIndex,
	ExamResult,
	ExamSession,
} from "@/types/progress";
import type { TopicRef } from "@/types/ui";
import { cn } from "@/lib/utils/cn";

type Phase = "setup" | "running" | "result";

interface Props {
	templates: MockExamTemplate[];
	pool: Question[];
	subjectNames: Record<string, string>;
	topics: TopicRef[];
}

/** Durum diske bu sıklıkta yazılır; çökmede kayıp bu aralıkla sınırlı kalır. */
const AUTOSAVE_INTERVAL_MS = 5000;

/** Bu eşiklerin altına inildiğinde sakin bir uyarı gösterilir (saniye). */
const WARN_AT = [600, 60];

export function ExamRunner({ templates, pool, subjectNames, topics }: Props) {
	const [phase, setPhase] = useState<Phase>("setup");
	const [session, setSession] = useState<NewExamSession | null>(null);
	const [questions, setQuestions] = useState<Question[]>([]);
	const [answers, setAnswers] = useState<Record<string, AnswerIndex | null>>({});
	const [flagged, setFlagged] = useState<string[]>([]);
	const [current, setCurrent] = useState(0);
	const [remaining, setRemaining] = useState(0);
	const [confirming, setConfirming] = useState(false);
	const [result, setResult] = useState<ExamResult | null>(null);
	/** Sonuç hesaplandı ama kalıcı olarak yazılamadı mı? */
	const [saveFailed, setSaveFailed] = useState(false);
	const [resumable, setResumable] = useState<ExamSession | null>(null);

	const questionsById = useMemo(
		() => new Map(pool.map((q) => [q.id, q])),
		[pool],
	);
	const topicNames = useMemo(
		() => new Map(topics.map((t) => [t.topicId, t])),
		[topics],
	);

	// Şablonların çözülebilirliği havuza bağlıdır; içerik doldukça değişir.
	const buildable = useMemo(
		() =>
			templates.map((template) => ({
				template,
				shortfalls: buildExam(template, pool, "probe").shortfalls,
			})),
		[templates, pool],
	);

	// Yarıda kalmış sınav var mı?
	useEffect(() => {
		void progressRepository.getResumableExamSession().then(setResumable);
	}, []);

	const startSession = useCallback(
		(newSession: NewExamSession, orderedQuestions: Question[]) => {
			setSession(newSession);
			setQuestions(orderedQuestions);
			setAnswers(newSession.answers);
			setFlagged(newSession.flagged);
			setRemaining(newSession.remainingSeconds);
			setCurrent(0);
			setPhase("running");
		},
		[],
	);

	const start = useCallback(
		async (template: MockExamTemplate) => {
			const id = globalThis.crypto.randomUUID();
			const { questions: picked } = buildExam(template, pool, id);
			if (picked.length === 0) return;

			const newSession: NewExamSession = {
				id,
				templateId: template.id,
				templateName: template.name,
				questionIds: picked.map((q) => q.id),
				answers: Object.fromEntries(picked.map((q) => [q.id, null])),
				flagged: [],
				status: "in-progress",
				startedAt: new Date().toISOString(),
				durationSeconds: template.durationSeconds,
				remainingSeconds: template.durationSeconds,
				passingScore: template.passingScore,
			};

			await progressRepository.createExamSession(newSession);
			startSession(newSession, picked);
		},
		[pool, startSession],
	);

	const resume = useCallback(
		(saved: ExamSession) => {
			// Soru sırası oturumda saklı; havuzdan aynı sırayla geri kurulur.
			const restored = saved.questionIds
				.map((id) => questionsById.get(id))
				.filter((q): q is Question => q !== undefined);

			if (restored.length !== saved.questionIds.length) {
				// İçerik güncellenmiş ve sorular değişmiş olabilir; bu oturum kurtarılamaz.
				void progressRepository.abandonExamSession(saved.id);
				setResumable(null);
				return;
			}
			startSession(saved, restored);
		},
		[questionsById, startSession],
	);

	const finish = useCallback(
		async (currentAnswers: Record<string, AnswerIndex | null>) => {
			if (!session) return;

			const answered = questions.map((q) => ({
				question: q,
				selectedIndex: currentAnswers[q.id] ?? null,
			}));
			const elapsedMs = (session.durationSeconds - remaining) * 1000;
			const computed = computeExamResult(
				answered,
				elapsedMs,
				session.passingScore,
				subjectNames,
			);

			setResult(computed);
			setPhase("result");

			/*
			 * Yazma başarısız olsa bile sonuç ekranda kalır — iki saatlik bir deneme
			 * sınavının çıktısı bir depolama hatası yüzünden silinemez. Ama hata
			 * yutulmaz: sessiz kalırsa kullanıcı sonucun kaydedildiğini sanır ve
			 * ilerleme ekranında bulamayınca nedenini anlayamaz.
			 */
			try {
				await progressRepository.recordAttempts(
					answered.map(({ question: q, selectedIndex }) => ({
						questionId: q.id,
						subjectId: q.subjectId,
						topicId: q.topicId,
						difficulty: q.difficulty,
						selectedIndex,
						isCorrect: selectedIndex === q.correctIndex,
						durationMs: Math.round(elapsedMs / Math.max(1, questions.length)),
						context: "exam" as const,
						sessionId: session.id,
					})),
				);
				await progressRepository.completeExamSession(session.id, computed);
			} catch {
				setSaveFailed(true);
			}
		},
		[session, questions, remaining, subjectNames],
	);

	/*
	 * Sık değişen değerler ref'te tutulur.
	 *
	 * Bunlar doğrudan bağımlılık dizisine konursa (özellikle her saniye değişen
	 * `remaining`), aşağıdaki interval'lar her saniye yıkılıp yeniden kurulur ve
	 * 5 saniyelik otomatik kaydetme hiçbir zaman tetiklenmez — çökme kurtarma
	 * sessizce ölür. Bu hata testte yakalandı; ref'ler o yüzden burada.
	 */
	const answersRef = useRef(answers);
	const flaggedRef = useRef(flagged);
	const remainingRef = useRef(remaining);
	const finishRef = useRef(finish);

	// Senkronizasyon render sırasında değil, commit sonrasında yapılır.
	useEffect(() => {
		answersRef.current = answers;
		flaggedRef.current = flagged;
		remainingRef.current = remaining;
		finishRef.current = finish;
	}, [answers, flagged, remaining, finish]);

	/*
	 * Geri sayım tek bir interval'dır ve `finish` de ref üzerinden okunur.
	 *
	 * `finish` bağımlılık dizisine konursa (ki kendisi `remaining`'e bağlıdır)
	 * interval her saniye yıkılıp yeniden kurulur. Yeniden kurulum React'in
	 * commit'inden sonra olduğu için her turda birkaç milisaniye kayar; 30
	 * dakikalık bir sınavda bu birikerek ONLARCA SANİYE kaybettirir. Sayaç
	 * geride kalınca süre dolduğunda otomatik teslim de geç tetiklenir —
	 * yani kullanıcıya hakkı olmayan ek süre verilir.
	 */
	useEffect(() => {
		if (phase !== "running") return;

		const timer = setInterval(() => {
			setRemaining((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					void finishRef.current(answersRef.current);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [phase]);

	// Otomatik kaydetme — sekme kapanırsa kaldığı yerden devam edilebilsin.
	useEffect(() => {
		if (phase !== "running" || !session) return;

		const sessionId = session.id;
		function persist() {
			void progressRepository.saveExamProgress(sessionId, {
				answers: answersRef.current,
				flagged: flaggedRef.current,
				remainingSeconds: remainingRef.current,
			});
		}

		const save = setInterval(persist, AUTOSAVE_INTERVAL_MS);
		// Sekme kapanırken veya arka plana alınırken son durumu da yaz.
		window.addEventListener("pagehide", persist);

		return () => {
			clearInterval(save);
			window.removeEventListener("pagehide", persist);
			persist();
		};
	}, [phase, session]);

	const question = questions[current];

	const select = useCallback(
		(value: AnswerIndex) => {
			if (!question) return;
			setAnswers((prev) => ({ ...prev, [question.id]: value }));
		},
		[question],
	);

	const toggleFlag = useCallback(() => {
		if (!question) return;
		setFlagged((prev) =>
			prev.includes(question.id)
				? prev.filter((id) => id !== question.id)
				: [...prev, question.id],
		);
	}, [question]);

	// Klavye: 1-5 şık, ok tuşları soru, F işaretle.
	useEffect(() => {
		if (phase !== "running") return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement) return;
			if (["1", "2", "3", "4", "5"].includes(event.key)) {
				// Sınır kontrolü: 4 şıklı soruda "5" olmayan şıkkı seçmemeli.
				const optionIndex = Number(event.key) - 1;
				if (optionIndex < (question?.options.length ?? 0)) {
					select(optionIndex as AnswerIndex);
				}
			} else if (event.key === "ArrowRight") {
				setCurrent((c) => Math.min(questions.length - 1, c + 1));
			} else if (event.key === "ArrowLeft") {
				setCurrent((c) => Math.max(0, c - 1));
			} else if (event.key.toLowerCase() === "f") {
				toggleFlag();
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [phase, select, toggleFlag, questions.length, question]);

	// --- Kurulum -------------------------------------------------------------
	if (phase === "setup") {
		return (
			<div>
				<h1 className="mb-1 text-2xl font-bold">Deneme Sınavları</h1>
				<p className="mb-6 text-fg-muted">
					Gerçek sınav formatında, süreli. Yanlış cevap doğruyu götürmez; boş
					bırakmak ile yanlış yapmak aynı puanı verir.
				</p>

				{resumable && (
					<Card className="mb-5 border-flag/40 bg-flag-soft">
						<p className="flex items-center gap-2 font-bold text-flag">
							<AlertTriangle aria-hidden size={18} />
							Yarıda kalmış bir sınavın var
						</p>
						<p className="mt-1 text-fg">
							{resumable.templateName} · kalan süre{" "}
							{formatDuration(resumable.remainingSeconds)}
						</p>
						<div className="mt-4 flex flex-wrap gap-3">
							<Button onClick={() => resume(resumable)}>Devam et</Button>
							<Button
								variant="secondary"
								onClick={async () => {
									await progressRepository.abandonExamSession(resumable.id);
									setResumable(null);
								}}
							>
								Sil ve yeni başlat
							</Button>
						</div>
					</Card>
				)}

				<ul className="space-y-3">
					{buildable.map(({ template, shortfalls }) => {
						const solvable = shortfalls.length === 0;

						return (
							<li key={template.id}>
								<Card className={cn(!solvable && "opacity-70")}>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<h2 className="text-lg font-bold">{template.name}</h2>
											<p className="mt-1 text-sm text-fg-muted">
												{template.questionCount} soru ·{" "}
												{Math.round(template.durationSeconds / 60)} dakika ·
												başarı eşiği {template.passingScore}
											</p>
										</div>
										<Badge tone={solvable ? "brand" : "neutral"}>
											{template.examKind === "gorevde-yukselme"
												? "Görevde Yükselme"
												: "Unvan Değişikliği"}
										</Badge>
									</div>

									<ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-subtle">
										{template.distribution.map((slice) => (
											<li key={slice.subjectId}>
												{subjectNames[slice.subjectId] ?? slice.subjectId}:{" "}
												{slice.count}
											</li>
										))}
									</ul>

									{solvable ? (
										<Button
											className="mt-4"
											block
											onClick={() => void start(template)}
										>
											Sınavı başlat
										</Button>
									) : (
										<p className="mt-4 rounded-lg border border-line bg-surface-sunken p-3 text-sm text-fg-muted">
											Bu şablon için soru havuzu henüz yeterli değil:{" "}
											{shortfalls
												.map(
													(s) =>
														`${subjectNames[s.subjectId] ?? s.subjectId} ${s.available}/${s.requested}`,
												)
												.join(" · ")}
										</p>
									)}
								</Card>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}

	// --- Sınav ---------------------------------------------------------------
	if (phase === "running" && question && session) {
		const answeredCount = Object.values(answers).filter((a) => a != null).length;
		const emptyCount = questions.length - answeredCount;
		const isFlagged = flagged.includes(question.id);
		const warning = WARN_AT.find((threshold) => remaining <= threshold);

		return (
			<div>
				{/* Süre göstergesi sabittir; kullanıcı her an görebilmeli */}
				<div className="sticky top-16 z-20 -mx-4 mb-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
					<div className="flex items-center justify-between gap-4">
						<p
							className={cn(
								"flex items-center gap-2 text-xl font-bold tabular-nums",
								warning === 60 ? "text-wrong" : warning ? "text-flag" : "text-fg",
							)}
						>
							<Clock aria-hidden size={20} />
							<span aria-live="off">{formatDuration(remaining)}</span>
						</p>
						<p className="text-sm text-fg-muted">
							{answeredCount} / {questions.length} cevaplandı
						</p>
					</div>
					{warning !== undefined && (
						<p role="status" className="mt-1 text-sm text-fg-muted">
							{warning === 60
								? "Son 1 dakika. Süre bitince sınav otomatik teslim edilecek."
								: "Son 10 dakika."}
						</p>
					)}
					<ProgressBar
						className="mt-2"
						value={session.durationSeconds - remaining}
						max={session.durationSeconds}
						label="Geçen süre"
						tone={warning === 60 ? "wrong" : "brand"}
					/>
				</div>

				<Card>
					<QuestionCard
						question={question}
						index={current}
						total={questions.length}
						selectedIndex={answers[question.id] ?? null}
						onSelect={select}
						revealed={false}
					/>
				</Card>

				<div className="mt-4 flex flex-wrap items-center gap-3">
					<Button
						variant="secondary"
						onClick={() => setCurrent((c) => Math.max(0, c - 1))}
						disabled={current === 0}
					>
						<ArrowLeft aria-hidden size={18} />
						Önceki
					</Button>

					<Button
						variant="secondary"
						onClick={toggleFlag}
						aria-pressed={isFlagged}
						className={cn(isFlagged && "border-flag text-flag")}
					>
						<Flag aria-hidden size={18} />
						{isFlagged ? "İşareti kaldır" : "İşaretle"}
					</Button>

					<Button
						className="flex-1"
						onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
						disabled={current === questions.length - 1}
					>
						Sonraki
						<ArrowRight aria-hidden size={18} />
					</Button>
				</div>

				<Card className="mt-6">
					<SectionHeading>Sorular</SectionHeading>
					<ExamNavigator
						questions={questions}
						answers={answers}
						flagged={flagged}
						current={current}
						onJump={setCurrent}
					/>
				</Card>

				{confirming ? (
					<Card className="mt-6 border-flag/40 bg-flag-soft">
						<p className="font-bold text-flag">Sınavı teslim etmek üzeresin</p>
						<ul className="mt-2 space-y-1 text-fg">
							<li>{answeredCount} soru cevaplandı</li>
							{emptyCount > 0 && <li>{emptyCount} soru boş</li>}
							{flagged.length > 0 && (
								<li>{flagged.length} soru işaretli, henüz dönmedin</li>
							)}
						</ul>
						<div className="mt-4 flex flex-wrap gap-3">
							<Button onClick={() => void finish(answers)}>
								Evet, teslim et
							</Button>
							<Button variant="secondary" onClick={() => setConfirming(false)}>
								Sınava dön
							</Button>
						</div>
					</Card>
				) : (
					<Button
						variant="secondary"
						block
						className="mt-6"
						onClick={() => setConfirming(true)}
					>
						Sınavı bitir
					</Button>
				)}

				<p className="mt-3 text-center text-sm text-fg-subtle">
					Klavye: <kbd>1</kbd>–<kbd>4</kbd> şık, <kbd>←</kbd> <kbd>→</kbd> soru,{" "}
					<kbd>F</kbd> işaretle. İlerlemen otomatik kaydedilir.
				</p>
			</div>
		);
	}

	// --- Sonuç ---------------------------------------------------------------
	if (phase === "result" && result && session) {
		const wrongQuestions = questions.filter((q) =>
			result.wrongQuestionIds.includes(q.id),
		);

		return (
			<div>
				<h1 className="mb-1 text-2xl font-bold">Sınav Analizi</h1>
				<p className="mb-6 text-fg-muted">{session.templateName}</p>

				{saveFailed && (
					<div
						role="alert"
						className="mb-6 flex items-start gap-2 rounded-xl border border-flag/40 bg-flag-soft p-4"
					>
						<AlertTriangle
							aria-hidden
							size={20}
							className="mt-0.5 shrink-0 text-flag"
						/>
						<p className="text-fg">
							<strong className="font-semibold">
								Bu sınav sonucu kaydedilemedi.
							</strong>{" "}
							Aşağıdaki analiz doğru ve bu sayfada kalır, ancak ilerlemenize ve
							istatistiklerinize işlenmedi. Ayrılmadan önce sonuçlarınızı not
							almak isteyebilirsiniz.
						</p>
					</div>
				)}

				<Card
					className={cn(
						"text-center",
						result.passed
							? "border-correct/40 bg-correct-soft"
							: "border-flag/40 bg-flag-soft",
					)}
				>
					<Trophy
						aria-hidden
						size={32}
						className={cn(
							"mx-auto",
							result.passed ? "text-correct" : "text-flag",
						)}
					/>
					<p className="mt-2 text-4xl font-bold tabular-nums">{result.score}</p>
					<p className="text-fg-muted">100 üzerinden puan</p>
					<p
						className={cn(
							"mt-3 text-lg font-bold",
							result.passed ? "text-correct" : "text-flag",
						)}
					>
						{result.passed ? "Başarılı" : "Başarısız"}
					</p>
					<p className="mt-1 text-sm text-fg-muted">
						Başarı eşiği {session.passingScore} · Süre{" "}
						{formatDuration(Math.round(result.durationMs / 1000))}
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

				<section className="mt-8">
					<SectionHeading>Ders bazlı performans</SectionHeading>
					<ul className="space-y-3">
						{result.bySubject.map((subject) => (
							<li key={subject.subjectId}>
								<Card>
									<div className="mb-2 flex items-baseline justify-between gap-3">
										<h3 className="font-semibold">{subject.subjectName}</h3>
										<p className="text-sm font-semibold tabular-nums">
											{subject.correct} / {subject.total} · %
											{Math.round(subject.accuracy * 100)}
										</p>
									</div>
									<ProgressBar
										value={subject.accuracy * 100}
										label={`${subject.subjectName} doğruluk oranı`}
										tone={subject.accuracy >= 0.6 ? "correct" : "wrong"}
									/>
								</Card>
							</li>
						))}
					</ul>
				</section>

				{result.weakTopicIds.length > 0 && (
					<section className="mt-8">
						<SectionHeading>Öncelikli çalışman gerekenler</SectionHeading>
						<ul className="space-y-2">
							{result.weakTopicIds.slice(0, 5).map((topicId) => {
								const topic = topicNames.get(topicId);
								if (!topic) return null;
								return (
									<li key={topicId}>
										<Card className="flex flex-wrap items-center justify-between gap-3">
											<div>
												<h3 className="font-semibold">{topic.topicName}</h3>
												<p className="text-sm text-fg-muted">
													{topic.subjectName}
												</p>
											</div>
											<div className="flex gap-2">
												{topic.hasSummary && (
													<ButtonLink
														href={routes.topic(topic.subjectId, topic.topicSlug)}
														variant="secondary"
														size="sm"
													>
														Özeti oku
													</ButtonLink>
												)}
												{topic.questionCount > 0 && (
													<ButtonLink
														href={routes.topicTest(
															topic.subjectId,
															topic.topicSlug,
														)}
														size="sm"
													>
														Test çöz
													</ButtonLink>
												)}
											</div>
										</Card>
									</li>
								);
							})}
						</ul>
					</section>
				)}

				{wrongQuestions.length > 0 && (
					<section className="mt-8">
						<SectionHeading>Yanlış ve boş bıraktıkların</SectionHeading>
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
						onClick={() => {
							setPhase("setup");
							setSession(null);
							setResult(null);
							setResumable(null);
						}}
					>
						<RotateCcw aria-hidden size={18} />
						Yeni deneme
					</Button>
					<ButtonLink href="/ilerleme" className="flex-1">
						İlerlememi gör
					</ButtonLink>
				</div>
			</div>
		);
	}

	return null;
}
