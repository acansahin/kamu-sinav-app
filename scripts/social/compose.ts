import {
	DERS_ETIKETLERI,
	ETIKETLER,
	INSTAGRAM_KARAKTER_SINIRI,
	UYGULAMA_URL,
	X_KARAKTER_SINIRI,
} from "./config";
import type { PaylasilabilirBilgi, PaylasilabilirSoru } from "./pool";
import type { Platform } from "./types";

/**
 * Paylaşım metinleri. `select.ts` gibi **saf**: girdi içerik nesnesi, çıktı
 * dize. Testler bu yüzden ağ ve dosya olmadan çalışır.
 *
 * ⚠️ **X metinlerine BAĞLANTI KONMAZ.** X, Şubat 2026'da kullandıkça öde
 * modeline geçti: gönderi başına ~$0,015, ama içinde bağlantı varsa ~$0,20
 * ek — tek bir adres o paylaşımın maliyetini on üç katına çıkarıyor. Günde
 * iki paylaşımda fark aylık ~$1 ile ~$13 arasındadır. Bu yüzden X'te çağrı
 * etkileşim üzerinden kurulur ("Şıklar görselde", "Cevabı akşam
 * paylaşıyoruz") ve adres profildeki bağlantıda durur. Facebook ve
 * Instagram metinlerinde adres VARDIR; orada böyle bir ücret yok.
 *
 * Tek istisna `duyuruMetni`dir: kilometre taşı paylaşımı ayda birden seyrek
 * ve amacı doğrudan yönlendirme olduğu için ek ücrete değer.
 *
 * Uzun ve kısa biçim ayrımı bilinçlidir. X'te 280 karakter sert bir sınırdır
 * ve aşılırsa API `403` döner — hata paylaşım anında, yani cron'un içinde
 * görülür. Bu yüzden sınır burada, üretim anında uygulanır ve metin **kelime
 * sınırından** kısaltılır: karakterden kesmek Türkçede sözcüğü ortadan
 * bölüyor ve okunmaz bir kuyruk bırakıyordu.
 */

const SIK_HARFLERI = ["A", "B", "C", "D", "E"];

export function secenekHarfi(index: number): string {
	return SIK_HARFLERI[index] ?? String(index + 1);
}

/**
 * X'in karakter sayımı: her bağlantı, gerçek uzunluğu ne olursa olsun t.co
 * kısaltması üzerinden **23 karakter** sayılır. Ham `length` kullanmak, uzun
 * bir Play adresiyle sınırın altında görünüp API tarafında reddedilmek
 * demekti.
 */
export function xUzunluk(metin: string): number {
	return metin.replace(/https?:\/\/\S+/g, "x".repeat(23)).length;
}

/**
 * Metni kelime sınırından kısaltır. Sınırın altındaysa dokunmaz; üstündeyse
 * son tam kelimeden sonra tek karakterlik üç nokta (…) bırakır.
 */
export function kisalt(metin: string, limit: number): string {
	if (metin.length <= limit) return metin;
	if (limit <= 1) return "…";

	const kesik = metin.slice(0, limit - 1);
	const bosluk = kesik.lastIndexOf(" ");

	return `${(bosluk > limit * 0.5 ? kesik.slice(0, bosluk) : kesik).trimEnd()}…`;
}

/** Boş satırları koruyarak parçaları birleştirir; baştaki/sondaki boşluk gider. */
function birlestir(parcalar: (string | null)[]): string {
	return parcalar
		.filter((p): p is string => p !== null && p !== "")
		.join("\n\n")
		.trim();
}

/**
 * Platformun ortak etiketleri + dersin ek etiketleri. Instagram etiketleri
 * küçük harfle yazıldığı için ders etiketi de o platformda küçültülür
 * (`toLocaleLowerCase("tr")` — varsayılan yerel ayar "I"yı "i" yapar).
 */
export function etiketSatiri(platform: Platform, subjectId?: string): string {
	const ders = subjectId ? (DERS_ETIKETLERI[subjectId] ?? []) : [];
	const ek =
		platform === "instagram"
			? ders.map((e) => e.toLocaleLowerCase("tr"))
			: platform === "facebook"
				? ders.slice(0, 1)
				: [];
	const tum: string[] = [...ETIKETLER[platform]];

	// Ders etiketi marka etiketinden önce gelsin; marka hep sonda.
	const marka = tum.findIndex((e) => /kamusınavakademi/i.test(e));

	tum.splice(marka >= 0 ? marka : tum.length, 0, ...ek);

	return [...new Set(tum)].join(" ");
}

export type XParca = {
	metin: string;
	/**
	 * Bu uzunluğun altına düşen parça kısaltılmaz, tamamen ATILIR. Yarım
	 * kalmış bir açıklama ("Yönetmelik m.3, olağanüstü…") hiç olmamasından
	 * kötüdür.
	 */
	asgari?: number;
	/**
	 * Bu parçanın alabileceği en büyük pay.
	 *
	 * Tavansız dağıtımda önce gelen parça kalanın TAMAMINI yutuyordu: 250
	 * karakterlik tek bir şık, cevabın dayanağını ve açıklamasını tümden
	 * dışarı itiyordu. Tavan, önceliği "önce doyar" anlamında tutar,
	 * "hepsini alır" anlamına gelmesini engeller.
	 */
	tavan?: number;
	/** Kısaltılamaz parça: etiketler ve bağlantılar. */
	sabit?: boolean;
	/** Pay dağıtım sırası; küçük olan önce doyurulur. Varsayılan: dizi sırası. */
	oncelik?: number;
};

/**
 * Parçaları X'in 280 karakterine sığdırır.
 *
 * Naif yaklaşım — "gövdeyi kısalt, gerisi sabit" — yetmedi: cevap
 * paylaşımında SABİT sandığımız parça (doğru şık) tek başına 250 karakteri
 * bulabiliyor ve kalan pay eksiye düşüyordu; sonuç 368 karakterlik, API
 * tarafından reddedilecek bir metindi.
 *
 * Bu yüzden pay **öncelik sırasına göre** dağıtılır: önce gelen parça
 * ihtiyacı kadarını alır, sonrakilere kalan verilir. Payı `asgari`nin altına
 * düşen parça atılır ve dağıtım baştan yapılır — atılan parçanın ayırıcısı
 * da geri kazanılır. Çıktı sırası dizideki sıradır, dağıtım sırası değil.
 *
 * ⚠️ Esnek parçalara bağlantı KONMAZ: pay hesabı t.co uzunluğuyla yapılır
 * ama kısaltma ham karakterle çalışır; ikisi bir arada bağlantıyı ortadan
 * bölerdi. Bağlantılar `sabit: true` parçalara girer.
 */
export function xeSigdir(parcalar: XParca[]): string {
	const dahil = parcalar.map(() => true);

	for (;;) {
		const indeksler = parcalar
			.map((_, i) => i)
			.filter((i) => dahil[i] && parcalar[i].metin !== "");
		const ayirici = Math.max(0, indeksler.length - 1) * 2;
		const sabitUzunluk = indeksler
			.filter((i) => parcalar[i].sabit)
			.reduce((toplam, i) => toplam + xUzunluk(parcalar[i].metin), 0);

		let kalan = X_KARAKTER_SINIRI - ayirici - sabitUzunluk;
		const paylar = new Map<number, number>();
		const dagitimSirasi = indeksler
			.filter((i) => !parcalar[i].sabit)
			.sort(
				(a, b) => (parcalar[a].oncelik ?? a) - (parcalar[b].oncelik ?? b),
			);
		let dusecek = -1;

		for (const i of dagitimSirasi) {
			const istenen = Math.min(
				xUzunluk(parcalar[i].metin),
				parcalar[i].tavan ?? Number.POSITIVE_INFINITY,
			);
			const verilen = Math.max(0, Math.min(istenen, kalan));

			// Doğal uzunluğu zaten asgarinin altında olan parça atılmaz —
			// kısa olmak eksiklik değil.
			if (verilen < Math.min(istenen, parcalar[i].asgari ?? 0)) {
				dusecek = i;
				break;
			}

			paylar.set(i, verilen);
			kalan -= verilen;
		}

		if (dusecek >= 0) {
			dahil[dusecek] = false;
			continue;
		}

		return indeksler
			.map((i) =>
				parcalar[i].sabit
					? parcalar[i].metin
					: kisalt(parcalar[i].metin, paylar.get(i) ?? 0),
			)
			.join("\n\n");
	}
}

/**
 * Künyeyi verilen uzunluğa indirir ama MADDE NUMARASINI asla kesmez.
 *
 * Yönetmelik ve kararname adları 80–120 karakteri buluyor ("Güvenlik
 * Soruşturması ve Arşiv Araştırması Yapılmasına Dair Yönetmelik md. 11/6").
 * Düz kısaltma sondan kestiği için X metninde "…Yönetmelik md.…" kalıyordu:
 * künyenin tek işe yarar parçası olan madde numarası kayboluyordu. Kısaltma bu
 * yüzden metin adından yapılır, " md. …" eki korunur.
 */
export function dayanakSigdir(dayanak: string, limit: number): string {
	if (dayanak.length <= limit) return dayanak;

	const ek = dayanak.match(/ md\. .+$/)?.[0] ?? "";

	return `${kisalt(dayanak.slice(0, dayanak.length - ek.length), limit - ek.length)}${ek}`;
}

/** Kartta zaten görünen şıkların metin gövdesindeki karşılığı. */
function siklarMetni(soru: PaylasilabilirSoru): string {
	return soru.options
		.map((sik, index) => `${secenekHarfi(index)}) ${sik}`)
		.join("\n");
}

export function soruMetni(
	soru: PaylasilabilirSoru,
	platform: Platform,
): string {
	if (platform === "x") {
		return xeSigdir([
			{ metin: `📌 Günün sorusu · ${soru.subjectAdi}`, sabit: true },
			{ metin: soru.stem, asgari: 60 },
			{
				metin: "Şıklar görselde. Cevabı akşam paylaşıyoruz 👇",
				sabit: true,
			},
			{ metin: etiketSatiri("x", soru.subjectId), sabit: true },
		]);
	}

	const metin = birlestir([
		`📌 GÜNÜN SORUSU · ${soru.subjectAdi} — ${soru.konuAdi}`,
		soru.stem,
		siklarMetni(soru),
		soru.dayanakTuru === "mevzuat"
			? "Sen hangisini işaretlerdin? Cevabı ve mevzuat dayanağını akşam paylaşıyoruz."
			: "Sen hangisini işaretlerdin? Cevabı ve kaynağını akşam paylaşıyoruz.",
		soru.dayanakTuru === "mevzuat"
			? `Kaynağı belli, mevzuat dayanaklı sorularla hazırlan:\n${UYGULAMA_URL}`
			: `Kaynağı belli, açıklamalı sorularla hazırlan:\n${UYGULAMA_URL}`,
		etiketSatiri(platform, soru.subjectId),
	]);

	return platform === "instagram"
		? kisalt(metin, INSTAGRAM_KARAKTER_SINIRI)
		: metin;
}

export function cevapMetni(
	soru: PaylasilabilirSoru,
	platform: Platform,
): string {
	const dogru = `${secenekHarfi(soru.correctIndex)}) ${soru.options[soru.correctIndex]}`;

	if (platform === "x") {
		// Öncelik sırası: doğru cevap > dayanak > açıklama. Paylaşımın sebebi
		// cevap; açıklama sığmazsa görselde ve uygulamada zaten var.
		return xeSigdir([
			{ metin: `✅ Cevap: ${dogru}`, asgari: 30, tavan: 150, oncelik: 0 },
			{ metin: soru.explanation, asgari: 70, oncelik: 2 },
			{
				metin: `📚 ${dayanakSigdir(soru.dayanak, 86)}`,
				asgari: 25,
				tavan: 90,
				oncelik: 1,
			},
			{ metin: etiketSatiri("x", soru.subjectId), sabit: true },
		]);
	}

	const metin = birlestir([
		`✅ CEVAP: ${dogru}`,
		`Soru: ${soru.stem}`,
		soru.explanation,
		`📚 Dayanak: ${soru.dayanak}`,
		// "Her sorunun mevzuat dayanağı var" artık doğru değil: Türkçe ve genel
		// kültür soruları kaynağa, sayısal mantık çözüme dayanıyor.
		soru.dayanakTuru === "mevzuat"
			? `Mevzuat sorularının her birinde madde dayanağı ve açıklama var:\n${UYGULAMA_URL}`
			: `Açıklamalı, kaynağı belli sorularla hazırlan:\n${UYGULAMA_URL}`,
		etiketSatiri(platform, soru.subjectId),
	]);

	return platform === "instagram"
		? kisalt(metin, INSTAGRAM_KARAKTER_SINIRI)
		: metin;
}

export function bilgiMetni(
	bilgi: PaylasilabilirBilgi,
	platform: Platform,
): string {
	if (platform === "x") {
		return xeSigdir([
			{ metin: `💡 ${bilgi.konuAdi}`, asgari: 10, tavan: 60, oncelik: 1 },
			{ metin: bilgi.metin, asgari: 60, tavan: 170, oncelik: 0 },
			{
				metin: `📚 ${dayanakSigdir(bilgi.dayanak, 86)}`,
				asgari: 25,
				tavan: 90,
				oncelik: 2,
			},
			{ metin: etiketSatiri("x", bilgi.subjectId), sabit: true },
		]);
	}

	const metin = birlestir([
		`💡 BİLGİ · ${bilgi.subjectAdi} — ${bilgi.konuAdi}`,
		bilgi.metin,
		`📚 Dayanak: ${bilgi.dayanak}`,
		`Konu özetleri, testler ve denemeler:\n${UYGULAMA_URL}`,
		etiketSatiri(platform, bilgi.subjectId),
	]);

	return platform === "instagram"
		? kisalt(metin, INSTAGRAM_KARAKTER_SINIRI)
		: metin;
}

/**
 * Elle tetiklenen duyuru. Metni operatör verir; hat yalnızca çağrı ve
 * etiketleri ekler — böylece duyuru da diğer paylaşımlarla aynı imzayı taşır.
 */
export function duyuruMetni(govde: string, platform: Platform): string {
	if (platform === "x") {
		return xeSigdir([
			{ metin: govde, asgari: 40 },
			{ metin: UYGULAMA_URL, sabit: true },
			{ metin: etiketSatiri("x"), sabit: true },
		]);
	}

	return birlestir([govde, UYGULAMA_URL, etiketSatiri(platform)]);
}

/**
 * Görsel metni. Görseli göremeyen kullanıcı ve ekran okuyucular için;
 * X ve Facebook alt metni ayrı alanda kabul eder.
 */
export function altMetinSoru(soru: PaylasilabilirSoru): string {
	return `Soru kartı: ${soru.stem} Şıklar: ${siklarMetni(soru).replace(/\n/g, " ")}`;
}

export function altMetinCevap(soru: PaylasilabilirSoru): string {
	return `Cevap kartı: ${soru.stem} Doğru cevap ${secenekHarfi(soru.correctIndex)} şıkkı: ${soru.options[soru.correctIndex]}. Dayanak: ${soru.dayanak}`;
}

export function altMetinBilgi(bilgi: PaylasilabilirBilgi): string {
	return `Bilgi kartı: ${bilgi.metin} Dayanak: ${bilgi.dayanak}`;
}
