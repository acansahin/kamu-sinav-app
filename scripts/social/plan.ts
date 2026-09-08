import {
	altMetinBilgi,
	altMetinCevap,
	altMetinSoru,
	bilgiMetni,
	cevapMetni,
	duyuruMetni,
	secenekHarfi,
	soruMetni,
} from "./compose";
import { KART_UZANTI, VARLIK_TABANI } from "./config";
import type { Havuz } from "./pool";
import { bilgiSec, cevapSec, soruSec } from "./select";
import type { KartIcerigi, LedgerSatiri, PostPlani, PostTuru } from "./types";

/**
 * Seçim + metin + kart içeriğini tek bir plana bağlar. **Saf**: dosya ve ağ
 * yok, tarih parametreden gelir.
 *
 * Plan diske yazılır ve paylaşım AYRI bir süreçte okur. Araya girmesinin
 * sebebi Instagram: görseli ikili olarak kabul etmez, herkese açık bir
 * adresten çeker. Yani görsel önce yayımlanmalı, sonra paylaşılmalıdır ve
 * ikisinin arasında iş akışının bir git push adımı vardır.
 */

export type PlanSonucu = { plan: PostPlani; kart: KartIcerigi };

/** Aynı gün + aynı tür = aynı dosya adı; yeniden deneme üstüne yazar. */
function gorselAdi(tarih: string, tur: PostTuru): string {
	return `${tarih}-${tur}.${KART_UZANTI}`;
}

export function planOlustur(
	tur: PostTuru,
	havuz: Havuz,
	ledger: LedgerSatiri[],
	tarih: string,
	duyuruGovdesi?: string,
): PlanSonucu | null {
	const gorsel = gorselAdi(tarih, tur);
	const gorselUrl = `${VARLIK_TABANI}/${gorsel}`;

	if (tur === "soru") {
		const soru = soruSec(havuz, ledger, tarih);

		if (!soru) return null;

		return {
			plan: {
				anahtar: `soru:${soru.id}`,
				tur,
				refId: soru.id,
				tarih,
				gorsel,
				gorselUrl,
				altMetin: altMetinSoru(soru),
				metinler: {
					x: soruMetni(soru, "x"),
					facebook: soruMetni(soru, "facebook"),
					instagram: soruMetni(soru, "instagram"),
				},
			},
			kart: {
				tur,
				rozet: "GÜNÜN SORUSU",
				ustBilgi: `${soru.subjectAdi} · ${soru.konuAdi}`,
				baslik: soru.stem,
				satirlar: soru.options,
			},
		};
	}

	if (tur === "cevap") {
		const soru = cevapSec(havuz, ledger);

		if (!soru) return null;

		const dogru = `${secenekHarfi(soru.correctIndex)}) ${soru.options[soru.correctIndex]}`;

		return {
			plan: {
				anahtar: `cevap:${soru.id}`,
				tur,
				refId: soru.id,
				tarih,
				gorsel,
				gorselUrl,
				altMetin: altMetinCevap(soru),
				metinler: {
					x: cevapMetni(soru, "x"),
					facebook: cevapMetni(soru, "facebook"),
					instagram: cevapMetni(soru, "instagram"),
				},
			},
			kart: {
				tur,
				rozet: "CEVAP",
				ustBilgi: `${soru.subjectAdi} · ${soru.konuAdi}`,
				// Kartın gövdesi açıklamadır: doğru şık zaten vurgu kutusunda
				// duruyor, soruyu tekrarlamak kartı okunmaz hâle getiriyordu.
				baslik: soru.explanation,
				vurgu: dogru,
				dayanak: soru.dayanak,
			},
		};
	}

	if (tur === "bilgi") {
		const bilgi = bilgiSec(havuz, ledger, tarih);

		if (!bilgi) return null;

		return {
			plan: {
				anahtar: `bilgi:${bilgi.refId}`,
				tur,
				refId: bilgi.refId,
				tarih,
				gorsel,
				gorselUrl,
				altMetin: altMetinBilgi(bilgi),
				metinler: {
					x: bilgiMetni(bilgi, "x"),
					facebook: bilgiMetni(bilgi, "facebook"),
					instagram: bilgiMetni(bilgi, "instagram"),
				},
			},
			kart: {
				tur,
				rozet: "BİLGİ",
				ustBilgi: `${bilgi.subjectAdi} · ${bilgi.konuAdi}`,
				baslik: bilgi.metin,
				dayanak: bilgi.dayanak,
			},
		};
	}

	// duyuru — metni operatör verir, havuzdan seçim yoktur.
	if (!duyuruGovdesi) return null;

	return {
		plan: {
			// Duyuru tekrar önlemeye tabi değil; anahtar tarihle tekilleşir.
			anahtar: `duyuru:${tarih}`,
			tur: "duyuru",
			refId: tarih,
			tarih,
			gorsel,
			gorselUrl,
			altMetin: `Duyuru kartı: ${duyuruGovdesi}`,
			metinler: {
				x: duyuruMetni(duyuruGovdesi, "x"),
				facebook: duyuruMetni(duyuruGovdesi, "facebook"),
				instagram: duyuruMetni(duyuruGovdesi, "instagram"),
			},
		},
		kart: {
			tur: "duyuru",
			rozet: "DUYURU",
			ustBilgi: "Kamu Sınav Akademi",
			baslik: duyuruGovdesi,
		},
	};
}
