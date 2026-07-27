import { foldForSearch } from "../../src/lib/search/normalize";
import type { ParsedQuestion } from "./types";

/**
 * "Cevaplı kitapçık" biçimini okur: doğru şık AYRI BİR ANAHTARDA DEĞİL, kitapçığın
 * kendi içinde RENKLİ yazılarak işaretlenmiştir.
 *
 * Bazı kurumlar (TKGM, DHMİ) sınav sonrası "cevaplı A kitapçığı" yayımlar. Bu
 * dosyalarda `parse-key.ts`in aradığı "1 D 2 A" ızgarası da, "CEVAP ANAHTARI"
 * başlığı da yoktur; doğru şık kırmızıya boyanmıştır. Renk düz metin çıkarımında
 * KAYBOLUR; CLI onu PDF operatör listesinden toplar (`extractColoredRuns`), bu
 * modül de saf mantıkla cevaba çevirir.
 *
 * İki tasarım kararı, gerçek bir kitapçık üzerinde ölçülerek alındı (DHMİ 2020,
 * 101 soru):
 *
 * 1. **İşaret sınırı renkten değil, ARADAKİ SİYAH METİNDEN bulunur.** İlk
 *    denemede işaretin "B)" gibi bir şık harfiyle başladığı varsayılmıştı; 101
 *    sorunun yalnızca 89'u yakalandı. Sebep: kitapçıkların bir kısmında harf ile
 *    parantez ayrı çizim parçalarına bölünüyor ("A" + ")"), bir kısmında ise
 *    yalnızca şıkkın METNİ boyanıp harfi siyah bırakılıyor. Bu yüzden ardışık
 *    renkli parçalar tek bir işaret sayılır ve araya giren siyah metin işareti
 *    kapatır.
 *
 * 2. **Şık, harften değil İÇERİKTEN belirlenir.** Harf varsa ipucu olarak
 *    kullanılır ama karar, işaret metninin sorunun şıklarıyla karşılaştırılmasına
 *    dayanır. Böylece harfi okunamayan işaret de doğru eşleşir ve —daha
 *    önemlisi— sayfadaki kırmızı bir sayfa numarası gibi sahte işaretler hiçbir
 *    şıkla eşleşmediği için sessizce atlanır.
 *
 * Eşleşmeyen işaret ASLA sıraya güvenilerek kabul edilmez: bir kayma, sonraki
 * bütün sorulara yanlış cevap yazar. Cevapsız aday zararsızdır (inceleme
 * kuyruğunda cevapsız görünür), yanlış cevaplı aday zehirlidir.
 */

const LETTER_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

/** PDF'ten toplanan tek bir metin parçası ve çizildiği renk. */
export interface ColoredRun {
	/** "#ff0000" gibi kısa hex; PDF.js `setFillRGBColor` argümanı. */
	color: string;
	text: string;
}

/** Kitapçıkta işaretlenmiş (renkli) tek bir bölge. */
export interface MarkGroup {
	/** İşaretin başındaki şık harfi; okunamadıysa `null`. */
	letter: string | null;
	/** Harften sonraki metin — eşleşme bunun üzerinden doğrulanır. */
	text: string;
}

/**
 * Nötr (işaret sayılmayan) renkler: siyah, beyaz ve griler.
 *
 * Kitapçık gövdesi siyahtır; bazı üretici araçlar tam siyah yerine koyu gri
 * kullanır. Tanınmayan renk biçimi de nötr sayılır — bilinmeyenden işaret
 * üretmek, işaret kaçırmaktan kötüdür.
 */
export function isNeutralColor(color: string): boolean {
	const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
	if (match === null) return true;
	const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(match[1].slice(i, i + 2), 16));
	return r === g && g === b;
}

/**
 * Ardışık renkli parçaları tek işarete toplar; araya giren nötr parça işareti kapatır.
 *
 * Nötr parçalar bu yüzden atılmaz, SINIR olarak kullanılır: iki cevabın arasında
 * her zaman siyah metin (sonraki sorunun gövdesi, diğer şıklar) vardır.
 */
export function markGroups(runs: readonly ColoredRun[]): MarkGroup[] {
	const groups: MarkGroup[] = [];
	let current: string[] | null = null;

	const close = (): void => {
		if (current === null) return;
		const joined = current.join(" ").replace(/\s+/g, " ").trim();
		current = null;
		if (joined === "") return;
		// `s` (dotAll) bayrağı yerine [\s\S]: projenin TS hedefi onu kabul etmiyor.
		const withLetter = /^([A-E])\s*\)\s*([\s\S]*)$/.exec(joined);
		groups.push(
			withLetter === null
				? { letter: null, text: joined }
				: { letter: withLetter[1], text: withLetter[2].trim() },
		);
	};

	for (const run of runs) {
		if (isNeutralColor(run.color)) {
			if (run.text.trim() !== "") close();
			continue;
		}
		if (run.text.trim() === "") continue;
		current ??= [];
		current.push(run.text.trim());
	}
	close();

	return groups;
}

/** Karşılaştırma için sadeleştirme: Türkçe küçültme + noktalama ve boşluk elemesi. */
function normalize(value: string): string {
	return foldForSearch(value.replace(/-\s+/g, "")).replace(/[^a-z0-9]/g, "");
}

/**
 * İşaret metni bu şıkla uyuşuyor mu?
 *
 * Tam eşitlik aranmaz: boyama şıkkın tamamını kapsamayabilir, satır sonları
 * metni böler. İlk 12 anlamlı karakterin örtüşmesi yeterli ve ayırt edicidir.
 * Çok kısa şıklarda ("A) 1900") tam eşitlik aranır.
 */
function matchesOption(markText: string, option: string): boolean {
	const mark = normalize(markText);
	const target = normalize(option);
	if (mark === "" || target === "") return false;
	if (target.length < 12 || mark.length < 12) return mark === target;
	return target.startsWith(mark.slice(0, 12)) || mark.startsWith(target.slice(0, 12));
}

/** Bir işaretin hangi şıkkı gösterdiğini bulur; belirlenemezse `null`. */
function resolveIndex(group: MarkGroup, question: ParsedQuestion): number | null {
	const byLetter = group.letter === null ? undefined : LETTER_INDEX[group.letter];

	// Harf VE metin uyuşuyorsa en güvenli durum.
	if (byLetter !== undefined && byLetter < question.options.length) {
		if (group.text === "" || matchesOption(group.text, question.options[byLetter])) {
			return byLetter;
		}
	}

	// Harf yok ya da metinle çelişiyor: şıkları içerikten tara, tek eşleşme ara.
	const hits = question.options
		.map((option, index) => (matchesOption(group.text, option) ? index : -1))
		.filter((index) => index >= 0);

	return hits.length === 1 ? hits[0] : null;
}

export interface MarkedKeyResult {
	/** Doğrulanmış cevaplar: soru numarası → şık indeksi. */
	answers: Map<number, number>;
	/** İnsana bildirilecek sorunlar; her biri tek satır. */
	problems: string[];
}

/** Sahte işaretleri atlarken kaç işaret ileri bakılacağı. */
const LOOKAHEAD = 2;

/**
 * İşaretleri sorularla eşler.
 *
 * Sorular ve işaretler sırayla yürütülür, ama her kabul İÇERİKLE doğrulanır.
 * Eldeki işaret o soruya uymuyorsa (sahte işaret ya da atlanmış soru olabilir)
 * en fazla {@link LOOKAHEAD} işaret ileri bakılır; hâlâ uymuyorsa soru cevapsız
 * bırakılır ve işaret tüketilmez. Böylece tek bir aksaklık, kalan soruların
 * tamamını kaydırmaz.
 */
export function matchMarkedAnswers(
	questions: readonly ParsedQuestion[],
	groups: readonly MarkGroup[],
): MarkedKeyResult {
	const answers = new Map<number, number>();
	const problems: string[] = [];
	let cursor = 0;

	for (const question of questions) {
		let matched = false;

		for (let ahead = 0; ahead <= LOOKAHEAD && cursor + ahead < groups.length; ahead += 1) {
			const index = resolveIndex(groups[cursor + ahead], question);
			if (index === null) continue;
			answers.set(question.number, index);
			cursor += ahead + 1;
			matched = true;
			break;
		}

		if (!matched) {
			problems.push(
				`#${question.number}: işaret şıklarla eşleşmedi, cevapsız bırakıldı` +
					(cursor < groups.length ? ` (sıradaki işaret: "${groups[cursor].text.slice(0, 40)}")` : ""),
			);
		}
	}

	if (groups.length !== questions.length) {
		problems.push(
			`işaret sayısı (${groups.length}) soru sayısından (${questions.length}) farklı — ` +
				"eşleşmeler içerikle doğrulandı, yine de gözden geçirin",
		);
	}

	return { answers, problems };
}
