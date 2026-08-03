"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	ListChecks,
	RotateCcw,
	Scale,
	Trophy,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumb, type Crumb } from "@/components/layout/breadcrumb";
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
import { testSetSlug } from "@/lib/selector/test-sets";
import { DIFFICULTY_LABELS, type Question } from "@/types/content";
import type { AnswerIndex, TestResult } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

interface Props {
	subjectId: string;
	subjectName: string;
	topicId: string;
	topicSlug: string;
	topicName: string;
	/** 1 tabanlı test sırası — ekranda "Test 3" olarak görünür. */
	setNumber: number;
	setSlug: string;
	/** Konudaki toplam test sayısı; "Test 3 / 7" için. */
	setCount: number;
	/** Bu testin soruları — derleme zamanında sabitlenmiştir, seçim yok. */
	questions: Question[];
}

/**
 * Konu testi motoru.
 *
 * Test kurulum ekranı YOKTUR: hangi soruların geleceği `lib/selector/test-sets.ts`
 * tarafından derleme zamanında belirlenir, kullanıcı yalnızca listeden test
 * numarası seçer. Sayfa açılır açılmaz oturum başlar.
 *
 * Çözme ve sonuç tek rotada tutulur. Sebebi teknik: uygulama tam statik
 * üretiliyor (Capacitor kısıtı), dolayısıyla `/sonuc/[oturumId]` gibi çalışma
 * anında doğan bir rota önceden üretilemez. Oturum durumu bileşende, kalıcı
 * kayıt Dexie'dedir.
 */
export function QuizRunner({
	subjectId,
	subjectName,
	topicId,
	topicSlug,
	topicName,
	setNumber,
	setSlug,
	setCount,
	questions,
}: Props) {
	const [answers, setAnswers] = useState<Record<string, AnswerIndex | null>>(
		() => Object.fromEntries(questions.map((q) => [q.id, null])),
	);
	const [revealed, setRevealed] = useState<Record<string, boolean>>({});
	const [current, setCurrent] = useState(0);
	const [sessionId, setSessionId] = useState("");
	const [startedAt, setStartedAt] = useState(0);
	const [result, setResult] = useState<TestResult | null>(null);
	/** Yarıda kalmış oturum geri yüklendiyse kullanıcıya bunu söylemek gerekir. */
	const [resumed, setResumed] = useState(false);

	/**
	 * Anında geri bildirim artık test başında değil, Ayarlar'da seçilir:
	 * her testte yeniden sorulan bir kutu, kurulum ekranının kaldırılma
	 * gerekçesiyle çelişirdi. Ayarlar okunana kadar varsayılan açıktır.
	 */
	const settings = useLiveQuery(
		() => progressRepository.getSettings(),
		[],
		undefined,
	);
	const instantFeedback = settings?.instantFeedback ?? true;

	/** Oturum tek kez açılır, tek kez kapanır — bkz. aşağıdaki iki koruma. */
	const started = useRef(false);
	const finishing = useRef(false);

	/**
	 * Sıfırdan yeni oturum. Satır ÖNCE yazılır, durum sonra kurulur: cevapları
	 * diske yazan effect yeni `sessionId`i görür görmez çalışır ve satır henüz
	 * yoksa yazma sessizce düşerdi.
	 */
	const startFresh = useCallback(async () => {
		const id = globalThis.crypto.randomUUID();
		const startedIso = new Date().toISOString();

		await progressRepository.createTestSession({
			id,
			kind: "topic-test",
			subjectId,
			topicId,
			// Sabit setlerin tamamı karışıktır; alan sunucu senkronu için korunuyor.
			difficulty: "karisik",
			setSlug,
			questionIds: questions.map((q) => q.id),
			answers: {},
			status: "in-progress",
			startedAt: startedIso,
		});

		finishing.current = false;
		setSessionId(id);
		setAnswers(Object.fromEntries(questions.map((q) => [q.id, null])));
		setRevealed({});
		setCurrent(0);
		setResult(null);
		setResumed(false);
		setStartedAt(new Date(startedIso).getTime());
	}, [questions, subjectId, topicId, setSlug]);

	/**
	 * Açılışta önce yarıda kalmış oturum aranır.
	 *
	 * Kullanıcı test sırasında Ayarlar'a gidip geri döndüğünde testin baştan
	 * başlamaması bunun içindir. "Devam edilsin mi?" diye sorulmaz: kullanıcı
	 * zaten o testin bağlantısına tıkladı, araya bir onay adımı koymak testi
	 * bırakıp dönmeyi cezalandırırdı. Bunun yerine bilgi notu + "Baştan başla".
	 */
	const beginSession = useCallback(
		async (revealAnswered: boolean) => {
			const saved = await progressRepository.getResumableTestSession(
				topicId,
				setSlug,
			);

			if (saved) {
				// İçerik güncellenmişse kayıtlı cevaplar başka sorulara aitmiş gibi
				// yüklenirdi; sıra ve kimlik birebir tutmuyorsa oturum kurtarılamaz.
				const sameQuestions =
					saved.questionIds.length === questions.length &&
					saved.questionIds.every((id, index) => questions[index]?.id === id);

				if (sameQuestions) {
					const restored = Object.fromEntries(
						questions.map((q) => [q.id, saved.answers[q.id] ?? null]),
					);
					const answeredIds = questions.filter((q) => restored[q.id] !== null);
					const firstUnanswered = questions.findIndex(
						(q) => restored[q.id] === null,
					);

					finishing.current = false;
					setSessionId(saved.id);
					setAnswers(restored);
					setRevealed(
						revealAnswered
							? Object.fromEntries(answeredIds.map((q) => [q.id, true]))
							: {},
					);
					setCurrent(firstUnanswered === -1 ? 0 : firstUnanswered);
					setResult(null);
					setStartedAt(new Date(saved.startedAt).getTime());
					setResumed(answeredIds.length > 0);
					return;
				}

				await progressRepository.abandonTestSession(saved.id);
			}

			await startFresh();
		},
		[questions, topicId, setSlug, startFresh],
	);

	/**
	 * Oturum sayfa açılır açılmaz başlar. Ref koruması geliştirme modundaki çift
	 * effect çağrısının ikinci bir oturum satırı açmasını engeller.
	 *
	 * Ayarlar OKUNMADAN başlanmaz: geri yüklenen cevapların açılıp açılmayacağı
	 * `instantFeedback`e bağlı ve `useLiveQuery` yüklenene kadar `undefined`
	 * döner. Erken başlansaydı tercihi kapalı olan kullanıcıya cevaplar açılmış
	 * gelirdi.
	 */
	useEffect(() => {
		if (started.current || settings === undefined) return;
		started.current = true;
		void beginSession(settings.instantFeedback);
	}, [settings, beginSession]);

	/** Cevap değiştikçe diske yazılır; sayfadan ayrılmak ilerlemeyi silmez. */
	useEffect(() => {
		if (!sessionId || result !== null) return;
		void progressRepository.saveTestProgress(sessionId, { answers });
	}, [answers, sessionId, result]);

	/** Kullanıcı kayıtlı ilerlemeyi bilerek atmak isterse. */
	const restart = useCallback(async () => {
		if (sessionId) await progressRepository.abandonTestSession(sessionId);
		await startFresh();
	}, [sessionId, startFresh]);

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

	/**
	 * Testi bitirir.
	 *
	 * Sıra bağlayıcıdır: sonuç ekranı ancak yazmalar bittikten sonra açılır.
	 * Tersi denendi ve yarış doğurdu — sonuç görünür görünmez kullanıcı (veya
	 * test) başka bir sayfaya geçtiğinde yarım kalan IndexedDB işlemi iptal
	 * oluyor, oturum "in-progress" kalıyor ve skor test listesine hiç
	 * düşmüyordu. Yazma başarısız olsa bile sonuç gösterilir; kullanıcının
	 * emeği ekranda kalmalı.
	 */
	const finish = useCallback(async () => {
		if (finishing.current) return;
		finishing.current = true;

		const answered = questions.map((q) => ({
			question: q,
			selectedIndex: answers[q.id] ?? null,
		}));
		const computed = computeTestResult(
			sessionId,
			answered,
			Date.now() - startedAt,
		);

		try {
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
					answered.map(({ question: q, selectedIndex }) => [
						q.id,
						selectedIndex,
					]),
				),
				computed.score,
			);
		} finally {
			setResult(computed);
		}
	}, [questions, answers, sessionId, startedAt]);

	const goNext = useCallback(() => {
		if (current < questions.length - 1) setCurrent((c) => c + 1);
		else void finish();
	}, [current, questions.length, finish]);

	// Klavye kısayolları: 1-5 şık seçer, ok tuşları soru değiştirir.
	useEffect(() => {
		if (result !== null) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.target instanceof HTMLInputElement) return;
			if (["1", "2", "3", "4", "5"].includes(event.key)) {
				// Sınır kontrolü: 4 şıklı soruda "5" basınca olmayan şık seçilmemeli.
				const optionIndex = Number(event.key) - 1;
				if (optionIndex < (questions[current]?.options.length ?? 0)) {
					select(optionIndex as AnswerIndex);
				}
			} else if (event.key === "ArrowRight") {
				goNext();
			} else if (event.key === "ArrowLeft" && current > 0) {
				setCurrent((c) => c - 1);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [result, select, goNext, current, questions]);

	const nextSetSlug = setNumber < setCount ? testSetSlug(setNumber + 1) : null;

	// Bir konunun adı dersin adıyla aynı olabiliyor (Etik → Etik Davranış
	// İlkeleri); ikisini yan yana basmak aynı ibareyi iki kez okutur.
	const breadcrumb =
		subjectName === topicName ? topicName : `${subjectName} · ${topicName}`;

	/*
	 * Konum çubuğu artık düz metin değil: testten çıkıp konunun test listesine
	 * dönmenin tek yolu buydu ve tıklanamıyordu.
	 */
	const crumbs: Crumb[] = [
		{ href: "/testler" as Route, label: "Testler" },
		{ href: routes.topicTest(subjectId, topicSlug), label: breadcrumb },
	];

	// --- Sonuç ---------------------------------------------------------------
	if (result) {
		const passed = isPassing(result.score);
		const wrongQuestions = questions.filter((q) =>
			result.wrongQuestionIds.includes(q.id),
		);

		return (
			<div>
				<Breadcrumb items={crumbs} />
				<h1 className="mb-6 text-2xl font-bold">Test {setNumber} sonucu</h1>

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
					{nextSetSlug ? (
						<ButtonLink
							href={routes.topicTestSet(subjectId, topicSlug, nextSetSlug)}
							className="flex-1"
						>
							Test {setNumber + 1}
							<ArrowRight aria-hidden size={18} />
						</ButtonLink>
					) : (
						<ButtonLink
							href={routes.topicTest(subjectId, topicSlug)}
							className="flex-1"
						>
							<ListChecks aria-hidden size={18} />
							Test listesi
						</ButtonLink>
					)}

					{/* Oturum bu noktada tamamlanmış; terk edilecek bir şey yok. */}
					<Button
						variant="secondary"
						className="flex-1"
						onClick={() => void startFresh()}
					>
						<RotateCcw aria-hidden size={18} />
						Tekrar çöz
					</Button>

					<ButtonLink
						href={routes.topic(subjectId, topicSlug)}
						variant="secondary"
						className="flex-1"
					>
						<BookOpen aria-hidden size={18} />
						Konu özeti
					</ButtonLink>
				</div>

				<p className="mt-6 text-center text-sm text-fg-subtle">
					<Link
						href="/ilerleme"
						className="inline-flex items-center gap-1.5 underline hover:text-fg"
					>
						<Scale aria-hidden size={16} />
						İlerlememi gör
					</Link>
				</p>
			</div>
		);
	}

	// --- Çözme ---------------------------------------------------------------
	if (!question) return null;

	const isLast = current === questions.length - 1;
	const canAdvance = instantFeedback ? isRevealed : true;

	return (
		<div>
			<Breadcrumb items={crumbs} />
			<h1 className="mb-4 text-xl font-bold">
				Test {setNumber} <span className="text-fg-subtle">/ {setCount}</span>
			</h1>

			{resumed && (
				<p
					role="status"
					className="mb-4 rounded-lg border border-line bg-surface-sunken p-3 text-sm text-fg-muted"
				>
					Kaldığın yerden devam ediyorsun. Cevapların saklandı.
				</p>
			)}

			<div className="mb-5">
				<ProgressBar
					value={current + 1}
					max={questions.length}
					label={`Test ilerlemesi: ${current + 1} / ${questions.length}`}
				/>
				<div className="mt-2 flex items-center justify-between gap-3 text-sm">
					<p className="text-fg-muted">
						{answeredCount} / {questions.length} cevaplandı
					</p>
					{/* Testin dört seviyeye yayıldığı çözerken de görünsün. */}
					<p className="rounded-full border border-line px-2.5 py-0.5 font-semibold text-fg-muted">
						{DIFFICULTY_LABELS[question.difficulty].label} soru
					</p>
				</div>
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

			{/* Cevaplar artık kalıcı; kullanıcının onları bilerek atabilmesi gerekir. */}
			{answeredCount > 0 && (
				<div className="mt-4 flex justify-center">
					<Button variant="ghost" size="sm" onClick={() => void restart()}>
						<RotateCcw aria-hidden size={16} />
						Baştan başla
					</Button>
				</div>
			)}

			<p className="mt-3 text-center text-sm text-fg-subtle">
				Klavye: <kbd>1</kbd>–<kbd>5</kbd> şık seçer, <kbd>←</kbd> <kbd>→</kbd>{" "}
				soru değiştirir.
			</p>
		</div>
	);
}
