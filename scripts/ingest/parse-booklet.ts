import type { ParsedQuestion } from "./types";

/**
 * Sınav kitapçığının düz metnini sorulara böler.
 *
 * Saf: girdi metin, çıktı soru dizisi. PDF çıkarımı çağıranın işidir; burası
 * yalnızca metni ayrıştırır, böylece kaynak PDF olmadan test edilebilir.
 *
 * Biçim varsayımı (Türk kamu sınav kitapçıklarının ortak kalıbı):
 *   "N)" ile başlayan satır yeni soruyu, "A)"–"D)" ile başlayan satır şıkkı
 *   açar; markör taşımayan satırlar bir öncekinin devamıdır (gövde/şık sarması).
 *
 * SAYFA ÜSTBİLGİSİ GÜRÜLTÜSÜ: her sayfada tekrarlanan başlık/altbilgi
 * ("T.C. ... BAŞKANLIĞI", kitapçık türü, sayfa no) soru metnine karışmasın diye
 * elenir. Kaynağa özel kelime listesi gömmek yerine genel bir sezgi: aynı kısa
 * satır belge boyunca çok kez geçiyorsa üstbilgidir (soru metni tekrarlamaz).
 */

const QUESTION_START = /^(\d{1,3})\)\s*(.*)$/;
// Şıklar A–E: 4 şıklı (Sayıştay) ve 5 şıklı (MEB/ÖSYM) kitapçıkları birlikte kapsar.
const OPTION_START = /^([A-E])\)\s*(.*)$/;
const PAGE_MARKER = /^=+\s*SAYFA/i;

interface Draft {
	number: number;
	stem: string[];
	options: string[];
	current: string | null;
}

export function parseBooklet(text: string, boilerplateMinCount = 5): ParsedQuestion[] {
	const lines = text.split(/\r?\n/).map((line) => line.trim());

	// Tekrar eden satırların sıklığı — üstbilgi/altbilgi elemesi için.
	const frequency = new Map<string, number>();
	for (const line of lines) {
		if (line) frequency.set(line, (frequency.get(line) ?? 0) + 1);
	}

	const isNoise = (line: string): boolean =>
		line.length === 0 ||
		PAGE_MARKER.test(line) ||
		/^\d{1,3}$/.test(line) || // yalın sayfa numarası
		(frequency.get(line) ?? 0) >= boilerplateMinCount;

	const questions: ParsedQuestion[] = [];
	let draft: Draft | null = null;

	const flush = (): void => {
		if (!draft) return;
		if (draft.current !== null) draft.options.push(draft.current);
		const stem = draft.stem.join(" ").replace(/\s+/g, " ").trim();
		const options = draft.options.map((o) => o.replace(/\s+/g, " ").trim());
		questions.push({
			number: draft.number,
			stem,
			// 4 veya 5 şık geçerli; ikisi de içerik şemasına uyar.
			parseOk: options.length >= 4 && options.length <= 5 && stem.length > 0,
			options,
		});
		draft = null;
	};

	for (const line of lines) {
		if (isNoise(line)) continue;

		const question = QUESTION_START.exec(line);
		if (question) {
			flush();
			draft = {
				number: Number(question[1]),
				stem: question[2] ? [question[2]] : [],
				options: [],
				current: null,
			};
			continue;
		}

		// İlk soru başlamadan gelen kapak/yönerge satırlarını yok say.
		if (!draft) continue;

		const option = OPTION_START.exec(line);
		if (option) {
			if (draft.current !== null) draft.options.push(draft.current);
			draft.current = option[2] ?? "";
			continue;
		}

		// Markörsüz satır: açık şıkkın ya da (henüz şık yoksa) gövdenin devamı.
		if (draft.current !== null) draft.current += ` ${line}`;
		else draft.stem.push(line);
	}
	flush();

	return questions;
}
