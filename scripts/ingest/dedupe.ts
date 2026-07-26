import { foldForSearch } from "../../src/lib/search/normalize";
import type { CandidateQuestion } from "./types";

/**
 * Aynı sorunun birden çok kitapçıkta tekrarını eler.
 *
 * MEB unvan değişikliği/görevde yükselme sınavlarında meslekler ORTAK bir
 * 657/anayasa havuzunu paylaşır: aynı soru farklı kitapçıklarda ŞIKLARI
 * KARIŞTIRILMIŞ hâlde çıkar (gövde sabit, şık sırası — ve dolayısıyla doğru şık
 * harfi — değişir). 2021 İçişleri unvan değişikliği sınavında İnşaat/Avukat/
 * Sosyolog A kitapçıkları ölçüldü: tekil 10/12/12 ortak soru ama birleşimleri
 * yalnızca 13 benzersiz. Bu yüzden çoklu ithalde tekilleştirme şarttır.
 *
 * Tekilleştirme anahtarı: normalize(gövde) + SIRALANMIŞ normalize(şıklar).
 * Şıklar sıralandığından karıştırma tekrarları da yakalanır; gövdesi aynı ama
 * şık KÜMESİ farklı gerçek sorular ayrı kalır. İlk görülen korunur (kendi şık
 * sırası + doğru cevabıyla); sonrakiler düşülür.
 *
 * normalize (yalnızca ANAHTAR için; saklanan içerik değişmez): Türkçe küçültme +
 * aksan sadeleştirme (foldForSearch), PDF satır-sonu tire kırpmasının
 * ("korun- masına" → "korunmasina") giderilmesi ve NOKTALAMA elemesi. Kaynaklar
 * arası kesme işareti/tırnak tutarsızlığı ("Meclisinde" vs "Meclisi'nde", aynı
 * soru) tekilleştirmeyi kaçırmasın diye harf-rakam dışı her şey düşülür. Türkçe
 * metinde asla düz `toLowerCase()` kullanılmaz (AGENTS.md, I/İ tuzağı).
 */

function normalizeText(value: string): string {
	return foldForSearch(value.replace(/-\s+/g, ""))
		.replace(/[^a-z0-9\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Birebir tekrar anahtarı.
 *
 * `CandidateQuestion`'a değil, yalnızca gövde+şıklara bakar: aynı anahtar
 * `content/subjects/**` altındaki YAYIMLANMIŞ sorular için de üretilebilsin
 * diye (bkz. `pool.ts`). İki taraf farklı anahtar kullanırsa eleme sessizce
 * kaçırır.
 */
export function dedupeKey(question: { stem: string; options: readonly string[] }): string {
	const stem = normalizeText(question.stem);
	const options = question.options.map(normalizeText).sort();
	return `${stem}||${options.join("|")}`;
}

export function dedupeCandidates(candidates: readonly CandidateQuestion[]): {
	unique: CandidateQuestion[];
	duplicatesRemoved: number;
} {
	const seen = new Set<string>();
	const unique: CandidateQuestion[] = [];
	for (const candidate of candidates) {
		const key = dedupeKey(candidate);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(candidate);
	}
	return { unique, duplicatesRemoved: candidates.length - unique.length };
}
