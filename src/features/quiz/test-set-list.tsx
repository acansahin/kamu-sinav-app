"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { CardLink } from "@/components/ui/card";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import { isPassing } from "@/lib/scoring/test-result";
import { DIFFICULTY_ORDER } from "@/types/content";
import type { Difficulty } from "@/types/content";
import { cn } from "@/lib/utils/cn";

/**
 * Test listesindeki tek bir setin özeti. Soruların kendisi buraya GELMEZ:
 * liste sayfası 60+ soruyu istemciye taşımak zorunda kalmasın diye yalnızca
 * sayılar geçirilir; sorular test sayfasına gömülüdür.
 */
export interface TestSetSummary {
	slug: string;
	number: number;
	questionCount: number;
	countsByDifficulty: Record<Difficulty, number>;
}

export function TestSetList({
	subjectId,
	topicSlug,
	topicId,
	sets,
}: {
	subjectId: string;
	topicSlug: string;
	topicId: string;
	sets: TestSetSummary[];
}) {
	const sessions = useLiveQuery(
		() => progressRepository.getCompletedTestSessions(topicId),
		[topicId],
		undefined,
	);

	// Aynı test birden çok kez çözülebilir; rozette en iyi skor gösterilir.
	const bestScores = new Map<string, number>();
	for (const session of sessions ?? []) {
		if (session.setSlug === undefined || session.score === undefined) continue;
		const best = bestScores.get(session.setSlug);
		if (best === undefined || session.score > best) {
			bestScores.set(session.setSlug, session.score);
		}
	}

	return (
		<ul className="space-y-3">
			{sets.map((set) => {
				const score = bestScores.get(set.slug);
				const solved = score !== undefined;
				const mix = DIFFICULTY_ORDER.filter(
					(level) => set.countsByDifficulty[level] > 0,
				)
					// Zorluk kimliği zaten küçük harfli Türkçe bir sözcük ("kolay",
					// "uzman"); etiketi küçültmek yerine kimliği kullanmak
					// `toLowerCase` tuzağını tamamen atlar.
					.map((level) => `${set.countsByDifficulty[level]} ${level}`);

				return (
					<li key={set.slug}>
						<CardLink
							href={routes.topicTestSet(subjectId, topicSlug, set.slug)}
							className="flex items-center gap-4"
							/*
							 * Erişilebilir ad elle veriliyor: kart içeriğinden türetilen ad
							 * "Test 1" ile "10 soru"yu bitişik okur ("Test 110 soru"),
							 * çünkü aradaki boşluk yalnızca blok düzeninden geliyor.
							 */
							aria-label={`Test ${set.number}: ${set.questionCount} soru, ${mix.join(", ")}. ${
								solved ? `En iyi puanın ${score}` : "Henüz çözmedin"
							}`}
						>
							<span className="flex-1">
								<span className="block font-semibold">Test {set.number}</span>
								<span className="mt-1 block text-sm text-fg-muted">
									{set.questionCount} soru · {mix.join(" · ")}
								</span>
							</span>

							{/* Renk tek başına anlam taşımaz: ikon + metin birlikte. */}
							<span
								className={cn(
									"flex shrink-0 items-center gap-1.5 text-sm font-semibold",
									solved
										? isPassing(score)
											? "text-correct"
											: "text-flag"
										: "text-fg-subtle",
								)}
							>
								{solved ? (
									<>
										{/* Eşiği geçmeyen skora onay işareti koymak yanıltıcı
										    olurdu; ikon da metin gibi durumu söylemeli. */}
										{isPassing(score) ? (
											<CircleCheck aria-hidden size={18} />
										) : (
											<CircleAlert aria-hidden size={18} />
										)}
										<span className="tabular-nums">{score} puan</span>
									</>
								) : (
									<>
										<CircleDashed aria-hidden size={18} />
										Çözülmedi
									</>
								)}
							</span>
						</CardLink>
					</li>
				);
			})}
		</ul>
	);
}
