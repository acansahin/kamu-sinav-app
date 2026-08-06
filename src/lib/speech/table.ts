import { konusmaMetni } from "@/lib/speech/normalize-tr";

/**
 * Tabloyu seslendirilebilir cümlelere çevirir.
 *
 * Konu özetleri tablo ağırlıklıdır (ölçüldü: 288 satır 2 sütunlu, 71 satır
 * 3 sütunlu, 9 satır 4 sütunlu). Ham okunduğunda tablo tamamen anlamsızdır —
 * motor hücre sınırlarını duyurmaz ve dinleyici hangi değerin hangi sütuna
 * ait olduğunu bilemez.
 *
 * `lib/` kuralı gereği DOM görmez: çağıran taraf `<thead>`/`<tbody>` okumasını
 * yapar, burası yalnızca dizeler üzerinde çalışır ve bu sayede tamamen saf
 * biçimde test edilir.
 */

export interface TabloVerisi {
	/** `<thead>` yoksa boş dizi. */
	basliklar: string[];
	satirlar: string[][];
}

export interface TabloOkumasi {
	/** Tablodan önce okunan tanıtım cümlesi. */
	giris: string;
	/** Satır başına bir cümle; sıra tablodaki sırayla aynıdır. */
	satirlar: string[];
}

/**
 * Sıra sütunu başlıkları.
 *
 * "#" işaretini motor "diyez" diye okur; "No" ise her satırda tekrarlandığında
 * gereksiz gürültü olur. İkisi de atlanır, değerin kendisi zaten sıra bildirir.
 */
const SIRA_BASLIKLARI = new Set(["#", "No", "Nu", "Sıra", "S.No"]);

function temiz(deger: string | undefined): string {
	return konusmaMetni((deger ?? "").trim());
}

/** Cümlenin sonuna nokta koyar — motorun duraklaması buna bağlı. */
function noktala(cumle: string): string {
	const kirpik = cumle.trim();
	if (kirpik.length === 0) return "";
	return /[.!?:;]$/.test(kirpik) ? kirpik : `${kirpik}.`;
}

/**
 * Tabloyu okur.
 *
 * İki sütunlu tabloda başlıklar SATIR BAŞINA TEKRAR EDİLMEZ: iki sütunlu bir
 * tablo aslında bir tanım listesidir ("Ceza → Yetkili makam") ve sekiz satır
 * boyunca "Yetkili makam:" demek dinleyici için işkencedir. Başlıklar giriş
 * cümlesinde bir kez duyulur, bu yeterlidir.
 *
 * Üç ve daha fazla sütunda tekrar ZORUNLUDUR: dinleyici üçüncü değerin hangi
 * sütuna ait olduğunu başka türlü bilemez. Orada ilk hücre başlığıyla
 * anahtarlanır ("Fıkra A."), kalanlar "Başlık: değer" biçiminde okunur.
 */
export function tabloyuOku({ basliklar, satirlar }: TabloVerisi): TabloOkumasi {
	const temizBasliklar = basliklar.map(temiz);
	const sutunSayisi = Math.max(
		temizBasliklar.length,
		...satirlar.map((s) => s.length),
		0,
	);

	const girisParcalari: string[] = ["Tablo."];
	if (temizBasliklar.some((b) => b.length > 0)) {
		girisParcalari.push(`Sütunlar: ${temizBasliklar.filter(Boolean).join(", ")}.`);
	}
	girisParcalari.push(`${satirlar.length} satır.`);

	const ikiSutun = sutunSayisi <= 2;

	const okunanSatirlar = satirlar.map((satir) => {
		const hucreler = satir.map(temiz);

		if (ikiSutun) {
			const [ilk, ikinci] = hucreler;
			if (!ilk && !ikinci) return "";
			if (!ikinci) return noktala(ilk);
			if (!ilk) return noktala(ikinci);
			return noktala(`${ilk}: ${ikinci}`);
		}

		const parcalar: string[] = [];
		hucreler.forEach((hucre, sutun) => {
			// Boş hücre tamamen atlanır; "Durum: ." üretmenin anlamı yok.
			if (hucre.length === 0) return;

			const baslik = temizBasliklar[sutun] ?? "";

			if (sutun === 0) {
				// İlk sütun satırın anahtarıdır: "Fıkra A." — iki nokta konmaz,
				// çünkü bu bir etiket değil, satırın adıdır.
				const siraSutunu = SIRA_BASLIKLARI.has(basliklar[sutun]?.trim() ?? "");
				parcalar.push(
					siraSutunu || baslik.length === 0 ? hucre : `${baslik} ${hucre}`,
				);
				return;
			}

			parcalar.push(baslik.length > 0 ? `${baslik}: ${hucre}` : hucre);
		});

		return parcalar.map(noktala).join(" ");
	});

	return {
		giris: girisParcalari.join(" "),
		satirlar: okunanSatirlar,
	};
}
