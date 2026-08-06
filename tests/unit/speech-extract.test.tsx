// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SummaryDocument } from "@/features/study/summary-document";
import { cikar } from "@/lib/speech/extract";
import type { SummaryDoc } from "@/types/content";

/**
 * DOM → seslendirme parçaları.
 *
 * Bu, `lib/speech/` altında DOM'a dokunan tek modül; geri kalanı saf dize
 * mantığı ve `node` ortamında test ediliyor.
 */

afterEach(cleanup);

/** HTML dizesinden gerçek bir DOM kökü kurar. */
function kok(html: string): HTMLElement {
	const el = document.createElement("div");
	el.innerHTML = html;
	document.body.append(el);
	return el;
}

const metinleri = (html: string) => cikar(kok(html)).map((p) => p.text);

describe("blok üretimi", () => {
	it("paragrafları ayrı bloklara ayırır", () => {
		const parcalar = cikar(kok("<p>Birinci paragraf.</p><p>İkinci paragraf.</p>"));
		expect(parcalar).toHaveLength(2);
		expect(parcalar[0].el.tagName).toBe("P");
		expect(parcalar[0].el).not.toBe(parcalar[1].el);
	});

	/**
	 * Parça = blok. Bir paragraf ancak üst sınırı aşınca bölünür ve o zaman bile
	 * parçalar AYNI elemana bağlı kalır — vurgu paragrafın tamamında durur.
	 */
	it("bölünen paragrafın parçaları aynı elemanı paylaşır", () => {
		const cumle = "Bu cümle blok üst sınırını doldurmak için yazılmıştır.";
		const parcalar = cikar(kok(`<p>${`${cumle} `.repeat(10).trim()}</p>`));

		expect(parcalar.length).toBeGreaterThan(1);
		expect(new Set(parcalar.map((p) => p.el)).size).toBe(1);
	});

	it("kısa paragrafı TEK parça verir", () => {
		const metin = metinleri(
			"<p>Birinci cümle. İkinci cümle. Üçüncü cümle burada biter.</p>",
		);
		expect(metin).toEqual([
			"Birinci cümle. İkinci cümle. Üçüncü cümle burada biter.",
		]);
	});

	it("başlıkları da okur", () => {
		expect(metinleri("<h2>Kapsam</h2><p>Metin.</p>")).toEqual([
			"Kapsam",
			"Metin.",
		]);
	});

	it("vurgu kutusunun başlığı ayrı bir blok olur", () => {
		// <Kritik> bileşeninin gerçek çıktısı: <aside><p>başlık</p><div><p>…
		const metin = metinleri(
			'<aside><p><svg></svg>Kritik bilgi</p><div><p>Gövde metni.</p></div></aside>',
		);
		expect(metin).toEqual(["Kritik bilgi.", "Gövde metni."]);
	});
});

/**
 * Blok sonu noktalaması.
 *
 * Ölçüldü: 197 liste öğesinin 142'si hiçbir sonlandırıcı noktalama taşımıyor.
 * Motor onu görmeyince düşen konturu uygulamaz ve art arda gelen öğeler
 * "listeyi bitirmemiş" gibi duyulur.
 */
describe("blok sonu noktalaması", () => {
	it("noktalamasız bloğun sonuna nokta ekler", () => {
		expect(metinleri("<li>Kritik bilgi</li>")).toEqual(["Kritik bilgi."]);
	});

	it("virgül ve noktalı virgülü noktaya çevirir", () => {
		expect(metinleri("<li>Birinci öğe,</li><li>İkinci öğe;</li>")).toEqual([
			"Birinci öğe.",
			"İkinci öğe.",
		]);
	});

	/** Liste girişi askıda kontur ister; nokta oradaki beklentiyi bozar. */
	it("iki nokta üst üsteyi KORUR", () => {
		expect(metinleri("<p>Şunlar sayılır:</p>")).toEqual(["Şunlar sayılır:"]);
	});

	/** Başlık cümle değildir; utterance sınırı duraklamayı zaten veriyor. */
	it("başlıklara nokta EKLEMEZ", () => {
		expect(metinleri("<h2>Kapsam</h2><h3>Alt başlık</h3>")).toEqual([
			"Kapsam",
			"Alt başlık",
		]);
	});
});

describe("atlanan içerik", () => {
	it("data-tts='skip' taşıyan ağacı atlar", () => {
		expect(metinleri('<p data-tts="skip">Gizli.</p><p>Okunur.</p>')).toEqual([
			"Okunur.",
		]);
	});

	/** Kâğıda basılmayan şey uygulamanın kendi kromudur, içerik değil. */
	it("data-print='hide' taşıyan ağacı atlar", () => {
		expect(metinleri('<div data-print="hide"><p>Buton.</p></div><p>Metin.</p>')).toEqual([
			"Metin.",
		]);
	});

	it("sr-only önekini atlar — normalleştirme zaten madde adını üretiyor", () => {
		expect(
			metinleri('<p><span class="sr-only">Mevzuat referansı: </span>657 s.K. m.1</p>'),
		).toEqual(["657 sayılı Kanun madde 1."]);
	});

	it("ikonları ve aria-hidden ağaçları atlar", () => {
		expect(metinleri("<p><svg>x</svg><span aria-hidden='true'>·</span>Metin.</p>")).toEqual([
			"Metin.",
		]);
	});

	it("boş bloklar parça üretmez", () => {
		expect(metinleri("<p>   </p><p>Metin.</p>")).toEqual(["Metin."]);
	});
});

describe("kod örnekleri", () => {
	/**
	 * Gerçek dize `resmi-yazisma/belgenin-bolumleri.mdx:64` içinden. Yalnızca
	 * 25 karakter, yani uzunluk sınırının ALTINDA — ama motor "67915368"i
	 * milyonlu bir sayı olarak okur ve cümle kaybolur. Kuralı tetikleyen şey
	 * uzunluk değil, uzun rakam dizisi.
	 */
	it("belge numarasını tarif eder, rakam rakam okumaz", () => {
		const metin = metinleri(
			"<p>Örnek: <code>E-67915368-903.07.02-4752</code> biçimindedir.</p>",
		);
		expect(metin[0]).toBe("Örnek: kod örneği biçimindedir.");
		expect(metin[0]).not.toContain("67915368");
	});

	it("kısa kodu okur", () => {
		expect(metinleri("<p>Kod: <code>GİH</code> sınıfı.</p>")).toEqual([
			"Kod: GİH sınıfı.",
		]);
	});
});

describe("listeler", () => {
	it("her liste öğesi kendi bloğu olur", () => {
		const parcalar = cikar(kok("<ul><li>Birinci.</li><li>İkinci.</li></ul>"));
		expect(parcalar).toHaveLength(2);
		expect(parcalar[0].el.tagName).toBe("LI");
	});

	/**
	 * Sıra numarası DOM metninde yoktur (işaretçi CSS üretimi). Eklenmezse
	 * sıralamanın kendisi sesli okumada tamamen kaybolur.
	 */
	it("sıralı listeye numara öneki ekler", () => {
		expect(metinleri("<ol><li>Uyarma.</li><li>Kınama.</li></ol>")).toEqual([
			"1. Uyarma.",
			"2. Kınama.",
		]);
	});

	it("işaretli listeye numara EKLEMEZ", () => {
		expect(metinleri("<ul><li>Uyarma.</li></ul>")).toEqual(["Uyarma."]);
	});
});

describe("tablolar", () => {
	const TABLO = `
		<table>
			<thead><tr><th>Fıkra</th><th>Statü</th><th>Durum</th></tr></thead>
			<tbody>
				<tr><td>A</td><td>Memur</td><td>Yürürlükte</td></tr>
				<tr><td>C</td><td>Geçici personel</td><td>Mülga</td></tr>
			</tbody>
		</table>`;

	it("giriş cümlesi ve satır başına bir parça üretir", () => {
		expect(metinleri(TABLO)).toEqual([
			"Tablo. Sütunlar: Fıkra, Statü, Durum. 2 satır.",
			"Fıkra A. Statü: Memur; Durum: Yürürlükte.",
			"Fıkra C. Statü: Geçici personel; Durum: Mülga.",
		]);
	});

	/**
	 * Satırlar kendi <tr>'lerinde vurgulanır: 8 satırlık bir tabloyu 40 saniye
	 * boyunca tek blok olarak vurgulamak dinleyiciyi kaybettirirdi.
	 */
	it("her satır kendi <tr> elemanında vurgulanır", () => {
		const parcalar = cikar(kok(TABLO));
		expect(parcalar[0].el.tagName).toBe("TABLE");
		expect(parcalar[1].el.tagName).toBe("TR");
		expect(parcalar[2].el.tagName).toBe("TR");
		expect(parcalar[1].el).not.toBe(parcalar[2].el);
	});

	it("başlık satırını veri satırı saymaz", () => {
		const parcalar = cikar(kok(TABLO));
		expect(parcalar.filter((p) => p.el.tagName === "TR")).toHaveLength(2);
	});
});

describe("gövdedeki tekrar bölümü", () => {
	/**
	 * 30 dosyanın 17'sinde gövde `## Bir bakışta` ile kapanıyor ve içeriği
	 * üstteki kartla neredeyse aynı. İkisi de okunursa dinleyici aynı özeti
	 * başta ve sonda duyar.
	 */
	it("data-tts='body' içindeki 'Bir bakışta' bölümünü atlar", () => {
		const metin = metinleri(`
			<div data-tts="body">
				<h2>Kapsam</h2><p>Gövde metni.</p>
				<h2>Bir bakışta</h2><ul><li>Tekrar eden madde.</li></ul>
			</div>`);
		expect(metin).toEqual(["Kapsam", "Gövde metni."]);
	});

	/**
	 * KRİTİK: `SummaryDocument`ın kendi kartındaki başlık da "Bir bakışta"
	 * metnini taşıyor. Kural gövde kapsamıyla sınırlanmasaydı ikisi birden
	 * atlanır ve HİÇBİR dosyada özet duyulmazdı.
	 */
	it("gövde kapsamı DIŞINDAKİ 'Bir bakışta' kartını atlamaz", () => {
		const metin = metinleri(`
			<div><h2>Bir bakışta</h2><ul><li>Özet maddesi.</li></ul></div>
			<div data-tts="body"><p>Gövde metni.</p></div>`);
		expect(metin).toEqual(["Bir bakışta", "Özet maddesi.", "Gövde metni."]);
	});

	it("tekrar bölümünden sonra yeni bir başlık gelirse okumaya devam eder", () => {
		const metin = metinleri(`
			<div data-tts="body">
				<h2>Bir bakışta</h2><p>Atlanır.</p>
				<h2>Ek bölüm</h2><p>Okunur.</p>
			</div>`);
		expect(metin).toEqual(["Ek bölüm", "Okunur."]);
	});
});

describe("dayanıklılık", () => {
	/**
	 * İleride içeriğe yeni bir MDX bileşeni eklenirse özellik sessizce
	 * kırılmamalı: tanınmayan yapı düz metin olarak okunur.
	 */
	it("tanımadığı elemanı düz metin olarak okur", () => {
		expect(metinleri("<section><figure><p>Yeni yapı.</p></figure></section>")).toEqual([
			"Yeni yapı.",
		]);
	});

	it("boş kökte boş dizi döner", () => {
		expect(cikar(kok(""))).toEqual([]);
	});
});

describe("SummaryDocument sözleşmesi", () => {
	const OZET: SummaryDoc = {
		topicId: "657-dmk/genel-hukumler",
		subjectId: "657-dmk",
		title: "Genel Hükümler",
		keyPoints: ["Birinci madde.", "İkinci madde."],
		legislationVersion: "657 sayılı Kanun — 2026",
		lastVerifiedAt: "2026-08-01",
		legalRefs: [],
		body: "",
		readingMinutes: 3,
	};

	/**
	 * Bu test bir davranışı değil bir SÖZLEŞMEYİ koruyor: güven damgası
	 * okunmamalı, gövde kapsamı işaretli olmalı. Biri damgayı yeniden
	 * biçimlendirdiğinde doğrulama tarihi sesli okunmaya başlar ve bunu
	 * başka hiçbir test yakalamaz.
	 */
	it("güven damgası atlanır, başlık ve özet okunur", () => {
		const { container } = render(
			<SummaryDocument summary={OZET}>
				<p>Gövde metni.</p>
			</SummaryDocument>,
		);

		const metin = cikar(container).map((p) => p.text);

		expect(metin[0]).toBe("Genel Hükümler");
		expect(metin).toContain("Birinci madde.");
		expect(metin).toContain("Gövde metni.");
		// Güven damgası ve içindeki tarih hiçbir parçada geçmemeli.
		expect(metin.join(" ")).not.toContain("Son doğrulama");
		expect(metin.join(" ")).not.toContain("2026");
	});
});
