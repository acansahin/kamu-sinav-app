/**
 * Tek dosyalık kitapçığı (sorular + cevap anahtarı BİR ARADA) iki metne böler.
 *
 * MEB/ÖDSGM kitapçıkları çoğu zaman soruları ve cevap anahtarını aynı PDF'te
 * taşır. İki parçayı ayırmadan tek metni her iki ayrıştırıcıya vermek işe yaramaz:
 * anahtar ızgarası ("1 E 2 A 3 D…") son sorunun şıkkına bulaşır ve `parseKey`
 * soru gövdelerinden sahte çiftler toplar. Bu yüzden önce KESİN bir sınırdan
 * böleriz.
 *
 * SINIR: "CEVAP ANAHTARI" başlığı — Türk kamu sınav kitapçıklarının değişmez
 * kalıbı. Başlık ("CEVAP ANAHTAR…") tamamen ASCII harften oluşur; bu yüzden
 * `foldForSearch`'e gerek yok, `/i` bayrağı Türkçe I/İ tuzağına düşmeden eşleşir
 * (kasıtlı olarak son "I"dan ÖNCE, "ANAHTAR"da durulur).
 *
 * Başlık bulunamazsa `keyText` boş döner: çağıran ya `--key` ile ayrı bir anahtar
 * PDF'i beklemeli ya da kullanıcıyı uyarmalıdır. Saf: girdi metin, çıktı iki metin.
 */

const KEY_HEADING = /CEVAP\s+ANAHTAR/i;

export function splitBookletAndKey(text: string): {
	bookletText: string;
	keyText: string;
} {
	const index = text.search(KEY_HEADING);
	if (index === -1) {
		return { bookletText: text, keyText: "" };
	}
	return {
		bookletText: text.slice(0, index),
		keyText: text.slice(index),
	};
}
