/**
 * Mevzuat bazlı doğrulama planı üretir.
 *
 * Soru soru doğrulamak yerine MADDE MADDE doğrulamak için. 208 soruyu tek
 * tek kontrol etmek yerine, her maddeyi bir kez açıp ona dayanan tüm
 * soruların iddialarını aynı anda görürsünüz.
 *
 * Gerekçe deneyimden geliyor: havuzdaki tek gerçek hata, dört sorunun aynı
 * olguya (mülga bir fıkraya) dayanmasıyla ortaya çıktı. Tek tek okunduğunda
 * her biri makul görünüyordu; yan yana konduğunda hata görünür oldu.
 *
 * Çalıştırma: npm run verify:plan
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
	type ContentManifest,
	type Question,
	contentManifestSchema,
	questionSchema,
} from "../src/types/content";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "public", "content");
const OUT_FILE = path.join(ROOT, "review", "DOGRULAMA-PLANI.md");

interface Cluster {
	key: string;
	law: string;
	lawId?: string;
	article?: string;
	url?: string;
	questions: { question: Question; topicName: string }[];
	topics: Set<string>;
}

/**
 * Sayısal iddiaları çıkarır.
 *
 * Bir maddeye dayanan tüm sayıları yan yana görmek, çelişkiyi ve eskimiş
 * rakamı gözle yakalamanın en hızlı yolu. Kesirler (1/30) ve birimli
 * sayılar (7 gün, 16 hafta) ayrı ayrı yakalanır.
 */
function extractClaims(question: Question, negative: boolean): string[] {
	/*
	 * Olumsuz sorularda yalnızca ŞIK metni taranır.
	 *
	 * Açıklama, ifadenin neden yanlış olduğunu anlatırken doğru rakamı da
	 * söyler; ikisini birlikte taramak "8 hafta"yı hem doğru hem yanlış
	 * listesine düşürür ve ayrımı işe yaramaz hâle getirir.
	 */
	const text = negative
		? question.options[question.correctIndex]
		: `${question.options[question.correctIndex]} ${question.explanation}`;
	const claims = new Set<string>();

	/*
	 * Kesirler: 1/30, 1/8.
	 *
	 * Tarihler dışlanır: "20/11/2017" içindeki "20/11" bir oran değildir ve
	 * inceleyiciyi maddede olmayan bir rakamı aramaya gönderir. Bu yüzden
	 * öncesinde veya sonrasında başka bir "/sayı" bulunan eşleşmeler atılır.
	 */
	for (const match of text.matchAll(
		/(?<!\d\s*\/\s*)\b\d+\s*\/\s*\d+\b(?!\s*\/\s*\d)/g,
	)) {
		claims.add(match[0].replace(/\s+/g, ""));
	}

	/*
	 * Birimli sayılar: 15 gün, 24 hafta, 2 yıl, 11 üye.
	 *
	 * Türkçe eklemeli olduğu için birimden sonra kelime sınırı ARANMAZ:
	 * "16 haftadır", "5 günlük", "2 yıldan" hep sayılmalıdır. Aksi hâlde
	 * çekimli hâller sessizce kaçar ve liste eksik görünür.
	 *
	 * "ay" bu kuralın dışında tutulur: ekleri serbest bırakmak "2 ayrı"yı
	 * "2 ay" diye okur. Onun için yalnızca bilinen ekler kabul edilir.
	 *
	 * Sayının başına `/` gelemez: metinler birleştirildiğinde "…1/8" ile
	 * "Aylıktan kesme…" yan yana düşer ve "8 Aylıktan" bir birim gibi okunur.
	 * Bu gerçek bir yanlış-pozitifti.
	 */
	const units = "gün|hafta|yıl|sene|saat|üye|soru|kişi|dakika|puan";
	for (const match of text.matchAll(
		new RegExp(`(?<![/\\d])\\b(\\d+)\\s+(${units})[a-zçğıöşü]*`, "gi"),
	)) {
		claims.add(`${match[1]} ${match[2].toLocaleLowerCase("tr")}`);
	}

	for (const match of text.matchAll(
		/(?<![/\d])\b(\d+)\s+(ay)(?:\b|dır|dir|da|de|dan|den|ı|ın|lık|lik)/gi,
	)) {
		claims.add(`${match[1]} ay`);
	}

	// Yazıyla sayılar, mevzuat metinlerinde sık: "otuz gün", "beş üye"
	const words =
		"bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|onbir|oniki|onbeş|yirmi|otuz|kırk|altmış";
	for (const match of text.matchAll(
		new RegExp(`\\b(${words})\\s+(${units})[a-zçğıöşü]*`, "gi"),
	)) {
		claims.add(
			`${match[1].toLocaleLowerCase("tr")} ${match[2].toLocaleLowerCase("tr")}`,
		);
	}

	return [...claims].sort();
}

/**
 * "Hangisi yanlıştır / değildir" tipi sorular.
 *
 * Bunlarda doğru şık, kasten YANLIŞ olan ifadedir. Ayırt edilmezse plan
 * yanlış alarm verir: madde 104 kümesinde hem "16 hafta" hem "24 hafta"
 * görünür ve çelişki sanılır — oysa 16 hafta bilerek yanlış yazılmıştır.
 */
function isNegativeStem(question: Question): boolean {
	return /yanlış(tır|dır)?\b|değildir\b|olamaz\b|yer almaz\b|kapsamaz\b/i.test(
		question.stem,
	);
}

function mevzuatUrl(lawId?: string): string | undefined {
	if (!lawId || !/^\d+$/.test(lawId)) return undefined;
	return `https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=${lawId}&MevzuatTur=1&MevzuatTertip=5`;
}

async function loadAll(
	manifest: ContentManifest,
): Promise<{ question: Question; topicName: string }[]> {
	const all: { question: Question; topicName: string }[] = [];

	for (const subject of manifest.subjects) {
		for (const topic of subject.topics) {
			if (topic.questionCount === 0) continue;
			const raw = JSON.parse(
				await readFile(
					path.join(CONTENT_DIR, "questions", subject.id, `${topic.slug}.json`),
					"utf8",
				),
			);
			for (const question of questionSchema.array().parse(raw)) {
				all.push({ question, topicName: `${subject.shortName} · ${topic.name}` });
			}
		}
	}
	return all;
}

async function main(): Promise<void> {
	const manifest = contentManifestSchema.parse(
		JSON.parse(await readFile(path.join(CONTENT_DIR, "manifest.json"), "utf8")),
	);
	const all = await loadAll(manifest);

	// --- Maddeye göre kümele ---------------------------------------------------
	const clusters = new Map<string, Cluster>();

	for (const entry of all) {
		const ref = entry.question.legalRef;
		const key = `${ref.lawId ?? ref.law}|${ref.article ?? "-"}`;

		const cluster = clusters.get(key) ?? {
			key,
			law: ref.law,
			lawId: ref.lawId,
			article: ref.article,
			url: ref.url ?? mevzuatUrl(ref.lawId),
			questions: [],
			topics: new Set<string>(),
		};

		cluster.questions.push(entry);
		cluster.topics.add(entry.topicName);
		clusters.set(key, cluster);
	}

	// Etki alanı büyük olan önce: yanlışsa en çok soruyu bozan madde başa gelir.
	const sorted = [...clusters.values()].sort(
		(a, b) =>
			b.questions.length - a.questions.length || a.key.localeCompare(b.key),
	);

	const multi = sorted.filter((c) => c.questions.length > 1);
	const single = sorted.filter((c) => c.questions.length === 1);

	// --- Belge -----------------------------------------------------------------
	const lines: string[] = [];

	lines.push(`# Mevzuat Bazlı Doğrulama Planı

**${all.length} soru**, **${sorted.length} ayrı mevzuat dayanağına** dayanıyor.

Soruları tek tek değil, **madde madde** doğrulayın. Bir maddeyi bir kez açın ve o
maddeye dayanan tüm soruların iddialarını aynı anda kontrol edin. Böylece hem iş
${Math.round((1 - sorted.length / all.length) * 100)}% azalır, hem de aynı olguya dayanan
soruların birbiriyle çelişip çelişmediğini görürsünüz.

> **Neden böyle?** Havuzdaki tek gerçek hata, dört sorunun yürürlükten kalkmış bir
> fıkrayı saymasıydı. Tek tek okunduğunda her biri makul görünüyordu; yan yana
> konduğunda hata anında ortaya çıktı.

## Öncelik sırası

Kümeler **etki alanına** göre sıralanmıştır: en üstteki madde yanlışsa en çok soru bozulur.

- **${multi.length} madde** birden fazla soruya kaynaklık ediyor → **önce bunlar**
- ${single.length} madde tek soruya kaynaklık ediyor → sonra

## Nasıl kullanılır

1. Maddenin resmî metnini açın (bağlantılar aşağıda).
2. Kümedeki **"Doğru kabul edilen"** sütununu maddeyle karşılaştırın.
3. **Sayısal iddialar** satırındaki her rakamı metinde bulun.
4. Uyuşmayan varsa soru kimliğini not edin.
5. Maddeyi bitirince başlıktaki kutuyu işaretleyin.

### Sayı listeleri hakkında iki uyarı

Sayılar açıklama metinlerinden otomatik çıkarılır; **kanıt değil, ipucudur.** Karar
verirken tabloya ve maddenin kendisine bakın.

- **Mevzuat değişikliğini anlatan açıklamalar hem eski hem yeni değeri içerir.**
  Örneğin "3 haftadan 2 haftaya indirilmiştir" cümlesi listeye hem 3 hem 2 hafta
  düşürür; 3 hafta artık yürürlükte değildir. Maddede bulamadığınız her sayı hata
  demek değildir.
- **"Hangisi yanlıştır" sorularının doğru şıkkı kasten yanlıştır.** Onların sayıları
  ayrı satırda listelenir ve maddeyle **uyuşmaMAlıdır**.

---
`);

	function renderCluster(cluster: Cluster, index: number): string {
		const title = cluster.article
			? `${cluster.law} — m. ${cluster.article}`
			: cluster.law;

		// Olumlu ve olumsuz soruların iddiaları ayrı toplanır; karıştırılırsa
		// kasıtlı yanlış ifadeler doğru iddia sanılır.
		const claims = new Set<string>();
		const falseClaims = new Set<string>();

		for (const { question } of cluster.questions) {
			const negative = isNegativeStem(question);
			const target = negative ? falseClaims : claims;
			for (const claim of extractClaims(question, negative)) target.add(claim);
		}

		const rows = cluster.questions
			.map(({ question }) => {
				const negative = isNegativeStem(question);
				const answer = question.options[question.correctIndex]
					.replace(/\s+/g, " ")
					.slice(0, 80);
				const label = negative
					? `**(kasten yanlış ifade)** ${answer}`
					: answer;
				return `| \`${question.id}\` | ${question.difficulty} | ${label} |`;
			})
			.join("\n");

		return `## ☐ ${index}. ${title}

**${cluster.questions.length} soru** · ${[...cluster.topics].join(", ")}${
			cluster.url ? `\n\n🔗 ${cluster.url}` : ""
		}

| Soru | Zorluk | Doğru kabul edilen cevap |
|---|---|---|
${rows}
${
	claims.size > 0
		? `\n**Doğru olduğu iddia edilen sayılar:** ${[...claims].sort().join(" · ")}\n`
		: ""
}${
	falseClaims.size > 0
		? `\n**Kasten yanlış yazılmış sayılar** ("hangisi yanlıştır" sorularının doğru şıkkından; bu değerler maddeyle uyuşMAmalıdır): ${[...falseClaims].sort().join(" · ")}\n`
		: ""
}`;
	}

	lines.push(`# Bölüm 1 — Birden fazla soruya kaynaklık eden maddeler\n`);
	multi.forEach((cluster, i) => lines.push(renderCluster(cluster, i + 1)));

	lines.push(`\n---\n\n# Bölüm 2 — Tek soruya kaynaklık eden maddeler\n`);
	single.forEach((cluster, i) =>
		lines.push(renderCluster(cluster, multi.length + i + 1)),
	);

	await mkdir(path.dirname(OUT_FILE), { recursive: true });
	await writeFile(OUT_FILE, lines.join("\n"), "utf8");

	// --- Konsol raporu ---------------------------------------------------------
	console.log(`\n✔ Doğrulama planı hazır: review/DOGRULAMA-PLANI.md\n`);
	console.log(
		`  ${all.length} soru → ${sorted.length} madde ` +
			`(%${Math.round((1 - sorted.length / all.length) * 100)} daha az iş)\n`,
	);
	console.log(`  En yüksek etki alanına sahip maddeler:`);

	for (const cluster of sorted.slice(0, 8)) {
		const title = cluster.article
			? `${cluster.lawId ?? cluster.law} m.${cluster.article}`
			: cluster.law.slice(0, 40);
		console.log(
			`    ${String(cluster.questions.length).padStart(3)} soru  ${title}`,
		);
	}
	console.log("");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
