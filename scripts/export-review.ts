/**
 * Soru havuzunu dış inceleme için Markdown'a aktarır.
 *
 * Amaç, soruları başka bir uzmana veya AI'a doğrulatmak. Çıktı `review/`
 * klasörüne yazılır ve git'e girmez — türetilmiş bir belgedir, kaynak
 * `content/` altındadır.
 *
 * Çalıştırma: npm run review:export
 */
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
const OUT_DIR = path.join(ROOT, "review");

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

/**
 * İnceleyiciye verilen talimat.
 *
 * Kritik nokta: inceleyicinin bilgi kesimi 2026 mevzuat değişikliklerini
 * kapsamayabilir. Bu yüzden "emin değilsen düzeltme, işaretle" demek
 * zorundayız; aksi hâlde güncel içerik eskiye çekilir.
 */
function instructions(manifest: ContentManifest): string {
	return `# Soru İnceleme Talimatı

Aşağıdaki dosyalarda **${manifest.totals.publishedQuestions} çoktan seçmeli soru** var.
Bunlar Türkiye'deki kamu kurumlarında yapılan Görevde Yükselme ve Unvan Değişikliği
sınavlarına hazırlık uygulaması için yazıldı. Her soruda dört şık, işaretlenmiş bir doğru
cevap, bir açıklama ve bir mevzuat dayanağı var.

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
	.map(
		(subject, index) =>
			`- \`${String(index + 1).padStart(2, "0")}-${subject.id}.md\` — ${subject.name} (${subject.questionCount} soru)`,
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

	for (const topic of subject.topics) {
		const questions = questionsByTopic.get(topic.id) ?? [];
		if (questions.length === 0) continue;

		sampleId ||= questions[0].id;
		sections.push(`## ${topic.name}\n`);
		for (const question of questions) {
			counter += 1;
			sections.push(renderQuestion(question, counter));
		}
	}

	return `# ${subject.name}

${subject.questionCount} soru · ${subject.topics.filter((t) => t.questionCount > 0).length} konu

> İnceleme talimatı için \`00-TALIMAT.md\` dosyasına bakın. Bulgularını her zaman
> soru kimliğiyle birlikte bildir — örneğin \`${sampleId}\`. Sıra numaraları
> dosyaya özeldir ve içerik değişince kayar; kimlikler kalıcıdır.

---

${sections.join("\n")}`;
}

async function loadQuestions(
	subject: CompiledSubject,
): Promise<Map<string, Question[]>> {
	const byTopic = new Map<string, Question[]>();

	for (const topic of subject.topics) {
		if (topic.questionCount === 0) continue;
		const file = path.join(
			CONTENT_DIR,
			"questions",
			subject.id,
			`${topic.slug}.json`,
		);
		const raw = JSON.parse(await readFile(file, "utf8"));
		byTopic.set(topic.id, questionSchema.array().parse(raw));
	}
	return byTopic;
}

async function main(): Promise<void> {
	const manifestRaw = JSON.parse(
		await readFile(path.join(CONTENT_DIR, "manifest.json"), "utf8"),
	);
	const manifest = contentManifestSchema.parse(manifestRaw);

	await rm(OUT_DIR, { recursive: true, force: true });
	await mkdir(OUT_DIR, { recursive: true });

	await writeFile(
		path.join(OUT_DIR, "00-TALIMAT.md"),
		instructions(manifest),
		"utf8",
	);

	const allSections: string[] = [];

	for (const [index, subject] of manifest.subjects.entries()) {
		if (subject.questionCount === 0) continue;

		const questionsByTopic = await loadQuestions(subject);
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
		`${instructions(manifest)}\n---\n\n${allSections.join("\n\n---\n\n")}`,
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
		`\n  Toplam ${manifest.totals.publishedQuestions} soru.` +
			`\n  Büyük dosya kabul etmeyen bir sohbete ders dosyalarını tek tek verin.\n`,
	);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
