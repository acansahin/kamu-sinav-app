import { describe, expect, it } from "vitest";

import {
	kutulariSigdir,
	metinGenisligi,
	satirlaraBol,
	xmlKacir,
} from "../../scripts/social/card";
import type { Havuz, PaylasilabilirSoru } from "../../scripts/social/pool";
import { bilgiSec, cevapSec, soruSec } from "../../scripts/social/select";
import type { LedgerSatiri } from "../../scripts/social/types";

/**
 * İçerik seçimi ve kart yerleşiminin saf mantığı.
 *
 * Seçimde iki şey ölçülüyor: **tekrar etmemek** (havuz üç yıllık, tekrar
 * ledger'dan anlaşılır) ve **kararlılık** (aynı gün yeniden çalışan iş akışı
 * aynı içeriği seçmeli — yoksa yeniden denemede kart ile paylaşım farklı
 * sorulara ait olurdu).
 */

function soru(id: string, subjectId: string): PaylasilabilirSoru {
	return {
		id,
		subjectId,
		subjectAdi: subjectId,
		konuAdi: "Konu",
		stem: `${id} gövdesi`,
		options: ["A", "B", "C", "D"],
		correctIndex: 1,
		explanation: "Açıklama metni yeterince uzun olmalı.",
		dayanak: "657 sayılı Kanun md. 1",
	};
}

const havuz: Havuz = {
	sorular: [
		soru("etik-1", "etik"),
		soru("etik-2", "etik"),
		soru("anayasa-1", "anayasa"),
		soru("anayasa-2", "anayasa"),
		soru("dmk-1", "657-dmk"),
	],
	bilgiler: [
		{
			refId: "etik/a#0",
			subjectId: "etik",
			subjectAdi: "Etik",
			konuAdi: "A",
			metin: "Bilgi bir",
			dayanak: "5176",
		},
		{
			refId: "anayasa/b#0",
			subjectId: "anayasa",
			subjectAdi: "Anayasa",
			konuAdi: "B",
			metin: "Bilgi iki",
			dayanak: "2709",
		},
	],
};

function satir(
	tur: LedgerSatiri["tur"],
	refId: string,
	anahtar = `${tur}:${refId}`,
): LedgerSatiri {
	return {
		anahtar,
		tur,
		refId,
		tarih: "2026-01-01",
		gorsel: "x.jpg",
		sonuclar: [],
	};
}

describe("soruSec", () => {
	it("aynı tarihte aynı soruyu seçer", () => {
		const a = soruSec(havuz, [], "2026-08-09");
		const b = soruSec(havuz, [], "2026-08-09");

		expect(a?.id).toBe(b?.id);
	});

	it("ledger'da olan soruyu bir daha seçmez", () => {
		const kullanilan = havuz.sorular.slice(0, 4).map((s) => satir("soru", s.id));

		expect(soruSec(havuz, kullanilan, "2026-08-09")?.id).toBe("dmk-1");
	});

	it("havuz tükendiğinde durmaz, en eski paylaşılana döner", () => {
		const tum = havuz.sorular.map((s) => satir("soru", s.id));
		const secilen = soruSec(havuz, tum, "2026-08-09");

		expect(secilen).not.toBeNull();
		expect(secilen?.id).toBe("etik-1");
	});

	it("son iki paylaşımın dersinden kaçınır", () => {
		const ledger = [satir("soru", "etik-1"), satir("soru", "anayasa-1")];
		const secilen = soruSec(havuz, ledger, "2026-08-09");

		expect(secilen?.subjectId).toBe("657-dmk");
	});

	it("başka ders kalmadıysa çeşitlilik kuralını esnetir", () => {
		// Tek ders kaldı: kaçınma kuralı uygulanamaz, paylaşım yine de yapılır.
		const tekDers: Havuz = { ...havuz, sorular: [soru("etik-9", "etik")] };
		const ledger = [satir("soru", "etik-1"), satir("soru", "etik-2")];

		expect(soruSec(tekDers, ledger, "2026-08-09")?.id).toBe("etik-9");
	});

	it("boş havuzda null döner", () => {
		expect(soruSec({ sorular: [], bilgiler: [] }, [], "2026-08-09")).toBeNull();
	});
});

describe("cevapSec", () => {
	it("cevabı paylaşılmamış EN SON soruyu bulur", () => {
		const ledger = [satir("soru", "etik-1"), satir("soru", "anayasa-1")];

		expect(cevapSec(havuz, ledger)?.id).toBe("anayasa-1");
	});

	it("cevabı zaten paylaşılmışı atlar", () => {
		const ledger = [
			satir("soru", "etik-1"),
			satir("soru", "anayasa-1"),
			satir("cevap", "anayasa-1"),
		];

		expect(cevapSec(havuz, ledger)?.id).toBe("etik-1");
	});

	it("havuzdan çıkarılmış soruyu atlar", () => {
		const ledger = [satir("soru", "etik-1"), satir("soru", "silinmis-soru")];

		expect(cevapSec(havuz, ledger)?.id).toBe("etik-1");
	});

	it("bekleyen soru yoksa null döner", () => {
		expect(cevapSec(havuz, [])).toBeNull();
	});
});

describe("bilgiSec", () => {
	it("kullanılmış bilgiyi tekrar seçmez", () => {
		const ledger = [satir("bilgi", "etik/a#0")];

		expect(bilgiSec(havuz, ledger, "2026-08-09")?.refId).toBe("anayasa/b#0");
	});
});

describe("kart yerleşimi", () => {
	it("XML'de anlamlı karakterleri kaçırır", () => {
		expect(xmlKacir('a & b < c > d "e" \'f\'')).toBe(
			"a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
		);
	});

	it("metni verilen genişliğe böler", () => {
		const satirlar = satirlaraBol(
			"Kamu Görevlileri Etik Kurulu kaç üyeden oluşur?",
			300,
			40,
		);

		expect(satirlar.length).toBeGreaterThan(1);

		for (const s of satirlar) {
			expect(metinGenisligi(s, 40)).toBeLessThanOrEqual(300);
		}
	});

	it("tek başına sığmayan sözcüğü sert böler", () => {
		const satirlar = satirlaraBol("olağanüstüdurumtanımı", 60, 40);

		expect(satirlar.length).toBeGreaterThan(1);

		for (const s of satirlar) {
			expect(metinGenisligi(s, 40)).toBeLessThanOrEqual(60);
		}
	});

	it("şıkları TEK ortak puntoyla ölçer", () => {
		// Farklı uzunluktaki şıklar ayrı ayrı sığdırıldığında farklı puntoya
		// düşüyor ve kart bozuk görünüyordu.
		const { kutular } = kutulariSigdir(
			[
				"Kısa",
				"Bu şık epeyce uzun ve birden çok satıra yayılacak kadar metin içeriyor.",
				"Orta uzunlukta bir şık",
			],
			600,
			400,
			[34, 30, 26, 22],
			20,
			2,
		);

		expect(new Set(kutular.map((k) => k.boyut)).size).toBe(1);
	});

	it("yükseklik yetmezse satır sayısını kırpar", () => {
		const { kutular } = kutulariSigdir(
			[
				"Çok uzun bir metin ".repeat(20),
				"Bir başka çok uzun metin ".repeat(20),
			],
			600,
			160,
			[34, 30, 26, 22],
			20,
			2,
		);
		const toplam = kutular.reduce((t, k) => t + k.yukseklik, 0) + 20;

		expect(toplam).toBeLessThanOrEqual(160);
		expect(kutular.some((k) => k.satirlar.at(-1)?.endsWith("…"))).toBe(true);
	});
});
