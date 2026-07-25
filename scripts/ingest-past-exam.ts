/**
 * Çıkmış sınav ithal hattı — resmî kitapçık + cevap anahtarı → aday sorular.
 *
 * SADECE kamu kurumlarının KENDİ sitelerinde yayımladığı çıkmış sorular için
 * (AGENTS.md, Telif). Çıktı yayımlanabilir içerik DEĞİL, insan onayı bekleyen
 * bir inceleme kuyruğudur: her adayın `legalRef` ve `explanation`'ı boştur ve
 * bunlar doldurulup `content/subjects/**` altına taşınmadan `content:build`'den
 * geçmez.
 *
 * Çalıştırma:
 *   npm run ingest:past-exam -- \
 *     --booklet <soru.pdf> [--key <cevap.pdf>] \
 *     --origin "T.C. Sayıştay Başkanlığı GYS (Memur) A Kitapçığı" \
 *     --year 2023 --url "https://..." [--out <yol.json>] [--all]
 *
 * `--key` VERİLMEZSE `--booklet` tek dosyalık birleşik kitapçık kabul edilir:
 * sorular ve cevap anahtarı aynı PDF'te (MEB/ÖDSGM kalıbı), "CEVAP ANAHTARI"
 * başlığından bölünür. Ayrı anahtar PDF'i varsa `--key` ile geçin.
 *
 * `--all` verilmezse çıktı yalnızca üç dersimize eşleşen adayları içerir;
 * eşleşmeyenler (kuruma özgü mevzuat vb.) raporda sayılır ama yazılmaz.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { extractText, getDocumentProxy } from "unpdf";
import { assemble } from "./ingest/assemble";
import { parseBooklet } from "./ingest/parse-booklet";
import { parseKey } from "./ingest/parse-key";
import { splitBookletAndKey } from "./ingest/split-booklet";
import type { CandidateQuestion } from "./ingest/types";

function parseArgs(argv: string[]): Record<string, string | boolean> {
	const args: Record<string, string | boolean> = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (!token.startsWith("--")) continue;
		const key = token.slice(2);
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("--")) {
			args[key] = true;
		} else {
			args[key] = next;
			i += 1;
		}
	}
	return args;
}

async function extractPdfText(file: string): Promise<string> {
	const buffer = await readFile(file);
	const pdf = await getDocumentProxy(new Uint8Array(buffer));
	const { text } = await extractText(pdf, { mergePages: true });
	return text;
}

function fail(message: string): never {
	console.error(`HATA: ${message}`);
	process.exit(1);
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));

	const booklet = args.booklet;
	const key = args.key;
	const origin = args.origin;
	if (typeof booklet !== "string") fail("--booklet <soru.pdf> zorunlu.");
	if (typeof origin !== "string") fail("--origin \"kaynak adı\" zorunlu.");

	const source = {
		origin,
		year: typeof args.year === "string" ? Number(args.year) : undefined,
		url: typeof args.url === "string" ? args.url : undefined,
	};

	// İki mod: ayrı anahtar PDF'i (--key) ya da tek dosyalık birleşik kitapçık.
	let bookletText: string;
	let keyText: string;
	if (typeof key === "string") {
		[bookletText, keyText] = await Promise.all([
			extractPdfText(booklet),
			extractPdfText(key),
		]);
	} else {
		const combined = await extractPdfText(booklet);
		({ bookletText, keyText } = splitBookletAndKey(combined));
		if (keyText === "") {
			console.warn(
				"⚠ Tek dosyada 'CEVAP ANAHTARI' başlığı bulunamadı; anahtar boş kalacak.\n" +
					"  Cevap anahtarını ayrı bir PDF olarak --key ile geçin.",
			);
		}
	}

	const parsed = parseBooklet(bookletText);
	const answers = parseKey(keyText);
	const { candidates, report } = assemble(parsed, answers, source);

	const matched = candidates.filter((c) => c.subjectId !== null);
	const toWrite: CandidateQuestion[] = args.all === true ? candidates : matched;

	const out =
		typeof args.out === "string"
			? args.out
			: `${(booklet as string).replace(/\.pdf$/i, "")}.candidates.json`;
	await writeFile(out, `${JSON.stringify(toWrite, null, "\t")}\n`, "utf8");

	printReport(report, out, toWrite.length);
}

function printReport(
	report: ReturnType<typeof assemble>["report"],
	out: string,
	written: number,
): void {
	console.log("\n─── İthal kapsam raporu ───");
	console.log(`Ayrıştırılan soru      : ${report.totalParsed}`);
	console.log(`Cevap anahtarı eşleşen : ${report.totalParsed - report.missingAnswer.length}`);
	console.log("Derse göre eşleşen     :");
	for (const [subject, count] of Object.entries(report.bySubject).sort()) {
		console.log(`  ${subject.padEnd(12)} ${count}`);
	}
	console.log(`Kapsam dışı (eşleşmez) : ${report.unmatched}`);
	if (report.parseFailures.length > 0) {
		console.log(`⚠ Ayrıştırması bozuk    : ${report.parseFailures.join(", ")} (elle bakın)`);
	}
	if (report.missingAnswer.length > 0) {
		console.log(`⚠ Anahtarı bulunamayan  : ${report.missingAnswer.join(", ")}`);
	}
	console.log(`\n✔ ${written} aday yazıldı → ${path.relative(process.cwd(), out)}`);
	console.log(
		"  Sonraki adım: her adaya difficulty + topicId + legalRef + explanation ekleyip",
	);
	console.log("  content/subjects/** altına taşıyın, sonra `npm run content:build`.\n");
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
