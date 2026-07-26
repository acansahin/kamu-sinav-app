import { foldForSearch } from "../src/lib/search/normalize";

/**
 * Havuz genelinde yakın-tekrar taraması.
 *
 * `ingest/dedupe.ts` ithal sırasında tekilleştirme yapar ama anahtarı BİREBİR'dir:
 * normalize(gövde) + sıralanmış normalize(şıklar). Aynı resmî soru başka bir
 * kitapçıkta birkaç kelimesi değişerek yayımlandığında ("Kanunu'na göre" /
 * "Kanununda", ya da MEB'in 5 şıklı sürümü ile Sayıştay'ın 4 şıklısı) o anahtar
 * tutmaz ve tekrar havuza girer. Üstelik dedupe yalnızca TEK bir ithal koşusunun
 * içine bakar; `content/subjects/**` altında zaten duran sorular görüş alanında
 * değildir. İki boşluk birleşince aynı soru havuzda iki kez durabiliyor — bu
 * fiilen yaşandı ve elle yakalandı.
 *
 * Buradaki tarama gövdeyi kelime KÜMESİNE indirger ve Jaccard benzerliğine bakar;
 * böylece sözcük düzeyindeki farklar ve şık sayısı farkı eleme kaçırmaz.
 *
 * **Bu bir HATA değil, UYARIDIR.** Gövdesi birbirine çok benzeyen iki soru
 * gerçekten farklı olabilir: 657 md.77'de "yabancı memleketlerin resmî
 * kurumlarında on yıl" ile "uluslararası kuruluşlarda yirmi bir yıl" soruları
 * neredeyse aynı cümledir ama farklı hükmü ölçer. Karar ölçütü gövde değil,
 * **test edilen hükümdür**; o yüzden makine ayıklamaz, insana gösterir.
 */

/**
 * Bu eşiğin üstündeki çiftler rapora girer.
 *
 * 409 soruluk havuzda ölçüldü: 0.60→25, 0.66→17, 0.68→11, 0.72→9 çift. Eşik
 * DUYARLILIK tarafına ayarlandı, çünkü kaçan tekrar sessizdir, fazladan çıkan
 * çift ise bir bakışta elenir. Belirleyici veri: elle yakalanan gerçek bir
 * tekrar ("Kariyer" tanımı, MEB 5 şıklı ile 4 şıklı sürüm) yalnızca **0.69**
 * alıyordu — 0.72 onu kaçırırdı. Gövdeleri aynı olduğu hâlde skoru düşüren şey,
 * sorunun tanımı sarmalayan kalıp cümlesinin kitapçıktan kitapçığa değişmesidir.
 */
export const NEAR_DUPLICATE_THRESHOLD = 0.66;

/**
 * Bir çiftin rapora girmesi için paylaşması gereken en az anlamlı kelime sayısı.
 *
 * Jaccard kısa gövdelerde güvenilmez: "Yargıya ilişkin aşağıdaki ifadelerden
 * hangisi yanlıştır?" ile "Yürütmeye ilişkin…" yalnızca tek kelimeyle ayrılır ve
 * %67 alır — oysa bambaşka sorulardır. Gerçek tekrarlarda ortak kelime sayısı
 * çok daha yüksektir (ölçüldü: 12-25). Oran kuralına mutlak bir taban eklemek,
 * kısa-gövde yanlış pozitiflerini oranı bozmadan siler.
 */
export const MIN_SHARED_TOKENS = 8;

/**
 * Bu skorun üstünde kısa-gövde tabanı aranmaz.
 *
 * Gövdesi kelimesi kelimesine örtüşen bir çift, gövde kısa olsa bile
 * gösterilmelidir: "…sosyal ve ekonomik haklar ve ödevlerdendir?" gibi altı
 * kelimelik bir kök iki kez sorulmuşsa aday aynı cümleyi iki kez görür ve bunu
 * editörün bilmesi gerekir. Taban yalnızca ORANIN şişirdiği kısa gövdeleri
 * eler, birebir örtüşenleri değil.
 */
export const HIGH_CONFIDENCE_SCORE = 0.95;

/**
 * Her soruda geçtikleri için benzerliği yapay olarak şişiren kalıp sözcükler.
 * Atılmazlarsa iki alakasız 657 sorusu bile 0.5 üstü skor alır.
 */
const BOILERPLATE = new Set([
	"sayili",
	"gore",
	"asagidakilerden",
	"hangisi",
	"hangileri",
	"ile",
	"ilgili",
	"olarak",
	"icin",
	"kanun",
	"kanunu",
	"kanununa",
	"kanunun",
	"kanununda",
	"yonetmelik",
	"yonetmeligi",
	"yonetmeligine",
	"uyarinca",
	"gerektirir",
	"verilir",
]);

/**
 * Gövdeyi karşılaştırılabilir kelime kümesine indirger.
 *
 * `foldForSearch` Türkçe küçültme + aksan sadeleştirmesi yapar (AGENTS.md: düz
 * `toLowerCase()` "I" harfini bozar). PDF satır-sonu tirelemesi ("korun- masına")
 * önce kapatılır, sonra harf-rakam dışı her şey ayraç sayılır.
 */
export function stemTokens(stem: string): Set<string> {
	return new Set(
		foldForSearch(stem.replace(/-\s+/g, ""))
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length > 2 && !BOILERPLATE.has(token)),
	);
}

/** İki kümenin ortak eleman sayısı. */
export function sharedTokenCount(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
	let shared = 0;
	for (const token of a) if (b.has(token)) shared += 1;
	return shared;
}

/** İki kümenin kesişim/birleşim oranı. Boş kümelerde 0. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	const intersection = sharedTokenCount(a, b);
	return intersection / (a.size + b.size - intersection);
}

/**
 * Taramanın ihtiyaç duyduğu asgari soru şekli.
 *
 * Bilinçli olarak dardır: hem yayımlanmış `Question`'lar hem de ithal hattının
 * `CandidateQuestion`'ları (henüz `id`si, cevabı ve durumu olmayabilir) aynı
 * taramadan geçebilsin diye.
 */
export interface ComparableQuestion {
	/** Rapora basılan kimlik; adaylarda "#57" gibi soru numarası olabilir. */
	id: string;
	stem: string;
	options: readonly string[];
	/** Cevap anahtarı eşleşmemiş adaylarda `null`. */
	correctIndex: number | null;
	/** Yayımlanmış sorularda "published"/"review"; adaylarda verilmeyebilir. */
	status?: string;
}

export interface NearDuplicatePair {
	score: number;
	first: ComparableQuestion;
	second: ComparableQuestion;
}

/** Bir çiftin rapora girip girmeyeceği; girecekse skoru. */
function evaluate(
	a: ReadonlySet<string>,
	b: ReadonlySet<string>,
	threshold: number,
): number | null {
	const score = jaccard(a, b);
	if (score < threshold) return null;
	if (sharedTokenCount(a, b) < MIN_SHARED_TOKENS && score < HIGH_CONFIDENCE_SCORE) return null;
	return score;
}

function correctAnswer(question: ComparableQuestion): string | null {
	return question.correctIndex === null ? null : (question.options[question.correctIndex] ?? null);
}

/**
 * Çiftleri raporlama sırasına dizer.
 *
 * Doğru cevabı da AYNI olan çiftler başa alınır: gerçek tekrar olma ihtimali en
 * yüksek olanlar bunlardır, listenin dibinde kalmamalıdır.
 */
function sortPairs(pairs: NearDuplicatePair[]): NearDuplicatePair[] {
	const sameAnswer = (pair: NearDuplicatePair): number => {
		const first = correctAnswer(pair.first);
		return first !== null && first === correctAnswer(pair.second) ? 0 : 1;
	};
	return pairs.sort((a, b) => sameAnswer(a) - sameAnswer(b) || b.score - a.score);
}

/**
 * Tek bir küme içindeki eşik üstü çiftleri döner.
 *
 * Karşılaştırma ders ayrımı gözetmez: aynı hüküm (ör. 3628 sayılı Kanun'daki mal
 * bildirimi süresi) hem etik hem 657 dosyasında sorulabiliyor.
 */
export function findNearDuplicates(
	questions: readonly ComparableQuestion[],
	threshold: number = NEAR_DUPLICATE_THRESHOLD,
): NearDuplicatePair[] {
	const tokens = questions.map((question) => stemTokens(question.stem));
	const pairs: NearDuplicatePair[] = [];

	for (let i = 0; i < questions.length; i += 1) {
		for (let j = i + 1; j < questions.length; j += 1) {
			const score = evaluate(tokens[i], tokens[j], threshold);
			if (score !== null) pairs.push({ score, first: questions[i], second: questions[j] });
		}
	}

	return sortPairs(pairs);
}

/**
 * İKİ ayrı küme arasındaki çiftleri döner; küme içi karşılaştırma yapılmaz.
 *
 * İthal hattı için: aday havuzu ile `content/**` altındaki mevcut sorular
 * karşılaştırılır. Mevcut havuzun kendi içindeki tekrarları burada raporlamak
 * gürültüdür — onlar zaten `content:build` raporunda çıkar.
 *
 * `first` daima `candidates` tarafındandır; rapor "yeni gelen ↔ havuzdaki"
 * okunacak şekilde yazılabilsin diye.
 */
export function findNearDuplicatesAgainst(
	candidates: readonly ComparableQuestion[],
	pool: readonly ComparableQuestion[],
	threshold: number = NEAR_DUPLICATE_THRESHOLD,
): NearDuplicatePair[] {
	const candidateTokens = candidates.map((c) => stemTokens(c.stem));
	const poolTokens = pool.map((p) => stemTokens(p.stem));
	const pairs: NearDuplicatePair[] = [];

	for (let i = 0; i < candidates.length; i += 1) {
		for (let j = 0; j < pool.length; j += 1) {
			const score = evaluate(candidateTokens[i], poolTokens[j], threshold);
			if (score !== null) pairs.push({ score, first: candidates[i], second: pool[j] });
		}
	}

	return sortPairs(pairs);
}

/**
 * Raporun tek bir çift için bastığı satırlar.
 *
 * İki satırla sınırlıdır: liste her derlemede basıldığı için uzunluk maliyetlidir.
 * İkinci satırda İKİ doğru cevap yan yana verilir — "aynı hükmü mü ölçüyorlar"
 * kararı çoğu zaman yalnızca buna bakarak verilebilir; cevaplar farklıysa çift
 * büyük ihtimalle meşrudur.
 */
export function formatPair({ score, first, second }: NearDuplicatePair): string[] {
	const label = (q: ComparableQuestion): string =>
		`${q.id} (${q.options.length} şık${q.status === undefined ? "" : `, ${q.status}`})`;
	const answer = (q: ComparableQuestion): string =>
		(correctAnswer(q) ?? "(cevapsız)").replace(/\s+/g, " ").slice(0, 44);

	return [
		`%${Math.round(score * 100)}  ${label(first)} ↔ ${label(second)}`,
		`     ${first.stem.replace(/\s+/g, " ").slice(0, 88)}`,
		`     ✔ ${answer(first)}  ↔  ✔ ${answer(second)}`,
	];
}
