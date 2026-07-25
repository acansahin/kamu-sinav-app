/**
 * Çıkmış sınav ithal hattının veri tipleri.
 *
 * Bu tipler `src/types/content.ts`'teki `Question`'dan BİLİNÇLİ olarak ayrıdır:
 * resmî kaynak soruyu, şıkları ve (anahtardan) doğru cevabı verir; ama şemamızın
 * zorunlu kıldığı `legalRef` ve `explanation`'ı VERMEZ. Bu yüzden ithal çıktısı
 * yayımlanabilir bir `Question` değil, insan onayı bekleyen bir ADAYDIR. Editoryal
 * alanlar (difficulty, topicId, legalRef, explanation) sonradan doldurulur ve
 * ancak o zaman `content/subjects/**` altına taşınıp `content:build`'den geçer.
 */

/** Kaynak sınavın kimlik bilgisi — CLI'dan gelir, her adaya damgalanır. */
export interface SourceMeta {
	/** Somut köken: "T.C. Sayıştay Başkanlığı GYS (Memur) A Kitapçığı" gibi. */
	origin: string;
	year?: number;
	url?: string;
}

/** Kitapçık ayrıştırmasının ham çıktısı — henüz sınıflandırılmamış. */
export interface ParsedQuestion {
	/** Kaynak sınavdaki soru numarası; izlenebilirlik ve anahtarla eşleşme için. */
	number: number;
	stem: string;
	options: string[];
	/** 4 veya 5 şık ve boş olmayan gövde varsa `true`; yoksa insan bakmalı. */
	parseOk: boolean;
}

/** Bir dersin/konunun kime ait olduğu — sınıflandırıcının kararı. */
export interface Classification {
	subjectId: string | null;
	topicId: string | null;
}

/**
 * İnceleme kuyruğuna yazılan aday soru.
 *
 * `null` olan her alan bir insanın (ya da Faz 5'te AI'ın, yine onaylı) doldurması
 * gereken editoryal boşluktur. `content:build` bunların hiçbirini boş bırakılmış
 * hâlde yayına sokmaz.
 */
export interface CandidateQuestion {
	number: number;
	subjectId: string | null;
	topicId: string | null;
	/** Resmî kaynak zorluk etiketi vermez; editör atar. */
	difficulty: null;
	stem: string;
	options: string[];
	/** Resmî cevap anahtarından; anahtar eksikse `null`. */
	correctIndex: number | null;
	/** Editoryal — mevzuat dayanağı sonradan yazılır/teyit edilir. */
	legalRef: null;
	/** Editoryal — açıklama sonradan yazılır. */
	explanation: null;
	source: {
		kind: "official-past-exam";
		origin: string;
		year?: number;
		url?: string;
		license: "public-official";
	};
	status: "draft";
}

/** İthalin kapsam raporu — kitapçık başına verimi somut gösterir. */
export interface CoverageReport {
	totalParsed: number;
	/** Ayrıştırması bozuk (4 şık çıkmayan) soru numaraları. */
	parseFailures: number[];
	/** Derse göre eşleşen aday sayısı. */
	bySubject: Record<string, number>;
	/** Hiçbir derse eşleşmeyen (kapsam dışı / kuruma özgü) aday sayısı. */
	unmatched: number;
	/** Cevap anahtarında karşılığı bulunamayan soru numaraları. */
	missingAnswer: number[];
}
