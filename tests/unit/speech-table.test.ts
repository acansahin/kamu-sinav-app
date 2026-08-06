import { describe, expect, it } from "vitest";
import { tabloyuOku } from "@/lib/speech/table";

/**
 * Tablo seslendirmesi.
 *
 * Örneklerin tamamı gerçek konu özetlerinden. Tablo, sesli okumanın en kolay
 * anlamsızlaşan kısmı: ham okunduğunda dinleyici hangi değerin hangi sütuna
 * ait olduğunu bilemez.
 */

describe("iki sütunlu tablo", () => {
	/** 657-dmk/disiplin-cezalari.mdx — ceza/yetkili makam tablosu. */
	const tablo = {
		basliklar: ["Ceza", "Yetkili makam"],
		satirlar: [
			["Uyarma, kınama, aylıktan kesme", "Disiplin amirleri"],
			["Kademe ilerlemesinin durdurulması", "Disiplin kurulunun kararı"],
		],
	};

	it("girişte sütunları ve satır sayısını duyurur", () => {
		expect(tabloyuOku(tablo).giris).toBe(
			"Tablo. Sütunlar: Ceza, Yetkili makam. 2 satır.",
		);
	});

	/**
	 * İki sütunlu tablo aslında bir tanım listesidir. Sekiz satır boyunca
	 * "Yetkili makam:" demek dinleyici için işkence olurdu; başlıklar girişte
	 * bir kez duyuluyor ve bu yeterli.
	 */
	it("satırlarda başlığı TEKRAR ETMEZ", () => {
		const { satirlar } = tabloyuOku(tablo);
		expect(satirlar[0]).toBe(
			"Uyarma, kınama, aylıktan kesme: Disiplin amirleri.",
		);
		expect(satirlar[0]).not.toContain("Ceza:");
		expect(satirlar[0]).not.toContain("Yetkili makam:");
	});
});

describe("üç sütunlu tablo", () => {
	/** 657-dmk/genel-hukumler.mdx — istihdam şekilleri tablosu. */
	const tablo = {
		basliklar: ["Fıkra", "Statü", "Durum"],
		satirlar: [
			["A", "Memur", "Yürürlükte"],
			["C", "Geçici personel", "Mülga — KHK-696 (20/11/2017)"],
		],
	};

	/**
	 * Üç sütunda tekrar ZORUNLU: dinleyici üçüncü değerin hangi sütuna ait
	 * olduğunu başka türlü bilemez.
	 */
	it("ilk hücreyi başlığıyla anahtarlar, kalanları etiketler", () => {
		const { satirlar } = tabloyuOku(tablo);
		expect(satirlar[0]).toBe("Fıkra A. Statü: Memur. Durum: Yürürlükte.");
	});

	it("hücre içeriği de normalleştirmeden geçer", () => {
		const { satirlar } = tabloyuOku(tablo);
		expect(satirlar[1]).toContain("KHK 696");
		expect(satirlar[1]).toContain("20 Kasım 2017");
		expect(satirlar[1]).not.toContain("KHK-696");
	});
});

describe("sıra sütunu", () => {
	/** 657-dmk/disiplin-cezalari.mdx — "| # | Ceza | Tanımı |" */
	it("# başlığını okumaz — motor onu 'diyez' diye okur", () => {
		const { satirlar } = tabloyuOku({
			basliklar: ["#", "Ceza", "Tanımı"],
			satirlar: [["1", "Uyarma", "Yazılı olarak bildirilir"]],
		});
		expect(satirlar[0]).toBe("1. Ceza: Uyarma. Tanımı: Yazılı olarak bildirilir.");
		expect(satirlar[0]).not.toContain("#");
	});
});

describe("kenar durumları", () => {
	it("boş hücreyi tamamen atlar", () => {
		const { satirlar } = tabloyuOku({
			basliklar: ["Fıkra", "Statü", "Durum"],
			satirlar: [["D", "İşçi", ""]],
		});
		expect(satirlar[0]).toBe("Fıkra D. Statü: İşçi.");
		expect(satirlar[0]).not.toContain("Durum");
	});

	it("başlıksız tabloda değerleri düz okur", () => {
		const okuma = tabloyuOku({
			basliklar: [],
			satirlar: [["Uyarma", "Disiplin amiri"]],
		});
		expect(okuma.giris).toBe("Tablo. 1 satır.");
		expect(okuma.satirlar[0]).toBe("Uyarma: Disiplin amiri.");
	});

	it("dört sütunlu tabloda da her sütunu etiketler", () => {
		const { satirlar } = tabloyuOku({
			basliklar: ["Sınıf", "Kod", "Örnek", "Not"],
			satirlar: [["GİH", "1", "Memur", "En kalabalık"]],
		});
		expect(satirlar[0]).toBe(
			"Sınıf GİH. Kod: 1. Örnek: Memur. Not: En kalabalık.",
		);
	});

	it("tamamen boş satır boş dize üretir", () => {
		const { satirlar } = tabloyuOku({
			basliklar: ["A", "B"],
			satirlar: [["", ""]],
		});
		expect(satirlar[0]).toBe("");
	});

	it("zaten noktalı biten hücreye ikinci nokta koymaz", () => {
		const { satirlar } = tabloyuOku({
			basliklar: ["Ceza", "Açıklama"],
			satirlar: [["Uyarma", "Yazılı bildirilir."]],
		});
		expect(satirlar[0]).toBe("Uyarma: Yazılı bildirilir.");
	});
});
