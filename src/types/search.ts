/**
 * Arama indeksi girdisi.
 *
 * `scripts/build-content.ts` tarafından üretilir, `/arama` sayfası tüketir.
 * Sayfa yükünü küçük tutmak için özetlerin tam gövdesi değil, "bir bakışta"
 * maddeleri ve bölüm başlıkları indekslenir.
 */
export interface SearchEntry {
	kind: "topic" | "question";
	id: string;
	/** Sonuç listesinde gösterilen başlık: konu adı veya soru kökü. */
	title: string;
	/** "657 DMK · Disiplin Cezaları" gibi konum bilgisi. */
	context: string;
	/** Aranabilir gövde; kesit de buradan çıkarılır. */
	body: string;
	subjectId: string;
	topicSlug: string;
}
