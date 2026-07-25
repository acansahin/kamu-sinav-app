import { classify } from "./classify";
import type {
	CandidateQuestion,
	CoverageReport,
	ParsedQuestion,
	SourceMeta,
} from "./types";

/**
 * Ayrıştırılmış soruları, cevap anahtarını ve kaynak bilgisini birleştirip
 * inceleme kuyruğuna girecek adayları ve kapsam raporunu üretir. Saf.
 *
 * Her aday, kaynağıyla damgalanır (`official-past-exam` / `public-official`) ama
 * editoryal alanları (difficulty, legalRef, explanation) boş bırakılır — onları
 * insan onayı doldurur.
 */
export function assemble(
	parsed: readonly ParsedQuestion[],
	answers: ReadonlyMap<number, number>,
	source: SourceMeta,
): { candidates: CandidateQuestion[]; report: CoverageReport } {
	const candidates: CandidateQuestion[] = [];
	const report: CoverageReport = {
		totalParsed: parsed.length,
		parseFailures: [],
		bySubject: {},
		unmatched: 0,
		missingAnswer: [],
	};

	for (const question of parsed) {
		if (!question.parseOk) report.parseFailures.push(question.number);

		const { subjectId, topicId } = classify(question.stem);
		const correctIndex = answers.get(question.number) ?? null;

		if (correctIndex === null) report.missingAnswer.push(question.number);
		if (subjectId === null) report.unmatched += 1;
		else report.bySubject[subjectId] = (report.bySubject[subjectId] ?? 0) + 1;

		candidates.push({
			number: question.number,
			subjectId,
			topicId,
			difficulty: null,
			stem: question.stem,
			options: question.options,
			correctIndex,
			legalRef: null,
			explanation: null,
			source: {
				kind: "official-past-exam",
				origin: source.origin,
				...(source.year !== undefined ? { year: source.year } : {}),
				...(source.url !== undefined ? { url: source.url } : {}),
				license: "public-official",
			},
			status: "draft",
		});
	}

	return { candidates, report };
}
