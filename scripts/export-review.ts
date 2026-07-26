/**
 * Soru havuzunu dış inceleme için Markdown'a aktarır.
 *
 * Amaç, soruları başka bir uzmana veya AI'a doğrulatmak. Çıktı `review/`
 * klasörüne yazılır ve git'e girmez — türetilmiş bir belgedir, kaynak
 * `content/` altındadır.
 *
 * Sorular DERLENMİŞ çıktıdan değil KAYNAKTAN okunur: `public/content` yalnızca
 * `published` soruları taşır, oysa asıl inceleme ihtiyacı henüz yayımlanmamış
 * `review` kuyruğundadır. Manifest yalnızca ders/konu adları ve sıralaması için
 * kullanılır.
 *
 * Çalıştırma:
 *   npm run review:export                      # yayındakiler (varsayılan)
 *   npm run review:export -- --status review   # teyit kuyruğu
 *   npm run review:export -- --status all
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
	type CompiledSubject,
	type ContentManifest,
	type Question,
	contentManifestSchema,
	questionSchema,
} from "../src/types/content";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_DIR = path.join(ROOT, "public", "content");
const SOURCE_DIR = path.join(ROOT, "content", "subjects");
const OUT_DIR = path.join(ROOT, "review");

/** Şık sayısı 4 VEYA 5 olabilir (Sayıştay 4, MEB 5); etiket dizisi ikisini de karşılar. */
const OPTION_LABELS = ["A", "B", "C", "D", "E"] as const;

/** Dışa aktarılacak soruların durumu. */
type StatusFilter = "published" | "review" | "draft" | "all";

const STATUS_LABEL: Record<StatusFilter, string> = {
	published: "yayında olan",
	review: "teyit kuyruğundaki (henüz yayımlanmamış)",
	draft: "taslak",
	all: "havuzdaki tüm",
};

/**
 * `review` kuyruğu için ek uyarı.
 *
 * Bu sorular resmî çıkmış sınavlardan geliyor: gövde, şıklar ve doğru cevap
 * OTORİTER (kurumun kendi cevap anahtarı). İnsan katkısı olan ve dolayısıyla
 * yanılabilir olan kısım açıklama ile mevzuat dayanağıdır. İnceleyicinin
 * enerjisini oraya yöneltmek gerekiyor; yoksa resmî anahtarı "düzeltmeye"
 * kalkışıyor.
 */
const REVIEW_QUEUE_NOTE = `
## Bu dosyadaki soruların özel durumu

Bunlar **henüz yayımlanmamış**, teyit bekleyen sorulardır. Çoğu resmî çıkmış
sınavlardan ithal edildi (kaynak satırında \`official-past-exam\` yazanlar):

- **Soru kökü, şıklar ve işaretlenen doğru cevap resmî kaynaktandır** — kurumun
  kendi yayımladığı cevap anahtarından gelir. Bunları yeniden yazma; yalnızca
  bugünkü mevzuata göre hâlâ geçerli olup olmadığını sorgula.
- **Açıklama ve mevzuat dayanağı insan/AI katkısıdır** — asıl denetlenecek yer
  burasıdır.

Karar üç şekilde olabilir: soruyu onayla (yayına alınır), düzelt, ya da havuzdan
çıkar. Havuzdan çıkarmayı gerektiren tipik durumlar: mevzuatı değişmiş soru,
tek bir kuruma özgü düzenlemeye dayanan soru, mevzuat dayanağı olmayan kavramsal
soru, birden fazla şıkkı yanlış olan kusurlu kitapçık sorusu.
`;

/**
 * İnceleyiciye verilen talimat.
 *
 * Kritik nokta: inceleyicinin bilgi kesimi 2026 mevzuat değişikliklerini
 * kapsamayabilir. Bu yüzden "emin değilsen düzeltme, işaretle" demek
 * zorundayız; aksi hâlde güncel içerik eskiye çekilir.
 */
function instructions(
	manifest: ContentManifest,
	status: StatusFilter,
	counts: Map<string, number>,
	total: number,
): string {
	return `# Soru İnceleme Talimatı

Aşağıdaki dosyalarda **${total} çoktan seçmeli soru** var (${STATUS_LABEL[status]} sorular).
Bunlar Türkiye'deki kamu kurumlarında yapılan Görevde Yükselme ve Unvan Değişikliği
sınavlarına hazırlık uygulaması için yazıldı. Her soruda dört veya beş şık, işaretlenmiş
bir doğru cevap, bir açıklama ve bir mevzuat dayanağı var.
${status === "review" ? REVIEW_QUEUE_NOTE : ""}

## Senden istenen

Her soru için şu beş şeyi ayrı ayrı denetle:

1. **İşaretlenen cevap doğru mu?** Yürürlükteki mevzuata göre.
2. **Açıklama doğru mu ve cevabı gerçekten gerekçelendiriyor mu?**
3. **Mevzuat dayanağı doğru mu?** Verilen kanun ve madde numarası konuyla örtüşüyor mu?
4. **Çeldiriciler savunulabilir mi?** Birden fazla şık doğru olabiliyor mu, ya da yanlış
   şıklar bariz şekilde saçma mı (soruyu kolaylaştırır)?
5. **Soru kökü belirsiz mi?** Birden fazla okumaya açık mı?

## Çok önemli: güncellik ve emin olamama

Bu içerik **Temmuz 2026** itibarıyla yürürlükteki mevzuata göre yazıldı. Senin bilgi
kesimin bu tarihten önce olabilir. Bu durumda:

- **Bir rakamın yanlış olduğundan emin değilsen, DÜZELTME — "doğrulanmalı" olarak işaretle.**
- Özellikle 2026'da yapılan değişikliklere dikkat et. Hatırladığın değerle dosyadaki
  değer farklıysa, bu bir hata olabileceği gibi senin bilmediğin bir değişiklik de olabilir.
- Emin olmadığın her durumda kesin dille "yanlış" deme; "kontrol edilmeli" de.

Yanlış bir "düzeltme", hatalı sorudan daha zararlıdır: güncel bir bilgiyi eskiye çeker.

## Çıktı biçimi

Yalnızca **sorunlu bulduğun** soruları listele. Sorunsuz olanları tek tek onaylama,
sadece sonda kaç tanesini incelediğini yaz.

Her bulgu için:

\`\`\`
SORU ID: 657-disiplin-011
SORUN: [cevap-yanlis | aciklama-hatali | dayanak-yanlis | celdirici-sorunlu | belirsiz | guncellik-suphesi]
GÜVEN: [kesin | muhtemel | doğrulanmalı]
AÇIKLAMA: Neyin yanlış olduğu ve doğrusunun ne olduğu, mümkünse madde numarasıyla.
\`\`\`

**Soru ID'sini mutlaka yaz** — düzeltmeler kaynak dosyalara bu kimlikle işlenecek.

## Dosyalar

${manifest.subjects
	.filter((subject) => (counts.get(subject.id) ?? 0) > 0)
	.map(
		(subject, index) =>
			`- \`${String(index + 1).padStart(2, "0")}-${subject.id}.md\` — ${subject.name} (${counts.get(subject.id) ?? 0} soru)`,
	)
	.join("\n")}

Tamamı tek dosyada: \`tum-sorular.md\`

---

*Üretim tarihi: ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}*
`;
}

function renderQuestion(question: Question, index: number): string {
	const options = question.options
		.map((option, i) => {
			const marker =
				i === question.correctIndex ? "  ← **İŞARETLENEN DOĞRU CEVAP**" : "";
			return `- **${OPTION_LABELS[i]})** ${option}${marker}`;
		})
		.join("\n");

	const ref = [
		question.legalRef.law,
		question.legalRef.article && `m. ${question.legalRef.article}`,
		question.legalRef.clause && `fıkra/bent ${question.legalRef.clause}`,
	]
		.filter(Boolean)
		.join(", ");

	return `### ${index}. \`${question.id}\` · ${question.difficulty}

${question.stem}

${options}

**Açıklama (uygulamada kullanıcıya gösteriliyor):**
${question.explanation}

**Mevzuat dayanağı:** ${ref}
**Kaynak:** ${question.source.kind} · ${question.source.origin}
**Son güncelleme:** ${question.updatedAt}
`;
}

function renderSubject(
	subject: CompiledSubject,
	questionsByTopic: Map<string, Question[]>,
): string {
	let counter = 0;
	const sections: string[] = [];
	let sampleId = "";
	let topicCount = 0;

	for (const topic of subject.topics) {
		const questions = questionsByTopic.get(topic.id) ?? [];
		if (questions.length === 0) continue;

		sampleId ||= questions[0].id;
		topicCount += 1;
		sections.push(`## ${topic.name}\n`);
		for (const question of questions) {
			counter += 1;
			sections.push(renderQuestion(question, counter));
		}
	}

	return `# ${subject.name}

${counter} soru · ${topicCount} konu

> İnceleme talimatı için \`00-TALIMAT.md\` dosyasına bakın. Bulgularını her zaman
> soru kimliğiyle birlikte bildir — örneğin \`${sampleId}\`. Sıra numaraları
> dosyaya özeldir ve içerik değişince kayar; kimlikler kalıcıdır.

---

${sections.join("\n")}`;
}

/**
 * Bir dersin sorularını KAYNAKTAN okur ve duruma göre süzer.
 *
 * Derlenmiş çıktı yalnızca `published` taşıdığı için kaynak dosyalar okunur;
 * konu adı ve sırası manifestten gelir. Kaynakta karşılığı olmayan konu atlanır.
 */
async function loadQuestions(
	subject: CompiledSubject,
	status: StatusFilter,
): Promise<Map<string, Question[]>> {
	const byTopic = new Map<string, Question[]>();

	for (const topic of subject.topics) {
		const file = path.join(SOURCE_DIR, subject.id, "questions", `${topic.slug}.json`);
		if (!existsSync(file)) continue;
		const raw = JSON.parse(await readFile(file, "utf8"));
		const questions = questionSchema
			.array()
			.parse(raw)
			.filter((question) => status === "all" || question.status === status);
		if (questions.length > 0) byTopic.set(topic.id, questions);
	}
	return byTopic;
}

function parseStatus(argv: readonly string[]): StatusFilter {
	const index = argv.indexOf("--status");
	if (index === -1) return "published";
	const value = argv[index + 1];
	if (value === "published" || value === "review" || value === "draft" || value === "all") {
		return value;
	}
	console.error(`HATA: --status için geçersiz değer: ${String(value)}`);
	console.error("Kullanılabilir: published (varsayılan), review, draft, all");
	process.exit(1);
}

async function main(): Promise<void> {
	const status = parseStatus(process.argv.slice(2));
	const manifestRaw = JSON.parse(
		await readFile(path.join(CONTENT_DIR, "manifest.json"), "utf8"),
	);
	const manifest = contentManifestSchema.parse(manifestRaw);

	// Önce hepsini yükle: talimat metni ders başına sayıları içeriyor.
	const loaded = new Map<string, Map<string, Question[]>>();
	const counts = new Map<string, number>();
	for (const subject of manifest.subjects) {
		const byTopic = await loadQuestions(subject, status);
		const count = [...byTopic.values()].reduce((sum, list) => sum + list.length, 0);
		loaded.set(subject.id, byTopic);
		counts.set(subject.id, count);
	}
	const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

	if (total === 0) {
		console.error(`\n✖ "${status}" durumunda soru yok; dosya üretilmedi.\n`);
		process.exit(1);
	}

	await rm(OUT_DIR, { recursive: true, force: true });
	await mkdir(OUT_DIR, { recursive: true });

	const talimat = instructions(manifest, status, counts, total);
	await writeFile(path.join(OUT_DIR, "00-TALIMAT.md"), talimat, "utf8");

	const allSections: string[] = [];

	for (const [index, subject] of manifest.subjects.entries()) {
		const questionsByTopic = loaded.get(subject.id);
		if (questionsByTopic === undefined || (counts.get(subject.id) ?? 0) === 0) continue;

		const body = renderSubject(subject, questionsByTopic);

		await writeFile(
			path.join(OUT_DIR, `${String(index + 1).padStart(2, "0")}-${subject.id}.md`),
			body,
			"utf8",
		);
		allSections.push(body);
	}

	await writeFile(
		path.join(OUT_DIR, "tum-sorular.md"),
		`${talimat}\n---\n\n${allSections.join("\n\n---\n\n")}`,
		"utf8",
	);

	// --- Rapor ---------------------------------------------------------------
	const files = await readdir(OUT_DIR);
	console.log(`\n✔ İnceleme dosyaları hazır: review/\n`);

	for (const file of files.sort()) {
		const size = (await readFile(path.join(OUT_DIR, file), "utf8")).length;
		console.log(
			`  ${file.padEnd(24)} ${String(Math.round(size / 1024)).padStart(4)} KB`,
		);
	}

	console.log(
		`\n  Toplam ${total} soru (${STATUS_LABEL[status]}).` +
			`\n  Büyük dosya kabul etmeyen bir sohbete ders dosyalarını tek tek verin.\n`,
	);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
