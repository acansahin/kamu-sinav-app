import { foldForSearch } from "../../src/lib/search/normalize";
import type { Classification } from "./types";

/**
 * Bir sorunun hangi derse/konuya ait olduğunu mevzuat atfından tahmin eder.
 *
 * Karışık bir kitapçıktaki 100 sorudan yalnızca bizim üç dersimize (657, Anayasa,
 * Etik) ait olanları ayıklamak için. Emin olamadığında `null` döner — yanlış
 * etiketlemek yerine insana bırakmak, "kaynağı doğrulanamayan yayımlanamaz"
 * ilkesiyle aynı çizgidedir.
 *
 * Karşılaştırmalar `foldForSearch`'ten geçer: Türkçe `toLowerCase()` "I"yı "i"
 * yapıp eşleşmeyi sessizce bozar (bkz. AGENTS.md, bilinen tuzaklar); tek doğru
 * yol yerelli küçültme + aksan sadeleştirmedir.
 */
export function classify(stem: string): Classification {
	const s = foldForSearch(stem);
	const has = (needle: string): boolean => s.includes(needle);
	const hasWord = (num: string): boolean =>
		new RegExp(`(^|\\D)${num}(\\D|$)`).test(s);

	// Anayasa — 2709 sayılı Kanun.
	if (hasWord("2709") || has("anayasa")) {
		return { subjectId: "anayasa", topicId: anayasaTopic(s) };
	}

	// Etik — 5176, etik kurulu ve etik davranış/kavram mevzuatı. 657'den ÖNCE
	// bakılır: etik metinleri de "memur"dan söz eder, 657 kuralı onları kapmasın.
	// "etik" kökü KELİME-SINIRIYLA yakalanır: yalın "etik" (etik kavramları/ilkeleri)
	// ve çekimli "etiği"/"etiğe" (foldlanınca "etigi"/"etige") dâhil; ama "etiket"
	// ve "-etik" ekli sözcükler (estetik, sentetik, genetik) HARİÇ — ilki `(?!et)`
	// negatif ileri-bakışıyla, ikincisi `\b` sözcük sınırıyla elenir.
	if (hasWord("5176") || /\beti[kg](?!et)/.test(s)) {
		return { subjectId: "etik", topicId: etikTopic(s) };
	}

	// Disiplin — Devlet Memurları Disiplin Yönetmeliği. 657'ye atıf yapmadan
	// "disiplin"i konu ederler; yine de memur disiplin rejimine aittir. "Çıkarma
	// cezası" (en ağır disiplin cezası) çekim ekiyle geçtiği için ("memurluğundan
	// çıkarma") kanun atfı olmadan da yakalanır.
	if (has("disiplin yonetmeligi") || has("cikarma cezasi")) {
		return { subjectId: "657-dmk", topicId: "657-dmk/disiplin-cezalari" };
	}

	// 657 — Devlet Memurları Kanunu.
	if (hasWord("657") || has("devlet memurlari kanunu")) {
		return { subjectId: "657-dmk", topicId: dmkTopic(s) };
	}

	return { subjectId: null, topicId: null };
}

function anayasaTopic(s: string): string | null {
	if (s.includes("temel hak") || s.includes("hurriyet") || s.includes("ozgurluk")) {
		return "anayasa/temel-hak-ve-odevler";
	}
	if (s.includes("tbmm") || s.includes("yasama") || s.includes("millet meclisi")) {
		return "anayasa/yasama";
	}
	if (s.includes("cumhurbaskan") || s.includes("yurutme") || s.includes("kararname")) {
		return "anayasa/yurutme";
	}
	if (
		s.includes("yargi") ||
		s.includes("mahkeme") ||
		s.includes("danistay") ||
		s.includes("hakim")
	) {
		return "anayasa/yargi";
	}
	if (
		s.includes("genel esas") ||
		s.includes("cumhuriyet") ||
		s.includes("egemenlik") ||
		s.includes("nitelik")
	) {
		return "anayasa/genel-esaslar";
	}
	return null;
}

function dmkTopic(s: string): string | null {
	if (s.includes("disiplin")) return "657-dmk/disiplin-cezalari";
	if (s.includes("temel ilke")) return "657-dmk/temel-ilkeler";
	if (s.includes("yasak")) return "657-dmk/yasaklar";
	if (s.includes("atama") || s.includes("yer degis") || s.includes("nakil")) {
		return "657-dmk/atama-ve-yer-degistirme";
	}
	if (
		s.includes("sona er") ||
		s.includes("cekilme") ||
		s.includes("emekli") ||
		s.includes("cikarma")
	) {
		return "657-dmk/memurlugun-sona-ermesi";
	}
	if (
		s.includes("odev") ||
		s.includes("sorumluluk") ||
		s.includes("sadakat") ||
		s.includes("tarafsizlik")
	) {
		return "657-dmk/odevler-ve-sorumluluklar";
	}
	if (
		s.includes("hizmet sinif") ||
		s.includes("kadro") ||
		s.includes("memurluga alin") ||
		s.includes("adayl")
	) {
		return "657-dmk/genel-hukumler";
	}
	return null;
}

function etikTopic(s: string): string | null {
	if (s.includes("cikar catis") || s.includes("hediye")) {
		return "etik/cikar-catismasi-ve-hediye";
	}
	if (s.includes("saydaml") || s.includes("hesap ver") || s.includes("bilgi edinme")) {
		return "etik/saydamlik-ve-hesap-verebilirlik";
	}
	if (s.includes("5176") || s.includes("etik kurul")) {
		return "etik/etik-kurul-ve-mevzuat";
	}
	if (
		s.includes("etik davranis") ||
		s.includes("kamu hizmeti bilinci") ||
		s.includes("halka hizmet")
	) {
		return "etik/etik-davranis-ilkeleri";
	}
	return null;
}
