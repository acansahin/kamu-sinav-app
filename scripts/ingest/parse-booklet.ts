import type { ParsedQuestion } from "./types";

/**
 * Sınav kitapçığının düz metnini sorulara böler.
 *
 * Saf: girdi metin, çıktı soru dizisi. PDF çıkarımı çağıranın işidir; burası
 * yalnızca metni ayrıştırır, böylece kaynak PDF olmadan test edilebilir.
 *
 * Biçim varsayımı (Türk kamu sınav kitapçıklarının ortak kalıbı):
 *   "N)" (Sayıştay) VEYA "N." (MEB/ÖDSGM) ile başlayan satır yeni soruyu,
 *   "A)"–"E)" ile başlayan satır şıkkı açar; markör taşımayan satırlar bir
 *   öncekinin devamıdır (gövde/şık sarması). 4 ve 5 şıklı kitapçık birlikte kapsanır.
 *
 * `N.` MARKÖRÜ İKİ AYRIM SORUNU DOĞURUR — ikisi de burada çözülür:
 *
 *   1) NUMARALI YÖNERGE KUTULARI: MEB kitapçığı sorulardan önce BİR YA DA BİRDEN
 *      ÇOK numaralı yönerge kutusu taşır ("1. Sınav saat 10.00'da başlar… 2. …",
 *      ardından "1. Cevap kâğıdını imzalayınız… 2. …"). Bunlar soru DEĞİLDİR ve
 *      numaraları yeniden 1'den başlayabilir. Güvenilir ayrım: bir numaralı blok
 *      ancak A–E ŞIK aldığında gerçek sorudur. İlk şık görülene dek YÖNERGE
 *      bölgesindeyiz; her yeni numaralı madde bir öncekini geçersizler, yalnızca
 *      şık alan blok (gerçek ilk soru) yaşar.
 *
 *   2) GÖVDEDEKİ ALT-MADDELER: "Aşağıdakilerden hangileri?" tipi sorular gövdede
 *      "1. ... 2. ... 3. ..." numaralı ifadeler taşır. Bunlar YENİ SORU DEĞİL,
 *      gövdenin parçasıdır. İlk şık görüldükten SONRA (soru bölgesinde), şık
 *      gelmeden gelen numara gövdenin devamı sayılır.
 *
 * SINIR: Soru bölgesi ilk A–E şıkkıyla açıldığından, kitapçıktaki İLK soru kendi
 * şıklarından önce numaralı alt-madde taşıyorsa (henüz yönerge bölgesindeyken)
 * gövdesi bozulabilir. MEB'de ilk soru tipik olarak düz gövdelidir; oluşursa o
 * soru "ayrıştırması bozuk" listesine düşer ve elle bakılır.
 *
 * YATAY DİZİLİ ŞIKLAR: kısa şıklar çoğu kez tek satıra dizilir
 * ("A) 9/1 B) 10/1 C) 10/2 D) 10/3"). Şık satırı bütün olarak taranıp her segment
 * ayrı şık yazılır; satır-başına-bir uzun şıklar da (tek segment + sarma) kapsanır.
 *
 * SAYFA ÜSTBİLGİSİ GÜRÜLTÜSÜ: her sayfada tekrarlanan başlık/altbilgi
 * ("T.C. ... BAŞKANLIĞI", kitapçık türü, sayfa no) soru metnine karışmasın diye
 * elenir. Kaynağa özel kelime listesi gömmek yerine genel bir sezgi: BÜYÜK HARF
 * bir satır belge boyunca çok kez geçiyorsa üstbilgidir. Sıklık tek başına ölçüt
 * DEĞİLDİR — soru metni de tekrar eder ("yanlıştır?" her kitapçıkta onlarca kez)
 * ve elenirse soru sessizce bozulur; ayrımı taşıyan şey mixed-case olmasıdır.
 */

// "N)" (Sayıştay) veya "N." (MEB/ÖDSGM) ile başlayan soru/madde markörü.
const QUESTION_START = /^(\d{1,3})[.)]\s*(.*)$/;
// Satır bir şık markörüyle mi başlıyor? (A–E: 4 ve 5 şıklı kitapçıkları kapsar.)
const OPTION_LINE = /^[A-E]\)/;
// Bir şık satırındaki tüm segmentler — yatay dizili kısa şıkları da böler.
// Her segment: "X)" + sonraki " X)"e (ya da satır sonuna) kadarki metin.
const OPTION_SEGMENT = /([A-E])\)\s*([\s\S]*?)(?=\s+[A-E]\)|$)/g;
const PAGE_MARKER = /^=+\s*SAYFA/i;

interface Draft {
	number: number;
	stem: string[];
	options: string[];
	current: string | null;
}

function splitOptionSegments(line: string): string[] {
	const segments: string[] = [];
	for (const match of line.matchAll(OPTION_SEGMENT)) segments.push(match[2].trim());
	return segments;
}

export function parseBooklet(text: string, boilerplateMinCount = 5): ParsedQuestion[] {
	const lines = text.split(/\r?\n/).map((line) => line.trim());

	// Tekrar eden satırların sıklığı — üstbilgi/altbilgi elemesi için. Sayfa
	// başlığı sayfa numarası taşır ve numara her sayfada değiştiğinden ("2İNŞAAT
	// MÜHENDİSİ A", "4İNŞAAT... A" ya da tek satıra yapışmış "AVUKAT A5ÖLÇME...")
	// düz satır eşleşmesi bunları YAKALAYAMAZ ve son şıkka bulaşır. Bu yüzden
	// RAKAMLAR düşülerek anahtarlanır: dönen başlık tek anahtara toplanıp eşiği aşar.
	const noiseKey = (line: string): string => line.replace(/\d+/g, "#");
	const frequency = new Map<string, number>();
	for (const line of lines) {
		if (line) frequency.set(noiseKey(line), (frequency.get(noiseKey(line)) ?? 0) + 1);
	}

	// Tamamen büyük harf kurumsal başlık/altbilgi mi? Soru gövdesi ve şıklar
	// mixed-case olduğundan bu ayrım güvenlidir; Türkçe I/İ için tr yerel ayarı.
	const isAllCaps = (line: string): boolean => line === line.toLocaleUpperCase("tr");
	const letterCount = (line: string): number => (line.match(/\p{L}/gu) ?? []).length;

	const isNoise = (line: string): boolean => {
		if (line.length === 0 || PAGE_MARKER.test(line)) return true;
		if (/^\d{1,3}$/.test(line)) return true; // yalın sayfa numarası
		// Soru/şık markörü taşıyan satır asla sıklık-gürültüsü sayılmaz: rakam
		// düşülünce yatay sayısal şıklar ("A) 9/1 B) 10/1...") çakışıp elenmesin.
		if (QUESTION_START.test(line) || OPTION_LINE.test(line)) return false;
		const frequencyCount = frequency.get(noiseKey(line)) ?? 0;
		// Sıklık TEK BAŞINA yetmez: soru metni de tekrar eder. Bir kitapçıkta
		// "yanlıştır?" onlarca sorunun gövdesinde kendi satırına sarar (eşiği rahat
		// aşar) ve elenirse soru ANLAM OLARAK TERSİNE döner — "hangisi yanlıştır?"
		// "hangisi?" olur. Aynı şekilde uzun bir kanun adının hecelenmiş devamı
		// ("Rejiminin Düzenlenmesine Dair Kanun Hük-") gövde ortasından sessizce
		// düşer. Bu yüzden yukarıdaki mixed-case ayrımı burada da uygulanır:
		// kurumsal üstbilgi BÜYÜK HARFtir, soru gövdesi değildir.
		if (frequencyCount >= boilerplateMinCount && isAllCaps(line)) return true;
		// Kısa kitapçıklarda (ör. 9 sayfa) üstbilgi eşiği aşamaz ve birden çok
		// yapışık biçime bölünür ("4BAŞLIK A", "BAŞLIK A3ALTBİLGİ", "ALTBİLGİ").
		// Bu satırlar TAMAMEN BÜYÜK HARF ve uzundur; 2+ tekrarla elenir. Yoksa
		// son şıkka bulaşırlar (bkz. Danıştay 2019 sızıntısı).
		if (frequencyCount >= 2 && letterCount(line) >= 15 && isAllCaps(line)) return true;
		return false;
	};

	const questions: ParsedQuestion[] = [];
	let draft: Draft | null = null;

	// İlk A–E şıkkı görülene dek numaralı YÖNERGE kutularını atlarız (yukarı bkz.).
	let sawFirstOption = false;

	const newDraft = (number: number, rest: string): Draft => ({
		number,
		stem: rest ? [rest] : [],
		options: [],
		current: null,
	});
	const appendBody = (d: Draft, line: string): void => {
		if (d.current !== null) d.current += ` ${line}`;
		else d.stem.push(line);
	};
	// Şık satırını işle: yatay dizili segmentleri böler; sonuncuyu (sarabilir)
	// açık bırakır, öncekileri tamamlanmış şık olarak yazar.
	const openOptions = (d: Draft, line: string): void => {
		const segments = splitOptionSegments(line);
		if (segments.length === 0) return;
		if (d.current !== null) d.options.push(d.current);
		for (let i = 0; i < segments.length - 1; i += 1) d.options.push(segments[i]);
		d.current = segments[segments.length - 1] ?? "";
	};

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

		const marker = QUESTION_START.exec(line);
		if (marker) {
			if (!sawFirstOption) {
				// YÖNERGE bölgesi: her numaralı madde bir öncekini geçersizler.
				// Şık alan blok (gerçek ilk soru) hayatta kalır.
				draft = newDraft(Number(marker[1]), marker[2]);
			} else if (draft && draft.options.length === 0 && draft.current === null) {
				// Soru bölgesinde, şık gelmeden yeni numara → gövde içi alt-madde.
				appendBody(draft, line);
			} else {
				flush();
				draft = newDraft(Number(marker[1]), marker[2]);
			}
			continue;
		}

		if (!draft) continue;

		if (OPTION_LINE.test(line)) {
			sawFirstOption = true;
			openOptions(draft, line);
			continue;
		}

		// Markörsüz satır: açık şıkkın ya da (henüz şık yoksa) gövdenin devamı.
		appendBody(draft, line);
	}

	// Son taslak yalnızca soru bölgesine girildiyse gerçektir; yönerge artığını yazmayız.
	if (sawFirstOption) flush();

	return questions;
}
