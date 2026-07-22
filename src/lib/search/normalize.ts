/**
 * Türkçe duyarlı arama normalleştirmesi — saf fonksiyonlar.
 *
 * İki ayrı sorunu birlikte çözer:
 *
 * 1. **Türkçe büyük/küçük harf.** JavaScript'in varsayılan `toLowerCase()`
 *    fonksiyonu "İ" harfini "i̇" (nokta + birleşen nokta) yapar ve "I" harfini
 *    "i"ye çevirir. Türkçede "I" küçük harfi "ı"dır. Bu yüzden `tr` yerel
 *    ayarı zorunludur.
 *
 * 2. **Aksansız yazım.** Kullanıcı "disiplin cezalari" yazıp "Disiplin
 *    Cezaları"nı bulabilmeli. Klavyeden Türkçe karakter çıkarmak zahmetlidir
 *    ve mobilde çoğu kullanıcı aksansız yazar; arama bunu affetmeli.
 */

const FOLD_MAP: Record<string, string> = {
	ç: "c",
	ğ: "g",
	ı: "i",
	ö: "o",
	ş: "s",
	ü: "u",
	â: "a",
	î: "i",
	û: "u",
};

/**
 * Aranabilir biçime indirger: Türkçe küçük harf + aksan sadeleştirme.
 *
 * Hem indeks hem sorgu bu fonksiyondan geçer; ikisi aynı fonksiyonu
 * kullanmadığı sürece eşleşme güvenilir olmaz.
 */
export function foldForSearch(value: string): string {
	return value
		.toLocaleLowerCase("tr")
		.replace(/[çğıöşüâîû]/g, (char) => FOLD_MAP[char] ?? char);
}

/** Sorguyu anlamlı kelimelere böler. */
export function tokenize(query: string): string[] {
	return foldForSearch(query)
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 1);
}

export interface SearchableItem {
	/** Normalleştirilmiş aranabilir metin. */
	haystack: string;
}

/**
 * Tüm kelimeleri içeren kayıtları döner (AND mantığı).
 *
 * OR yerine AND seçildi: kullanıcı iki kelime yazdığında ikisini de içeren
 * sonucu bekler. "disiplin ceza" araması, yalnızca "ceza" geçen her soruyu
 * getirirse arama işe yaramaz hâle gelir.
 */
export function matchesAllTokens(
	item: SearchableItem,
	tokens: readonly string[],
): boolean {
	return tokens.every((token) => item.haystack.includes(token));
}

/**
 * Eşleşen kelimenin etrafından okunabilir bir kesit çıkarır.
 *
 * Kesit ORİJİNAL metinden alınır; kullanıcıya aksanı sadeleştirilmiş metin
 * gösterilmez. Konum normalleştirilmiş kopyada bulunur ve orijinale
 * uygulanır — bu yalnızca iki metnin uzunluğu eşitse doğrudur. Türkçe
 * yerel ayarında öyle olması beklenir, ancak varsayıma güvenilmez:
 * uzunluk farklıysa konum atlanır ve baştan kesit verilir.
 */
export function extractSnippet(
	original: string,
	tokens: readonly string[],
	radius = 70,
): string {
	const folded = foldForSearch(original);
	const aligned = folded.length === original.length;

	const position = aligned
		? tokens
				.map((token) => folded.indexOf(token))
				.filter((index) => index >= 0)
				.sort((a, b) => a - b)[0]
		: undefined;

	if (position === undefined || original.length <= radius * 2) {
		return original.slice(0, radius * 2);
	}

	const start = Math.max(0, position - radius);
	const end = Math.min(original.length, position + radius);

	return `${start > 0 ? "…" : ""}${original.slice(start, end).trim()}${
		end < original.length ? "…" : ""
	}`;
}
