import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	type DataController,
	PRIVACY_NOTICE_UPDATED_AT,
	isDataControllerComplete,
} from "@/lib/legal/data-controller";

/**
 * KVKK aydınlatma metninin bütünlüğü.
 *
 * Bu testler hukuki uygunluğu KANITLAMAZ — onu ancak bir avukat söyleyebilir.
 * Yaptıkları şey, metnin sessizce eksilmesini engellemek: kanunun saydığı
 * bir başlık silinirse ya da veri sorumlusu bilgisi yarım doldurulursa
 * build kırılır.
 */

const PAGE = readFileSync("src/app/gizlilik/page.tsx", "utf8");

describe("veri sorumlusu bilgisi", () => {
	function controller(overrides: Partial<DataController> = {}): DataController {
		return {
			name: "Örnek Ad Soyad",
			email: "kvkk@ornek.com",
			address: "Örnek Mah. 1. Cad. No:1 Çankaya/Ankara",
			...overrides,
		};
	}

	it("üç alanın üçü de doluysa yayımlanabilir sayılır", () => {
		expect(isDataControllerComplete(controller())).toBe(true);
	});

	it("alanlardan biri eksikse yayımlanabilir sayılmaz", () => {
		// Yarım doldurulmuş bir metin yükümlülüğü karşılamaz; "az kalsın dolu"
		// diye bir durum yok.
		expect(isDataControllerComplete(controller({ name: "" }))).toBe(false);
		expect(isDataControllerComplete(controller({ email: "" }))).toBe(false);
		expect(isDataControllerComplete(controller({ address: "" }))).toBe(false);
	});

	it("yalnızca boşluk içeren alan dolu sayılmaz", () => {
		expect(isDataControllerComplete(controller({ name: "   " }))).toBe(false);
	});
});

describe("aydınlatma metni", () => {
	// KVKK m.10/1 ve Aydınlatma Tebliği'nin saydığı unsurlar. Biri metinden
	// çıkarsa bu liste onu yakalar.
	const ZORUNLU_BASLIKLAR = [
		"Veri sorumlusu kim?", // m.10/1-a
		"Hangi kişisel verileriniz işleniyor?", // kapsam
		"Verileriniz hangi amaçla işleniyor?", // m.10/1-b
		"Toplama yöntemi ve hukuki sebep", // m.10/1-ç
		"Verileriniz kimlere aktarılıyor?", // m.10/1-c
		"Haklarınız", // m.10/1-d → m.11
		"Nasıl başvurabilirsiniz?", // Başvuru Tebliği
	];

	for (const baslik of ZORUNLU_BASLIKLAR) {
		it(`"${baslik}" başlığını içerir`, () => {
			expect(PAGE).toContain(baslik);
		});
	}

	it("KVKK m.11'deki dokuz hakkın tamamını sayar", () => {
		const haklar = [
			"işlenip işlenmediğini öğrenme",
			"bilgi talep etme",
			"amacına uygun kullanılıp kullanılmadığını",
			"aktarıldığı üçüncü",
			"düzeltilmesini isteme",
			"silinmesini veya yok",
			"üçüncü kişilere bildirilmesini",
			"itiraz etme",
			"zararın giderilmesini",
		];
		for (const hak of haklar) expect(PAGE).toContain(hak);
	});

	it("yurt dışına aktarımı açıkça söyler", () => {
		// Sunucular Türkiye dışında; bunu yazmamak eksik aydınlatma olurdu.
		expect(PAGE).toContain("Yurt dışına aktarım");
	});

	it("hesapsız kullanımda veri işlenmediğini söyler", () => {
		expect(PAGE).toContain("Hesap açmadığınızda hiçbir kişisel veriniz işlenmez");
	});

	it("onay kutusu içermez", () => {
		// Aydınlatma, açık rıza DEĞİLDİR ve onunla birleştirilemez. Sayfaya bir
		// onay kutusu eklenmesi bu ayrımı bozar.
		expect(PAGE).not.toContain('type="checkbox"');
	});

	it("güncelleme tarihi geçerli bir tarihtir", () => {
		expect(PRIVACY_NOTICE_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(Number.isNaN(Date.parse(PRIVACY_NOTICE_UPDATED_AT))).toBe(false);
	});
});
