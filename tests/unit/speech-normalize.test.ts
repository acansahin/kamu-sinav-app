import { describe, expect, it } from "vitest";
import { konusmaMetni } from "@/lib/speech/normalize-tr";
import { bloklaraAyir } from "@/lib/speech/sentences";
import { DURAK_ISARETI } from "@/lib/speech/types";

/**
 * Tirenin gerçek etkisi tek bir dizede değil, PARÇA SAYISINDA görülür:
 * her parça ayrı bir `speak()` çağrısıdır ve duraklamayı aradaki motor
 * yeniden yapılandırması üretir. Bu yardımcı, boru hattının tamamını
 * (normalleştirme + parçalama) çalıştırır.
 */
function seslendirmeParcalari(ham: string): string[] {
	return bloklaraAyir(konusmaMetni(ham));
}

/**
 * Türkçe seslendirme normalleştirmesi.
 *
 * Girdilerin TAMAMI `content/subjects/**` altındaki gerçek dizelerdir. Uydurma
 * örnek kullanılmıyor: kural, var olmayan bir soruna karşı yazılırsa içeriğin
 * gerçek biçimi değiştiğinde sessizce yanlış tarafı korur.
 *
 * En değerli blok en sonda: adım SIRASI regresyonları. Boru hattındaki üç yerde
 * bir adım kendinden sonrakinin girdisini üretiyor; sıra bozulursa kural hiç
 * tetiklenmez ve hata yalnızca kulakla fark edilir.
 */

describe("mevzuat referansları", () => {
	it("<Madde> bileşeninin çıktısını açar", () => {
		expect(konusmaMetni("657 s.K. m.125")).toBe(
			"657 sayılı Kanun madde 125",
		);
	});

	it("cümle içinde de açar", () => {
		expect(konusmaMetni("Disiplin cezaları 657 s.K. m.125 içinde sayılır.")).toBe(
			"Disiplin cezaları 657 sayılı Kanun madde 125 içinde sayılır.",
		);
	});

	it("tek başına m.N ve md.N kısaltmalarını açar", () => {
		expect(konusmaMetni("m.77 hükmü")).toBe("madde 77 hükmü");
		expect(konusmaMetni("md. 4 uyarınca")).toBe("madde 4 uyarınca");
	});

	it("KHK numarasındaki tireyi kaldırır", () => {
		expect(konusmaMetni("KHK-696 ile")).toBe("KHK 696 ile");
	});
});

describe("tarihler", () => {
	/** disiplin-cezalari.mdx ve genel-hukumler.mdx tablolarından. */
	it.each([
		["KHK-696 (20/11/2017)", "KHK 696 (20 Kasım 2017)"],
		["7079 sayılı Kanun'la aynen kabul (1/2/2018)", "7079 sayılı Kanun'la aynen kabul (1 Şubat 2018)"],
	])("%s → %s", (girdi, beklenen) => {
		expect(konusmaMetni(girdi)).toBe(beklenen);
	});

	it("geçersiz ay numarasına dokunmaz", () => {
		// 13. ay yok; tarih olmayan bir kesir dizisi olabilir, tahmin edilmez.
		expect(konusmaMetni("1/13/2018")).not.toContain("Ocak");
	});
});

describe("kesirler ve aralıklar", () => {
	/** disiplin-cezalari.mdx: aylıktan kesme oranı. */
	it("aralık tiresi ve kesirler birlikte çözülür", () => {
		expect(konusmaMetni("Aylıktan kesme oranı 1/30 – 1/8")).toBe(
			"Aylıktan kesme oranı otuzda bir ila sekizde bir",
		);
	});

	it("rakam aralığında en tire 'ila' olur", () => {
		expect(konusmaMetni("3–9 gün")).toBe("3 ila 9 gün");
		expect(konusmaMetni("Kademe ilerlemesinin durdurulması 1 – 3 yıl")).toBe(
			"Kademe ilerlemesinin durdurulması 1 ila 3 yıl",
		);
	});

	/*
	 * Tire NOKTALAMAYA değil, PARÇA SINIRINA dönüşür. Virgül ve noktalı virgül
	 * sırayla denendi; ikisinde de cihazda hiçbir duraklama duyulmadı, çünkü
	 * motor cümle içi noktalamayı prosodiye çevirmiyor. Duraklamayı ancak ayrı
	 * bir `speak()` çağrısı üretiyor (bkz. types.ts → DURAK_ISARETI).
	 */
	it("rakam arasında olmayan tire ayrı bir parça doğurur", () => {
		expect(
			seslendirmeParcalari("Memur — genel idare esaslarına göre çalışan"),
		).toEqual(["Memur", "genel idare esaslarına göre çalışan"]);
	});

	it("durak işareti motora ASLA ulaşmaz", () => {
		for (const parca of seslendirmeParcalari(
			"Valinin giriş-çıkış sınırlaması — en çok 15 gün",
		)) {
			expect(parca).not.toContain(DURAK_ISARETI);
		}
	});

	/*
	 * Aşağıdakiler cihazda bildirilen hataya ait: motor DÜZ tireyi (`-`) hiç
	 * duraklamadan geçiyordu. En/em tire zaten ele alınıyordu, düz tire değil.
	 */
	it("rakam aralığında düz tire de 'ila' olur", () => {
		// resmi-yazisma tablosundan; 16. adım "m.29"u sonra "madde 29" yapar.
		expect(konusmaMetni("657 sayılı Kanun (m.29-30)")).toBe(
			"657 sayılı Kanun (madde 29 ila 30)",
		);
		expect(konusmaMetni("maddeler 503-510")).toBe("maddeler 503 ila 510");
	});

	it("birleşik sözcük tiresi de ayrı parça doğurur", () => {
		expect(seslendirmeParcalari("Valinin giriş-çıkış sınırlaması")).toEqual([
			"Valinin giriş",
			"çıkış sınırlaması",
		]);
		expect(seslendirmeParcalari("Paraf: kısaltmasız, ast-üstten")).toEqual([
			"Paraf: kısaltmasız, ast",
			"üstten",
		]);
		// Şapkalı harfler karakter sınıfında olmalı (idarî-malî gerçek içerikten).
		expect(seslendirmeParcalari("idarî-malî denetim")).toEqual([
			"idarî",
			"malî denetim",
		]);
	});

	/**
	 * Tek harfli önek KORUNUR — düzeltilenden fazlasını bozmamak için.
	 * "e, posta" apaçık yanlıştır.
	 */
	it("tek harfli önekteki tireye dokunmaz", () => {
		expect(konusmaMetni("e-posta adresi")).toBe("e-posta adresi");
		expect(konusmaMetni("e-Yazışma Teknik Rehberi")).toBe(
			"e-Yazışma Teknik Rehberi",
		);
	});

	it("CBK numarasındaki tireyi de kaldırır", () => {
		expect(konusmaMetni("CBK-1 ile kurulan")).toBe("CBK 1 ile kurulan");
	});
});

describe("oranlar ve karşılaştırmalar", () => {
	/** devlet-teskilati/kit-ve-ozel-butce.mdx tablosundan. */
	it("yüzde aralığı ve karşılaştırma birlikte çözülür", () => {
		expect(
			konusmaMetni("Müessese: %100 · Bağlı ortaklık: >%50 · İştirak: %15-%50"),
		).toBe(
			"Müessese: yüzde 100; Bağlı ortaklık: yüzde 50 üzeri; İştirak: yüzde 15 ila yüzde 50",
		);
	});

	/** devlet-teskilati/mahalli-idareler.mdx <Sayi> bloğu. */
	it("nüfus eşikleri 'altı/üzeri' olarak okunur", () => {
		expect(
			konusmaMetni("Köy < 2.000 · Kasaba 2.000-20.000 · Şehir > 20.000"),
			// "2.000-20.000" düz tireyle yazılmış bir ARALIKTIR. Eskiden olduğu
			// gibi bırakılıyordu ve motor "iki bin yirmi bin" diye tek nefeste
			// okuyordu (cihazda bildirildi).
		).toBe("Köy 2.000 altı; Kasaba 2.000 ila 20.000; Şehir 20.000 üzeri");
	});
});

describe("fıkra ve bent gösterimi", () => {
	/**
	 * Sözcük EKLENMEZ: 4/A bir fıkra, 48/A bir benttir. Tek bir sabit sözcük
	 * ikisine birden uymadığı için yalnızca eğik çizgi düşürülür.
	 *
	 * Harf ADIYLA yazılır: düz bırakılan tek harfi motor romen rakamı sanıyor
	 * ve "4/C" cihazda "dört yüz", "4/D" "dört beş yüz" olarak okunuyordu.
	 */
	it.each([
		["memur (4/A)", "memur (4 a)"],
		["sözleşmeli personel (4/B)", "sözleşmeli personel (4 be)"],
		["Geçici personel (4/C) mülgadır", "Geçici personel (4 ce) mülgadır"],
		["işçi (4/D)", "işçi (4 de)"],
		["48/A şartları", "48 a şartları"],
	])("%s → %s", (girdi, beklenen) => {
		expect(konusmaMetni(girdi)).toBe(beklenen);
	});

	it("harf-harf yapılara dokunmaz", () => {
		expect(konusmaMetni("E/Z kodu")).toBe("E/Z kodu");
	});
});

describe("parantez içindeki fıkra harfleri", () => {
	/** 657-dmk/genel-hukumler.mdx — gövde metni ve <Sayi> bloğu. */
	it("fıkra sözcüğünden önce gelen tek harfi adıyla okur", () => {
		expect(konusmaMetni("(C) fıkrası yürürlükten kaldırıldı")).toBe(
			"(ce) fıkrası yürürlükten kaldırıldı",
		);
	});

	it("harf listesini adlarıyla okur", () => {
		expect(konusmaMetni("Yürürlükteki istihdam şekli: 3 (A, B, D)")).toBe(
			"Yürürlükteki istihdam şekli: 3 (a, be, de)",
		);
	});

	/**
	 * REGRESYON — kural bilinçli olarak bağlama bağlıdır. Tek harfi her yerde
	 * çevirmek burayı bozardı: "(I) sayılı cetvel" ifadesinde romen rakamı
	 * bilinçlidir ve motorun "bir" okuması DOĞRU olandır.
	 * (devlet-teskilati/ust-kademe-kamu-yoneticileri.mdx)
	 */
	it.each([
		"(I) sayılı cetvelde gösterilen kadrolar",
		"(I) ve (II) sayılı cetveldeki kadrolara atama yapılır",
	])("romen rakamlı cetvel gösterimine DOKUNMAZ: %s", (girdi) => {
		expect(konusmaMetni(girdi)).toBe(girdi);
	});
});

describe("ayraçlar", () => {
	/**
	 * 657-dmk/disiplin-cezalari.mdx `<Sayi>` bloğu.
	 *
	 * NOKTA DEĞİL, NOKTALI VİRGÜL: `<Sayi>` bloğu bir listedir, cümle dizisi
	 * değil. Nokta her ayraçta bir tam durak ve düşen kontur üretiyordu; ayrıca
	 * `cumlelereBol` yalnızca `.!?…` üzerinden böldüğü için blok artık tek
	 * utterance kalıyor.
	 */
	it("orta nokta noktalı virgüle döner", () => {
		expect(konusmaMetni("15 gün · 30 gün · 6 ay")).toBe(
			"15 gün; 30 gün; 6 ay",
		);
	});

	it("ok işareti virgüle döner", () => {
		expect(konusmaMetni("301 → 360 → 400")).toBe("301, 360, 400");
	});

	/** resmi-yazisma tablo başlıklarında ve izin sürelerinde geçiyor. */
	it("boşluklu eğik çizgi 'veya' olur, kesir bozulmaz", () => {
		expect(konusmaMetni("Yıllık izin: 20 gün / 30 gün")).toBe(
			"Yıllık izin: 20 gün veya 30 gün",
		);
		expect(konusmaMetni("oran 1/30")).toBe("oran otuzda bir");
	});
});

describe("Unicode temizliği", () => {
	it("tipografik kesme işaretini düzleştirir", () => {
		expect(konusmaMetni("Kanun’a tabidir")).toBe("Kanun'a tabidir");
	});

	it("bölünmez boşluk ve yumuşak tireyi temizler", () => {
		expect(konusmaMetni("iki bin­ lira")).toBe("iki bin lira");
	});
});

describe("büyük/küçük harf bekçisi", () => {
	/**
	 * Bu test bir DAVRANIŞI değil, bir KURALI koruyor: boru hattına bir gün
	 * `toLowerCase()` ya da `foldForSearch` sokulursa burası kırmızı olur.
	 * Varsayılan yerel ayar "I"yı "i" yapar (Türkçede "ı" olmalı) ve aksan
	 * sadeleştirmesi TTS telaffuzunu bozar.
	 */
	it("özgün yazımı korur", () => {
		const metin = "İSTANBUL Valiliği ÇOK GİZLİ ibaresi taşır";
		expect(konusmaMetni(metin)).toBe(metin);
	});

	it("Türkçe karakterleri sadeleştirmez", () => {
		expect(konusmaMetni("görevde yükselme")).toBe("görevde yükselme");
	});
});

describe("adım sırası regresyonları", () => {
	/**
	 * Aşağıdaki üç test boru hattındaki sıra bağımlılıklarını sabitler. Üçü de
	 * "kural yanlış" değil "kural hiç tetiklenmedi" biçiminde bozulur; yani
	 * çıktı makul görünür ve hata ancak dinlerken fark edilir.
	 */

	it("tarih kuralı kesir kuralından ÖNCE çalışır", () => {
		// Ters sırada: "ikide bir /2018"
		const sonuc = konusmaMetni("(1/2/2018)");
		expect(sonuc).toBe("(1 Şubat 2018)");
		expect(sonuc).not.toContain("ikide bir");
	});

	it("aralık kuralı kesir kuralından ÖNCE çalışır", () => {
		// Ters sırada kesirler önce sözcüğe döner, tire iki RAKAM arasında
		// kalmaz ve "ila" hiç üretilmez.
		expect(konusmaMetni("1/30 – 1/8")).toContain("ila");
	});

	it("karşılaştırma kuralı yüzde kuralından ÖNCE çalışır", () => {
		// Ters sırada ">%50" önce ">yüzde 50" olur ve karşılaştırma rakam bulamaz.
		const sonuc = konusmaMetni(">%50");
		expect(sonuc).toBe("yüzde 50 üzeri");
		expect(sonuc).not.toContain(">");
	});
});
