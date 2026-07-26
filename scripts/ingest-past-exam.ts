/**
 * Çıkmış sınav ithal hattı — resmî kitapçık + cevap anahtarı → aday sorular.
 *
 * SADECE kamu kurumlarının KENDİ sitelerinde yayımladığı çıkmış sorular için
 * (AGENTS.md, Telif). Çıktı yayımlanabilir içerik DEĞİL, insan onayı bekleyen
 * bir inceleme kuyruğudur: her adayın `legalRef` ve `explanation`'ı boştur ve
 * bunlar doldurulup `content/subjects/**` altına taşınmadan `content:build`'den
 * geçmez.
 *
 * TEK KİTAPÇIK:
 *   npm run ingest:past-exam -- \
 *     --booklet <soru.pdf> [--key <cevap.pdf>] \
 *     --origin "T.C. Sayıştay Başkanlığı GYS (Memur) A Kitapçığı" \
 *     --year 2023 --url "https://..." [--out <yol.json>] [--all]
 *
 *   `--key` VERİLMEZSE `--booklet` tek dosyalık birleşik kitapçık kabul edilir:
 *   sorular ve cevap anahtarı aynı PDF'te (MEB/ÖDSGM kalıbı), "CEVAP ANAHTARI"
 *   başlığından bölünür. Ayrı anahtar PDF'i varsa `--key` ile geçin.
 *
 * ÇOKLU KİTAPÇIK + TEKİLLEŞTİRME:
 *   npm run ingest:past-exam -- --manifest <kaynaklar.json> [--out <yol.json>] [--all]
 *
 *   `kaynaklar.json`: her biri kendi kaynak bilgisini taşıyan kayıt dizisi
 *   [ { "booklet": "a.pdf", "origin": "...", "year": 2021, "url": "..." },
 *     { "booklet": "b.pdf", "key": "b_key.pdf", "origin": "...", "year": 2022 } ]
 *   Yollar manifest dosyasının bulunduğu klasöre GÖRELİDİR. Tüm kaynaklar
 *   ayrıştırılıp adaylar birleştirilir ve TEKİLLEŞTİRİLİR: MEB sınavlarında
 *   meslekler ortak 657/anayasa havuzunu paylaştığından (şıkları karıştırılmış)
 *   aynı soru birden çok kitapçıkta çıkar; gövde + sıralanmış şık kümesine göre
 *   bir kez tutulur (bkz. ingest/dedupe.ts).
 *
 * `--all` verilmezse çıktı yalnızca üç dersimize eşleşen adayları içerir;
 * eşleşmeyenler (kuruma özgü mevzuat vb.) raporda sayılır ama yazılmaz.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { extractText, getDocumentProxy } from "unpdf";
import { assemble } from "./ingest/assemble";
import { dedupeCandidates } from "./ingest/dedupe";
import { parseBooklet } from "./ingest/parse-booklet";
import { parseKey } from "./ingest/parse-key";
import { splitBookletAndKey } from "./ingest/split-booklet";
import type { CandidateQuestion, CoverageReport } from "./ingest/types";

/** Manifest kaydı — tek bir kaynak kitapçığın kimliği ve dosyaları. */
interface SourceEntry {
	booklet: string;
	key?: string;
	origin: string;
	year?: number;
	url?: string;
}

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

/**
 * Bir kaynağın kitapçık ve anahtar metnini yükler. `key` yoksa `booklet`
 * tek dosyalık birleşik kabul edilir ve "CEVAP ANAHTARI"ndan bölünür.
 */
async function loadBookletAndKey(
	booklet: string,
	key: string | undefined,
): Promise<{ bookletText: string; keyText: string; keyMissing: boolean }> {
	if (key !== undefined) {
		const [bookletText, keyText] = await Promise.all([
			extractPdfText(booklet),
			extractPdfText(key),
		]);
		return { bookletText, keyText, keyMissing: false };
	}
	const combined = await extractPdfText(booklet);
	const { bookletText, keyText } = splitBookletAndKey(combined);
	return { bookletText, keyText, keyMissing: keyText === "" };
}

/** Tek bir kaynağı ayrıştırıp adaylarını ve kapsam raporunu üretir. */
async function ingestSource(
	entry: SourceEntry,
): Promise<{ candidates: CandidateQuestion[]; report: CoverageReport }> {
	const { bookletText, keyText, keyMissing } = await loadBookletAndKey(
		entry.booklet,
		entry.key,
	);
	if (keyMissing) {
		console.warn(
			`⚠ ${path.basename(entry.booklet)}: 'CEVAP ANAHTARI' başlığı bulunamadı; anahtar boş kalacak.`,
		);
	}
	const parsed = parseBooklet(bookletText);
	const answers = parseKey(keyText);
	return assemble(parsed, answers, {
		origin: entry.origin,
		year: entry.year,
		url: entry.url,
	});
}

function countBySubject(candidates: readonly CandidateQuestion[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const c of candidates) {
		if (c.subjectId !== null) counts[c.subjectId] = (counts[c.subjectId] ?? 0) + 1;
	}
	return counts;
}

async function runSingle(args: Record<string, string | boolean>): Promise<void> {
	const booklet = args.booklet;
	const origin = args.origin;
	if (typeof booklet !== "string") fail("--booklet <soru.pdf> zorunlu.");
	if (typeof origin !== "string") fail('--origin "kaynak adı" zorunlu.');

	const { candidates, report } = await ingestSource({
		booklet,
		key: typeof args.key === "string" ? args.key : undefined,
		origin,
		year: typeof args.year === "string" ? Number(args.year) : undefined,
		url: typeof args.url === "string" ? args.url : undefined,
	});

	const toWrite = args.all === true ? candidates : candidates.filter((c) => c.subjectId !== null);
	const out =
		typeof args.out === "string" ? args.out : `${booklet.replace(/\.pdf$/i, "")}.candidates.json`;
	await writeFile(out, `${JSON.stringify(toWrite, null, "\t")}\n`, "utf8");

	printReport(report, out, toWrite.length);
}

async function runManifest(args: Record<string, string | boolean>): Promise<void> {
	const manifestPath = args.manifest;
	if (typeof manifestPath !== "string") fail("--manifest <kaynaklar.json> zorunlu.");

	let entries: SourceEntry[];
	try {
		const raw = await readFile(manifestPath, "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) throw new Error("manifest bir kayıt dizisi olmalı");
		entries = parsed.map((e, i) => validateEntry(e, i));
	} catch (error) {
		fail(`manifest okunamadı (${manifestPath}): ${error instanceof Error ? error.message : String(error)}`);
	}
	if (entries.length === 0) fail("manifest boş.");

	// Manifestteki yollar dosyanın klasörüne görelidir.
	const baseDir = path.dirname(manifestPath);
	const resolve = (p: string): string => (path.isAbsolute(p) ? p : path.join(baseDir, p));

	const all: CandidateQuestion[] = [];
	let totalParsed = 0;
	let totalMatchedAnswer = 0;

	console.log(`\n─── Çoklu ithal (${entries.length} kaynak) ───`);
	for (const entry of entries) {
		const { candidates, report } = await ingestSource({
			...entry,
			booklet: resolve(entry.booklet),
			key: entry.key !== undefined ? resolve(entry.key) : undefined,
		});
		all.push(...candidates);
		totalParsed += report.totalParsed;
		totalMatchedAnswer += report.totalParsed - report.missingAnswer.length;
		const matchedHere = Object.values(report.bySubject).reduce((a, b) => a + b, 0);
		console.log(
			`  ${path.basename(entry.booklet).padEnd(34)} ${String(report.totalParsed).padStart(3)} soru, ` +
				`${matchedHere} dersimize` +
				(report.parseFailures.length > 0 ? `  (⚠ ${report.parseFailures.length} bozuk)` : ""),
		);
	}

	// Yazılacak küme: eşleşen (ya da --all ile hepsi), sonra TEKİLLEŞTİR.
	const scoped = args.all === true ? all : all.filter((c) => c.subjectId !== null);
	const { unique, duplicatesRemoved } = dedupeCandidates(scoped);

	const out =
		typeof args.out === "string"
			? args.out
			: `${manifestPath.replace(/\.json$/i, "")}.candidates.json`;
	await writeFile(out, `${JSON.stringify(unique, null, "\t")}\n`, "utf8");

	console.log(`\nToplam ayrıştırılan     : ${totalParsed}`);
	console.log(`Cevap anahtarı eşleşen  : ${totalMatchedAnswer}`);
	console.log(`Aday (kapsanan)         : ${scoped.length}`);
	console.log(`Tekrar düşüldü          : ${duplicatesRemoved}`);
	console.log("Benzersiz — derse göre  :");
	for (const [subject, count] of Object.entries(countBySubject(unique)).sort()) {
		console.log(`  ${subject.padEnd(12)} ${count}`);
	}
	console.log(`\n✔ ${unique.length} benzersiz aday yazıldı → ${path.relative(process.cwd(), out)}`);
	console.log("  Sonraki adım: her adaya difficulty + topicId + legalRef + explanation ekleyip");
	console.log("  content/subjects/** altına taşıyın, sonra `npm run content:build`.\n");
}

function validateEntry(entry: unknown, index: number): SourceEntry {
	if (typeof entry !== "object" || entry === null) {
		throw new Error(`kayıt #${index + 1} bir nesne değil`);
	}
	const e = entry as Record<string, unknown>;
	if (typeof e.booklet !== "string") throw new Error(`kayıt #${index + 1}: "booklet" (string) zorunlu`);
	if (typeof e.origin !== "string") throw new Error(`kayıt #${index + 1}: "origin" (string) zorunlu`);
	if (e.key !== undefined && typeof e.key !== "string") throw new Error(`kayıt #${index + 1}: "key" string olmalı`);
	if (e.year !== undefined && typeof e.year !== "number") throw new Error(`kayıt #${index + 1}: "year" sayı olmalı`);
	if (e.url !== undefined && typeof e.url !== "string") throw new Error(`kayıt #${index + 1}: "url" string olmalı`);
	return {
		booklet: e.booklet,
		origin: e.origin,
		...(typeof e.key === "string" ? { key: e.key } : {}),
		...(typeof e.year === "number" ? { year: e.year } : {}),
		...(typeof e.url === "string" ? { url: e.url } : {}),
	};
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.manifest !== undefined) {
		await runManifest(args);
	} else {
		await runSingle(args);
	}
}

function printReport(report: CoverageReport, out: string, written: number): void {
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
