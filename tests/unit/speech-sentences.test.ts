import { describe, expect, it } from "vitest";
import { cumlelereBol, parcalaraAyir } from "@/lib/speech/sentences";
import {
	PARCA_MUTLAK_TAVAN,
	PARCA_UST_SINIR,
} from "@/lib/speech/types";

/**
 * Cümleye bölme.
 *
 * Buradaki her "bölünmez" testi gerçek bir içerik dizesinden geliyor. Yanlış
 * bölme sessiz bir hatadır: metin okunur, yalnızca yanlış yerde durur ve
 * dinleyici cümlenin yarısını kopuk duyar.
 */

describe("cumlelereBol — bölmemesi gerekenler", () => {
	it("sıra sayısında bölmez (nokta sonrası küçük harf)", () => {
		expect(cumlelereBol("127. maddeye göre işlem yapılır.")).toEqual([
			"127. maddeye göre işlem yapılır.",
		]);
	});

	it("binlik ayracında bölmez (nokta sonrası boşluk yok)", () => {
		expect(cumlelereBol("Nüfusu 2.000 kişiden azdır.")).toEqual([
			"Nüfusu 2.000 kişiden azdır.",
		]);
	});

	it("mevzuat kısaltmasında bölmez", () => {
		expect(cumlelereBol("Bkz. 657 s.K. m.1 Kapsam maddesidir.")).toHaveLength(1);
	});

	it.each(["vb.", "vs.", "Dr.", "Prof.", "No."])(
		"“%s” kısaltmasından sonra bölmez",
		(kisaltma) => {
			expect(cumlelereBol(`Kurumlar ${kisaltma} Bakanlıklar sayılır.`)).toHaveLength(1);
		},
	);

	/**
	 * `<Sayi>` blokları normalleştirmeden sonra "15 gün. 30 gün. 6 ay" hâline
	 * geliyor. Rakamla devam ettiği için bölünmez ve tek parça kalır — zaten
	 * kısa olduğu için bu istenen davranış.
	 */
	it("rakamla devam eden noktadan sonra bölmez", () => {
		expect(cumlelereBol("15 gün. 30 gün. 6 ay")).toHaveLength(1);
	});
});

describe("cumlelereBol — bölmesi gerekenler", () => {
	it("büyük harfle başlayan yeni cümlede böler", () => {
		expect(
			cumlelereBol("Kanun memurlar hakkında uygulanır. İşçi kapsam dışıdır."),
		).toEqual([
			"Kanun memurlar hakkında uygulanır.",
			"İşçi kapsam dışıdır.",
		]);
	});

	it("soru ve ünlem işaretlerinde de böler", () => {
		expect(
			cumlelereBol("Kim memurdur? Kanunun ilk maddesi cevaplar."),
		).toHaveLength(2);
	});

	it("tırnakla başlayan cümleyi ayırır", () => {
		expect(
			cumlelereBol('Madde 5 açıktır. "Dört istihdam şekli" der.'),
		).toHaveLength(2);
	});

	it("Türkçe büyük harfleri tanır", () => {
		expect(
			cumlelereBol("Birinci cümle. İkinci cümle. Üçüncü cümle."),
		).toHaveLength(3);
	});
});

describe("parcalaraAyir", () => {
	it("kısa cümleleri birleştirir", () => {
		const parcalar = parcalaraAyir("Kısa cümle. Bu da kısa. Üçüncüsü de öyle.");
		expect(parcalar).toHaveLength(1);
	});

	it("uzun cümleyi virgülden böler", () => {
		const uzun = `${"a".repeat(150)}, ${"b".repeat(150)}.`;
		const parcalar = parcalaraAyir(uzun);
		expect(parcalar.length).toBeGreaterThan(1);
		expect(parcalar[0].endsWith(",")).toBe(true);
	});

	it("noktalama yoksa kelime sınırından böler", () => {
		const uzun = Array.from({ length: 60 }, () => "kelime").join(" ");
		const parcalar = parcalaraAyir(uzun);
		expect(parcalar.length).toBeGreaterThan(1);
		for (const parca of parcalar) {
			expect(parca.length).toBeLessThanOrEqual(PARCA_UST_SINIR);
		}
	});

	/** Bölünecek doğal nokta hiç yoksa mutlak tavan devreye girer. */
	it("boşluksuz devasa dizeyi mutlak tavandan keser", () => {
		const parcalar = parcalaraAyir("x".repeat(1000));
		for (const parca of parcalar) {
			expect(parca.length).toBeLessThanOrEqual(PARCA_MUTLAK_TAVAN);
		}
	});

	it("boş metinde boş dizi döner", () => {
		expect(parcalaraAyir("   ")).toEqual([]);
	});

	/** Hiçbir parça kaybolmamalı: birleştirme ve bölme metni korumalı. */
	it("metni kaybetmez", () => {
		const metin =
			"Kanun memurlar hakkında uygulanır. İşçi İş Kanunu'na tabidir. Üçüncü bir statü sözleşmeli personeldir.";
		const birlesik = parcalaraAyir(metin).join(" ");
		expect(birlesik.replace(/\s+/g, " ")).toBe(metin);
	});
});
