/**
 * Cevap anahtarını (numara → doğru şık indeksi) ayrıştırır.
 *
 * Saf ve düzene duyarsız: anahtar PDF'i "1 D 26 A 51 C 76 C" gibi bir ızgaradır
 * ve çıkarımın satır/sütun sırası kaynağa göre değişebilir. Bu yüzden düzeni
 * varsaymak yerine metindeki tüm "sayı + harf" çiftlerini toplarız.
 *
 * `A→0, B→1, C→2, D→3`. Harfi izleyen konumda başka bir harf varsa eşleşme
 * reddedilir ("120 DAKİKA" içindeki "120 D" gibi sahte çiftleri elemek için).
 */

const LETTER_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export function parseKey(text: string): Map<number, number> {
	const answers = new Map<number, number>();

	for (const match of text.matchAll(/(\d{1,3})\s+([ABCD])(?![A-Za-z])/g)) {
		const number = Number(match[1]);
		const index = LETTER_INDEX[match[2]];
		if (index !== undefined) answers.set(number, index);
	}

	return answers;
}
