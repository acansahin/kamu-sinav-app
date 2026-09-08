import { describe, expect, it } from "vitest";

import {
	bilgiMetni,
	cevapMetni,
	duyuruMetni,
	kisalt,
	secenekHarfi,
	soruMetni,
	xeSigdir,
	xUzunluk,
} from "../../scripts/social/compose";
import type {
	PaylasilabilirBilgi,
	PaylasilabilirSoru,
} from "../../scripts/social/pool";

/**
 * Sosyal medya metin üretimi.
 *
 * Buradaki tek sert kural X'in 280 karakteridir: aşıldığında API isteği
 * reddediyor ve hata cron'un içinde, yani kimsenin bakmadığı bir yerde
 * görülüyor. Fikstürler bilinçli olarak UÇ örneklerdir — havuzda 250
 * karakterlik tek satırlık şıklar gerçekten var (Resmî Yazışma
 * Yönetmeliği'nin "olağanüstü durum" tanımı) ve ilk uygulama tam olarak
 * onda taşmıştı.
 */

const UZUN =
	"Güvenlik zafiyeti oluşturabilecek durumlar ya da uzun süreli elektrik " +
	"kesintileri, donanım ve yazılım sorunları gibi teknik gerekçelerle EBYS'nin " +
	"uzun süreli çalışmamasından dolayı belgenin fiziksel ortamda hazırlanması " +
	"gereken durumlardır.";

const kisaSoru: PaylasilabilirSoru = {
	id: "etik-ilke-001",
	subjectId: "etik",
	subjectAdi: "Etik",
	konuAdi: "Etik Davranış İlkeleri",
	stem: "Kamu Görevlileri Etik Kurulu kaç üyeden oluşur?",
	options: ["11", "9", "13", "7", "15"],
	correctIndex: 0,
	explanation:
		"5176 sayılı Kanun'a göre Kurul, biri Başkan olmak üzere 11 üyeden oluşur.",
	dayanak: "5176 sayılı Kanun md. 3",
};

const uzunSoru: PaylasilabilirSoru = {
	...kisaSoru,
	id: "yazisma-genel-005",
	subjectAdi: "Resmî Yazışma",
	konuAdi: "Genel Hükümler ve Tanımlar",
	stem: "Yönetmelikteki “olağanüstü durum” tanımı bakımından aşağıdakilerden hangisi doğrudur?",
	options: [UZUN, "Kısa şık", "Kısa şık", "Kısa şık", "Kısa şık"],
	explanation: UZUN + UZUN,
	dayanak:
		"Resmî Yazışmalarda Uygulanacak Usul ve Esaslar Hakkında Yönetmelik md. 3",
};

const bilgi: PaylasilabilirBilgi = {
	refId: "etik/saydamlik#0",
	subjectId: "etik",
	subjectAdi: "Etik",
	konuAdi: "Saydamlık ve Hesap Verebilirlik",
	metin:
		"Yöneticiler, kurumun amaç ve politikalarına uygun olmayan işlem veya " +
		"eylemleri engellemekle ve hesap vermekle sorumludur.",
	dayanak: "4982 sayılı Kanun",
};

describe("xUzunluk", () => {
	it("bağlantıyı t.co uzunluğuyla (23) sayar", () => {
		// Ham uzunluk 41; X için 23 sayılmalı.
		expect(
			xUzunluk(
				"https://play.google.com/store/apps/details?id=tr.kamusinavakademi.app",
			),
		).toBe(23);
	});

	it("bağlantısız metinde ham uzunlukla aynıdır", () => {
		expect(xUzunluk("merhaba")).toBe(7);
	});
});

describe("kisalt", () => {
	it("sınırın altındaki metne dokunmaz", () => {
		expect(kisalt("kısa metin", 50)).toBe("kısa metin");
	});

	it("kelime sınırından keser", () => {
		const sonuc = kisalt("bir iki üç dört beş altı", 14);

		expect(sonuc.length).toBeLessThanOrEqual(14);
		// Sözcük ortasından kesilmemeli.
		expect(sonuc).toBe("bir iki üç…");
	});

	it("tek uzun sözcükte sert keser", () => {
		expect(kisalt("olağanüstüdurum", 10)).toHaveLength(10);
	});
});

describe("xeSigdir", () => {
	it("sabit parçaları kısaltmaz", () => {
		const sonuc = xeSigdir([
			{ metin: UZUN, asgari: 20 },
			{ metin: "#etiket #ikinci", sabit: true },
		]);

		expect(sonuc).toContain("#etiket #ikinci");
		expect(xUzunluk(sonuc)).toBeLessThanOrEqual(280);
	});

	it("payı asgarinin altına düşen parçayı tamamen atar", () => {
		// İkinci parça doğal olarak 100 karakterden uzun ama kendisine ancak
		// ~40 karakter kalıyor: yarım bırakmak yerine tamamen düşmeli.
		const sonuc = xeSigdir([
			{ metin: UZUN, oncelik: 0, tavan: 240 },
			{
				metin: `Bu açıklama sığmamalı ${"ve uzatılmış hâliyle asgarinin üstünde ".repeat(3)}`,
				asgari: 100,
				oncelik: 1,
			},
		]);

		expect(sonuc).not.toContain("Bu açıklama");
	});

	it("tavan, önce gelen parçanın hepsini yutmasını engeller", () => {
		const sonuc = xeSigdir([
			{ metin: UZUN, asgari: 20, tavan: 100, oncelik: 0 },
			{ metin: "İkinci parça da görünmeli", asgari: 10, oncelik: 1 },
		]);

		expect(sonuc).toContain("İkinci parça da görünmeli");
	});
});

describe("X metinleri 280 karakteri aşmaz", () => {
	const durumlar: Array<[string, string]> = [
		["kısa soru", soruMetni(kisaSoru, "x")],
		["uzun soru", soruMetni(uzunSoru, "x")],
		["kısa cevap", cevapMetni(kisaSoru, "x")],
		["uzun cevap", cevapMetni(uzunSoru, "x")],
		["bilgi", bilgiMetni(bilgi, "x")],
		["duyuru", duyuruMetni(UZUN, "x")],
	];

	for (const [ad, metin] of durumlar) {
		it(ad, () => {
			expect(xUzunluk(metin)).toBeLessThanOrEqual(280);
			expect(metin.trim()).not.toBe("");
		});
	}

	it("uzun cevapta doğru şık ve dayanak korunur, açıklama düşer", () => {
		const metin = cevapMetni(uzunSoru, "x");

		expect(metin).toContain("✅ Cevap: A)");
		expect(metin).toContain("Yönetmelik");
		expect(metin).toContain("#GörevdeYükselme");
	});

	it("kısa cevapta açıklama da sığar", () => {
		expect(cevapMetni(kisaSoru, "x")).toContain("11 üyeden oluşur");
	});
});

describe("uzun biçim metinleri", () => {
	it("soru paylaşımı tüm şıkları harfleriyle taşır", () => {
		const metin = soruMetni(kisaSoru, "instagram");

		expect(metin).toContain("A) 11");
		expect(metin).toContain("E) 15");
	});

	it("cevap paylaşımı dayanağı içerir", () => {
		expect(cevapMetni(kisaSoru, "facebook")).toContain(
			"Dayanak: 5176 sayılı Kanun md. 3",
		);
	});

	it("Instagram başlığı 2200 karakteri aşmaz", () => {
		expect(soruMetni(uzunSoru, "instagram").length).toBeLessThanOrEqual(2200);
		expect(cevapMetni(uzunSoru, "instagram").length).toBeLessThanOrEqual(2200);
	});
});

describe("secenekHarfi", () => {
	it("beş şıkkı harflendirir", () => {
		expect([0, 1, 2, 3, 4].map(secenekHarfi)).toEqual([
			"A",
			"B",
			"C",
			"D",
			"E",
		]);
	});
});
