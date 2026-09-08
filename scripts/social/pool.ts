import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import {
	questionSchema,
	subjectSchema,
	summaryFrontmatterSchema,
} from "../../src/types/content";

/**
 * Sosyal medya havuzu: paylaşılabilir içeriği `content/subjects/**` altından
 * okur.
 *
 * `public/content/` DEĞİL kaynak okunur. İkisi de aynı veriyi taşır ama
 * derlenmiş klasör git'te yoktur; oradan okumak sosyal iş akışını
 * `content:build`e — dolayısıyla tüm Next.js kurulumuna — bağlardı. Kaynağı
 * okumak iş akışını saniyeler mertebesinde tutar.
 *
 * Karşılığında `status` filtresini burada uygulamak ZORUNLU: kaynak klasörde
 * taslak ve incelemedeki sorular da vardır ve paylaşılmaları telif/kalite
 * güvencesini delerdi.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SUBJECTS_DIR = path.join(ROOT, "content", "subjects");

export type PaylasilabilirSoru = {
	id: string;
	subjectId: string;
	subjectAdi: string;
	konuAdi: string;
	stem: string;
	options: string[];
	correctIndex: number;
	explanation: string;
	/** "657 sayılı Kanun md. 125/A-a" biçiminde tek satıra indirilmiş dayanak */
	dayanak: string;
};

export type PaylasilabilirBilgi = {
	/** `${subjectId}/${slug}#${index}` */
	refId: string;
	subjectId: string;
	subjectAdi: string;
	konuAdi: string;
	metin: string;
	dayanak: string;
};

export type Havuz = {
	sorular: PaylasilabilirSoru[];
	bilgiler: PaylasilabilirBilgi[];
};

/**
 * `legalRef` nesnesini tek satırlık okunabilir dayanağa indirir.
 *
 * Kanun adı tam hâliyle çok uzun ("5176 sayılı Kamu Görevlileri Etik Kurulu
 * Kurulması ve Bazı Kanunlarda Değişiklik Yapılması Hakkında Kanun") ve karta
 * sığmaz; `lawId` varsa kısa biçim tercih edilir. `lawId` yoksa tam ad
 * kullanılır — kısaltma uydurmak yanlış dayanak göstermek olurdu.
 */
export function dayanakMetni(legalRef: {
	law: string;
	lawId?: string;
	article?: string;
	clause?: string;
}): string {
	const ad = legalRef.lawId ? `${legalRef.lawId} sayılı Kanun` : legalRef.law;
	const madde = legalRef.article ? ` md. ${legalRef.article}` : "";
	const fikra = legalRef.clause ? `/${legalRef.clause}` : "";

	return `${ad}${madde}${fikra}`;
}

/** Dizin var mı diye sormak yerine okumayı dener; yoksa boş döner. */
async function klasorleriOku(dir: string): Promise<string[]> {
	try {
		const girisler = await readdir(dir, { withFileTypes: true });

		return girisler.filter((g) => g.isDirectory()).map((g) => g.name);
	} catch {
		return [];
	}
}

async function jsonOku(dosya: string): Promise<unknown> {
	return JSON.parse(await readFile(dosya, "utf8"));
}

export async function havuzuOku(): Promise<Havuz> {
	const sorular: PaylasilabilirSoru[] = [];
	const bilgiler: PaylasilabilirBilgi[] = [];

	for (const dersId of await klasorleriOku(SUBJECTS_DIR)) {
		const dersDir = path.join(SUBJECTS_DIR, dersId);
		const subject = subjectSchema.parse(
			await jsonOku(path.join(dersDir, "subject.json")),
		);

		for (const topic of subject.topics) {
			const konuAdi = topic.name;

			// --- Sorular ---
			try {
				const ham = await jsonOku(
					path.join(dersDir, "questions", `${topic.slug}.json`),
				);

				for (const aday of diziOlarakOku(ham)) {
					const soru = questionSchema.parse(aday);

					// Yalnızca yayımlanmış içerik paylaşılır; taslak ve
					// incelemedeki sorular kaynak klasörde de duruyor.
					if (soru.status !== "published") continue;

					sorular.push({
						id: soru.id,
						subjectId: subject.id,
						subjectAdi: subject.shortName,
						konuAdi,
						stem: soru.stem,
						options: soru.options,
						correctIndex: soru.correctIndex,
						explanation: soru.explanation,
						dayanak: dayanakMetni(soru.legalRef),
					});
				}
			} catch (hata) {
				if (!dosyaYok(hata)) throw hata;
			}

			// --- Konu özetinin "Bir bakışta" maddeleri ---
			try {
				const mdx = await readFile(
					path.join(dersDir, "topics", `${topic.slug}.mdx`),
					"utf8",
				);
				const frontmatter = summaryFrontmatterSchema.parse(
					matter(mdx).data,
				);
				const ozetDayanak = frontmatter.legalRefs[0]
					? dayanakMetni(frontmatter.legalRefs[0])
					: subject.name;

				frontmatter.keyPoints.forEach((metin, index) => {
					bilgiler.push({
						refId: `${subject.id}/${topic.slug}#${index}`,
						subjectId: subject.id,
						subjectAdi: subject.shortName,
						konuAdi,
						metin,
						dayanak: ozetDayanak,
					});
				});
			} catch (hata) {
				if (!dosyaYok(hata)) throw hata;
			}
		}
	}

	return { sorular, bilgiler };
}

/** `readFile`/`readdir` ENOENT'i; konu özeti veya soru dosyası henüz yoksa. */
function dosyaYok(hata: unknown): boolean {
	return (
		typeof hata === "object" &&
		hata !== null &&
		"code" in hata &&
		(hata as { code?: string }).code === "ENOENT"
	);
}

/** Soru dosyası bir dizi olmak zorunda; değilse şema hatası anlaşılmaz olurdu. */
function diziOlarakOku(ham: unknown): unknown[] {
	if (!Array.isArray(ham)) {
		throw new Error("Soru dosyası bir dizi olmalı");
	}

	return ham;
}
