import { konusmaMetni } from "@/lib/speech/normalize-tr";
import {
	bloklaraAyir,
	duraklardanBol,
	motorTavaniniUygula,
} from "@/lib/speech/sentences";
import { tabloyuOku } from "@/lib/speech/table";
import type { SpeechChunk } from "@/lib/speech/types";

/**
 * Render edilmiş özet DOM'unu seslendirme parçalarına çevirir.
 *
 * NEDEN DOM, ham MDX değil: `compileMDX` + `remark-gfm` zaten gerçek
 * `<table><thead><th>` yapısı üretiyor, `<Madde>` bileşeni `sr-only` önekini
 * basıyor, `<Kritik>`/`<Tuzak>` başlıklarını hazır veriyor. Ham MDX'ten aynı
 * yere varmak markdown tablo ayrıştırıcısı yazmayı gerektirirdi. Ayrıca
 * derleme zamanı bir `speechText` alanı üretmek 30 konu sayfasının HTML'ini
 * büyütürdü; bu yol sıfır bayt ekler.
 *
 * Bu, `lib/speech/` altında DOM'a dokunan TEK dosyadır; geri kalanı saf dize
 * mantığıdır ve `node` ortamında test edilir.
 */

/**
 * Kendi başına bir vurgulama birimi oluşturan elemanlar.
 *
 * `TABLE` ve `TR` burada YOK: tablolar ayrı bir dalda işleniyor (satır satır
 * vurgulanabilmeleri için). `ASIDE` de yok — `<Kritik>`/`<Tuzak>` kutularının
 * içindeki `<p>`ler kendi blokları olsun diye. Kutunun başlığı ("Kritik bilgi")
 * zaten bir `<p>`dir ve böylece doğal bir sesli ayraç hâline gelir.
 */
const BLOK_ETIKETLERI = new Set([
	"H1",
	"H2",
	"H3",
	"H4",
	"P",
	"LI",
	"BLOCKQUOTE",
]);

/**
 * Gövdedeki tekrar bölümünün başlığı.
 *
 * 30 MDX dosyasının 17'sinde gövde `## Bir bakışta` ile kapanıyor ve içeriği
 * `SummaryDocument`ın en üstte bastığı `keyPoints` kartıyla neredeyse birebir
 * aynı. İkisi de okunursa dinleyici aynı özeti başta ve sonda duyar.
 */
const TEKRAR_BASLIGI = "Bir bakışta";

/** Uzunluğu bunu aşan `<code>` içeriği okunmaz, tarif edilir. */
const KOD_OKUMA_SINIRI = 40;

/**
 * Kodu okunamaz kılan asıl şey uzunluk değil, uzun rakam dizileridir.
 *
 * Gerçek örnek (`resmi-yazisma/belgenin-bolumleri.mdx`): `E-67915368-903.07.02-4752`
 * yalnızca 25 karakter, yani uzunluk sınırının altında — ama motor "67915368"i
 * "altmış yedi milyon dokuz yüz on beş bin üç yüz altmış sekiz" diye okur ve
 * cümle tamamen kaybolur. Beş ve daha uzun rakam dizisi bu yüzden tek başına
 * yeterli bir işaret.
 */
const UZUN_RAKAM_DIZISI = /\d{5,}/;

function elemanMi(dugum: Node): dugum is HTMLElement {
	return dugum.nodeType === 1;
}

/**
 * Bu eleman ve altındaki her şey atlanmalı mı?
 *
 * Atlama SEÇİCİYLE DEĞİL NİTELİKLE yapılıyor. Seçici bir *yerleşim* olgusunu
 * kodlar ("başlıktan sonraki ikinci paragraf") ve ilk yeniden biçimlendirmede
 * sessizce yanlış şeyi atlamaya başlar. Nitelik bir *niyet* olgusunu kodlar
 * ("bu okunmasın") ve taşındığı yerde de doğru kalır.
 *
 * `data-print="hide"` bilinçli olarak YENİDEN KULLANILIYOR: kâğıda basılmayan
 * şey zaten içerik değil, uygulamanın kendi kromudur (butonlar, gezinti).
 * İkinci bir liste tutmak ikisinin zamanla ayrışması demekti.
 */
function atlanirMi(el: HTMLElement): boolean {
	const etiket = el.tagName;
	if (etiket === "SCRIPT" || etiket === "STYLE") return true;
	/*
	 * SVG (lucide ikonları) atlanır. Etiket adı hem "svg" hem "SVG" olarak
	 * kontrol ediliyor: HTML elemanlarının `tagName`i büyük harfe çevrilir ama
	 * SVG elemanları kendi yazımını KORUR, yani gerçek DOM'da "svg" gelir.
	 * Tek biçime güvenmek ikonların metne sızmasına yol açıyordu.
	 */
	if (etiket === "svg" || etiket === "SVG") return true;
	if (el.hasAttribute("hidden")) return true;
	if (el.getAttribute("aria-hidden") === "true") return true;
	if (el.getAttribute("data-tts") === "skip") return true;
	if (el.getAttribute("data-print") === "hide") return true;
	// `<Madde>` bileşeninin "Mevzuat referansı: " öneki. Normalleştirme zaten
	// "657 sayılı Kanun madde 1" ürettiği için bu okunursa tekrar olur.
	if (el.classList.contains("sr-only")) return true;
	return false;
}

/** Bir elemanın okunacak düz metni — atlanan alt ağaçlar hariç. */
function metniTopla(el: HTMLElement): string {
	let sonuc = "";

	for (const cocuk of Array.from(el.childNodes)) {
		if (cocuk.nodeType === 3) {
			sonuc += cocuk.nodeValue ?? "";
			continue;
		}
		if (!elemanMi(cocuk)) continue;
		if (atlanirMi(cocuk)) continue;

		if (cocuk.tagName === "CODE") {
			const kod = (cocuk.textContent ?? "").trim();
			// Belge numarası gibi diziler okunduğunda dinleyiciye hiçbir şey
			// katmaz, akışı tamamen bozar. Kısa kodlar ("GİH") okunur; tiresi
			// varsa duraklama için virgüle çevrilir.
			const okunamaz =
				kod.length > KOD_OKUMA_SINIRI || UZUN_RAKAM_DIZISI.test(kod);
			sonuc += okunamaz ? " kod örneği " : ` ${kod.replace(/-/g, ", ")} `;
			continue;
		}

		sonuc += metniTopla(cocuk);
	}

	return sonuc;
}

/** Tablodan `TabloVerisi` çıkarır. */
function tabloVerisi(tablo: HTMLTableElement): {
	basliklar: string[];
	satirElemanlari: { el: HTMLElement; hucreler: string[] }[];
} {
	const basliklar = Array.from(tablo.querySelectorAll("thead th")).map((th) =>
		metniTopla(th as HTMLElement).trim(),
	);

	const govdeSatirlari = Array.from(tablo.querySelectorAll("tr")).filter(
		(tr) => tr.querySelector("td") !== null,
	);

	return {
		basliklar,
		satirElemanlari: govdeSatirlari.map((tr) => ({
			el: tr as HTMLElement,
			hucreler: Array.from(tr.children).map((h) =>
				metniTopla(h as HTMLElement).trim(),
			),
		})),
	};
}

/**
 * Bloğun sonuna sonlandırıcı noktalama koyar.
 *
 * Ölçüldü: 197 liste öğesinin 142'si hiçbir noktalama taşımıyor. Motor
 * sonlandırıcı noktalama görmeyince düşen kontur uygulamaz; art arda gelen
 * öğeler "listeyi bitirmemiş" hissi verir ve okuma askıda kalır.
 *
 * İki nokta üst üste KORUNUR: liste girişleri ("Şunlar sayılır:") askıda kontur
 * ister, nokta oradaki beklentiyi bozar.
 */
function blokSonunuNoktala(metin: string): string {
	const son = metin[metin.length - 1];
	if (".!?…:".includes(son)) return metin;
	if (son === "," || son === ";") return `${metin.slice(0, -1)}.`;
	return `${metin}.`;
}

/**
 * Kökü gezip seslendirme parçalarını üretir.
 *
 * Hiçbir zaman `throw` etmez: tanımadığı bir yapı düz metin olarak okunur.
 * İleride içeriğe yeni bir bileşen eklenirse özellik sessizce kırılmasın diye
 * böyle; bu davranış testle sabitlenmiştir.
 */
/**
 * Metni parçalara ayırır ve DURAK SINIRLARINI işaretler.
 *
 * Durak işaretinden bölünen her bölümün SON parçası `duraklat: true` alır;
 * okuma döngüsü o parçadan sonra sessizlik bekler. Sessizliği motordan almak
 * mümkün olmadı (gerekçe: `types.ts` → DURAK_SURESI_MS).
 *
 * @param bol Bölümü kendi içinde parçalara ayıran işlev. Düz bloklarda cümle
 *   paketlemesi (`bloklaraAyir`), tablo satırlarında yalnızca motor tavanı —
 *   cümle paketlemesi tablo satırı için yanlış.
 */
function isaretle(
	metin: string,
	bol: (bolum: string) => string[],
): { text: string; duraklat?: boolean }[] {
	const bolumler = duraklardanBol(metin);
	const sonuc: { text: string; duraklat?: boolean }[] = [];

	bolumler.forEach((bolum, i) => {
		const sonBolum = i === bolumler.length - 1;
		const parcalar = bol(bolum);

		parcalar.forEach((text, j) => {
			const sonParca = j === parcalar.length - 1;
			sonuc.push(
				!sonBolum && sonParca ? { text, duraklat: true } : { text },
			);
		});
	});

	return sonuc;
}

export function cikar(kok: HTMLElement): SpeechChunk[] {
	const parcalar: SpeechChunk[] = [];

	/** Gövde içindeki tekrar bölümü başladı mı? */
	let tekrarBolumunde = false;
	/** Tekrar kuralının uygulanacağı kapsam (`data-tts="body"`). */
	let govdeKapsami: HTMLElement | null = null;

	function ekle(el: HTMLElement, metin: string): void {
		const hazir = konusmaMetni(metin);
		if (hazir.length === 0) return;

		// Başlıklar hariç: başlık bir cümle değildir ve utterance sınırı gereken
		// duraklamayı zaten veriyor. Sonuna nokta koymak onu cümleye benzetir.
		const kapali = /^H[1-4]$/.test(el.tagName)
			? hazir
			: blokSonunuNoktala(hazir);

		for (const parca of isaretle(kapali, bloklaraAyir)) {
			parcalar.push({ ...parca, el });
		}
	}

	function gez(dugum: Node): void {
		if (!elemanMi(dugum)) return;
		const el = dugum;
		if (atlanirMi(el)) return;

		if (el.getAttribute("data-tts") === "body") govdeKapsami = el;

		/*
		 * Gövdedeki `## Bir bakışta` bölümü atlanır — ama YALNIZCA gövde
		 * kapsamında. `SummaryDocument`ın kendi kartındaki başlık da aynı metni
		 * taşıyor; düz metin eşleşmesi ikisini birden atlar ve o zaman
		 * hiçbir dosyada özet duyulmazdı.
		 */
		if (govdeKapsami?.contains(el) === true && /^H[1-4]$/.test(el.tagName)) {
			const baslik = (el.textContent ?? "").trim();
			tekrarBolumunde = baslik === TEKRAR_BASLIGI;
			if (tekrarBolumunde) return;
		}
		if (tekrarBolumunde && govdeKapsami?.contains(el) === true) return;

		if (el.tagName === "TABLE") {
			const { basliklar, satirElemanlari } = tabloVerisi(el as HTMLTableElement);
			const okuma = tabloyuOku({
				basliklar,
				satirlar: satirElemanlari.map((s) => s.hucreler),
			});

			// Giriş cümlesi tablonun kendisinde vurgulanır, satırlar kendi
			// <tr>'lerinde: 8 satırlık bir tabloyu 40 saniye tek blok olarak
			// vurgulamak dinleyiciyi kaybettirirdi.
			if (okuma.giris.length > 0) {
				for (const parca of isaretle(okuma.giris, motorTavaniniUygula)) {
					parcalar.push({ ...parca, el });
				}
			}
			okuma.satirlar.forEach((satir, i) => {
				if (satir.length === 0) return;
				// Tablo satırı zaten `tabloyuOku` tarafından noktalanmış geliyor;
				// yalnızca durak ayrımı ve motor tavanı uygulanır.
				for (const parca of isaretle(satir, motorTavaniniUygula)) {
					parcalar.push({ ...parca, el: satirElemanlari[i].el });
				}
			});
			return;
		}

		if (BLOK_ETIKETLERI.has(el.tagName)) {
			// Liste öğesi başka bir liste içeriyorsa (iç içe liste) alt öğeler
			// kendi bloklarını alır; üst öğenin kendi metni ayrıca okunur.
			const icListe = el.querySelector(":scope > ul, :scope > ol");
			if (icListe === null) {
				ekle(el, metniTopla(el));
				return;
			}
		}

		if (el.tagName === "LI") {
			// İç içe listede önce öğenin kendi metni, sonra alt liste.
			const kendiMetni = Array.from(el.childNodes)
				.filter((c) => c.nodeType === 3 || (elemanMi(c) && !/^(UL|OL)$/.test(c.tagName)))
				.map((c) => (elemanMi(c) ? metniTopla(c) : (c.nodeValue ?? "")))
				.join("");
			ekle(el, kendiMetni);
		}

		for (const cocuk of Array.from(el.childNodes)) gez(cocuk);
	}

	for (const cocuk of Array.from(kok.childNodes)) gez(cocuk);

	/*
	 * Sıralı liste öğelerinin numarası DOM metninde yoktur (işaretçi CSS
	 * üretimidir). Numara eklenmezse "birinci, ikinci, üçüncü" ayrımı sesli
	 * okumada tamamen kaybolur.
	 */
	numaralandir(kok, parcalar);

	return parcalar;
}

/** `<ol>` öğelerinin ilk parçasına sıra numarası öneki ekler. */
function numaralandir(kok: HTMLElement, parcalar: SpeechChunk[]): void {
	for (const ol of Array.from(kok.querySelectorAll("ol"))) {
		const ogeler = Array.from(ol.children).filter((c) => c.tagName === "LI");
		ogeler.forEach((li, i) => {
			const ilk = parcalar.find((p) => p.el === li);
			if (ilk) ilk.text = `${i + 1}. ${ilk.text}`;
		});
	}
}
