import { describe, expect, it } from "vitest";
import { assemble } from "../../scripts/ingest/assemble";
import { classify } from "../../scripts/ingest/classify";
import { parseBooklet } from "../../scripts/ingest/parse-booklet";
import { parseKey } from "../../scripts/ingest/parse-key";

/**
 * Çıkmış sınav ithal hattının saf mantığı.
 *
 * Fikstürler gerçek bir kaynaktan (Sayıştay 2023 GYS Memur kitapçığı) alınmış
 * kısa örneklerdir. Ayrıştırma, sınıflandırma ve birleştirme ağa ve PDF'e
 * çıkmadan sınanır; PDF çıkarımı yalnızca CLI kabuğundadır.
 */

describe("parseBooklet", () => {
	it("numarayı, gövdeyi ve dört şıkkı çıkarır; sarmaları birleştirir", () => {
		const text = [
			"1) Aşağıdakilerden hangisi 2709 sayılı Anayasanın 2'nci",
			"maddesinde açıklanan niteliklerden biri değildir?",
			"A) İnsan haklarına saygılı olması",
			"B) Demokratik olması",
			"C) Sosyal bir hukuk devleti",
			"olması",
			"D) Parlamenter bir sisteme sahip olması",
			"2) 657 sayılı Kanunun temel ilkelerinden değildir?",
			"A) Ehliyet",
			"B) Liyakat",
			"C) Kariyer",
			"D) Sınıflandırma",
		].join("\n");

		const questions = parseBooklet(text);
		expect(questions).toHaveLength(2);

		const [q1, q2] = questions;
		expect(q1?.number).toBe(1);
		expect(q1?.stem).toContain("2709 sayılı Anayasanın 2'nci maddesinde");
		expect(q1?.options).toEqual([
			"İnsan haklarına saygılı olması",
			"Demokratik olması",
			"Sosyal bir hukuk devleti olması", // sarma birleşti
			"Parlamenter bir sisteme sahip olması",
		]);
		expect(q1?.parseOk).toBe(true);
		expect(q2?.number).toBe(2);
		expect(q2?.options).toHaveLength(4);
	});

	it("tekrarlanan sayfa üstbilgisini ve yalın sayfa numarasını eler", () => {
		const header = "T.C. SAYIŞTAY BAŞKANLIĞI";
		const text = [
			header,
			"1",
			"1) Birinci soru?",
			"A) a",
			"B) b",
			"C) c",
			"D) d",
			header,
			"2",
			"2) İkinci soru?",
			"A) a",
			"B) b",
			"C) c",
			"D) d",
			header,
		].join("\n");

		// Üstbilgi 3 kez geçiyor; eşiği 3'e çekip elenmesini bekliyoruz.
		const questions = parseBooklet(text, 3);
		expect(questions).toHaveLength(2);
		// Üstbilgi son şıkka bulaşmamalı.
		expect(questions[0]?.options[3]).toBe("d");
		expect(questions[0]?.stem).toBe("Birinci soru?");
	});

	it("dört şık çıkmayan soruyu bozuk işaretler", () => {
		const text = ["5) Eksik şıklı soru?", "A) a", "B) b"].join("\n");
		const [q] = parseBooklet(text);
		expect(q?.parseOk).toBe(false);
		expect(q?.options).toHaveLength(2);
	});
});

describe("parseKey", () => {
	it("ızgarayı numara→indeks eşlemesine çevirir", () => {
		const text = "1 D 26 A 51 C 76 C\n2 C 27 D 52 B 77 D";
		const key = parseKey(text);
		expect(key.get(1)).toBe(3); // D
		expect(key.get(26)).toBe(0); // A
		expect(key.get(52)).toBe(1); // B
		expect(key.get(77)).toBe(3); // D
	});

	it("cevap olmayan sayı+harf yakınlıklarını yutmaz", () => {
		// "120 DAKİKA" içindeki "120 D" gerçek bir cevap değildir.
		const key = parseKey("TOPLAM 100 SORU 120 DAKİKA");
		expect(key.has(120)).toBe(false);
		expect(key.size).toBe(0);
	});
});

describe("classify", () => {
	it("Anayasa sorusunu 2709 atfından tanır", () => {
		expect(
			classify(
				"Aşağıdakilerden hangisi 2709 sayılı Anayasanın Cumhuriyetin niteliklerinden biri değildir?",
			),
		).toEqual({ subjectId: "anayasa", topicId: "anayasa/genel-esaslar" });
	});

	it("657 temel ilkeler sorusunu doğru konuya koyar", () => {
		expect(
			classify("657 Sayılı Devlet Memurları Kanununun Temel İlkelerinden değildir?"),
		).toEqual({ subjectId: "657-dmk", topicId: "657-dmk/temel-ilkeler" });
	});

	it("5176 etik sorusunu etik dersine koyar", () => {
		expect(
			classify("5176 sayılı Kamu Görevlileri Etik Kurulu hükümleri kime uygulanır?"),
		).toEqual({ subjectId: "etik", topicId: "etik/etik-kurul-ve-mevzuat" });
	});

	it("Disiplin Yönetmeliği sorusunu 657 disiplin konusuna bağlar", () => {
		expect(
			classify("Devlet Memurları Disiplin Yönetmeliği uyarınca belediyeler..."),
		).toEqual({ subjectId: "657-dmk", topicId: "657-dmk/disiplin-cezalari" });
	});

	it("çıkarma cezasını (çekim ekli) disiplin konusuna bağlar", () => {
		// "memurluğundan çıkarma" — kanun atfı yok ama açıkça disiplin cezası.
		expect(
			classify("Devlet Memurluğundan çıkarma cezası için memurun bağlı bulunduğu..."),
		).toEqual({ subjectId: "657-dmk", topicId: "657-dmk/disiplin-cezalari" });
	});

	it("kuruma özgü mevzuatı hiçbir derse eşlemez", () => {
		expect(
			classify("6085 sayılı Kanunda Sayıştay Meslek Mensubu olarak..."),
		).toEqual({ subjectId: null, topicId: null });
	});

	it("Türkçe I/İ tuzağına düşmez (foldForSearch)", () => {
		// Büyük İ ile yazılmış "İLKE" de eşleşmeli.
		expect(classify("657 sayılı Kanunun temel İLKELERİ").subjectId).toBe("657-dmk");
	});
});

describe("assemble", () => {
	const parsed = [
		{ number: 1, stem: "2709 sayılı Anayasa niteliği?", options: ["a", "b", "c", "d"], parseOk: true },
		{ number: 2, stem: "657 temel ilke değildir?", options: ["a", "b", "c", "d"], parseOk: true },
		{ number: 3, stem: "6085 Sayıştay meslek mensubu?", options: ["a", "b", "c", "d"], parseOk: true },
	];

	it("anahtarı bağlar ve kaynağı damgalar", () => {
		const answers = new Map([
			[1, 3],
			[2, 0],
			[3, 2],
		]);
		const { candidates } = assemble(parsed, answers, {
			origin: "Sayıştay GYS 2023 Memur A",
			year: 2023,
			url: "https://ornek",
		});

		expect(candidates[0]?.correctIndex).toBe(3);
		expect(candidates[0]?.subjectId).toBe("anayasa");
		expect(candidates[0]?.source).toEqual({
			kind: "official-past-exam",
			origin: "Sayıştay GYS 2023 Memur A",
			year: 2023,
			url: "https://ornek",
			license: "public-official",
		});
		// Editoryal alanlar boş bırakılmalı — insan doldurur.
		expect(candidates[0]?.legalRef).toBeNull();
		expect(candidates[0]?.explanation).toBeNull();
		expect(candidates[0]?.difficulty).toBeNull();
	});

	it("kapsam raporu eşleşen/eşleşmeyen ve eksik anahtarı sayar", () => {
		const answers = new Map([
			[1, 3],
			[2, 0],
			// 3 numaranın anahtarı yok
		]);
		const { report } = assemble(parsed, answers, { origin: "x" });

		expect(report.totalParsed).toBe(3);
		expect(report.bySubject).toEqual({ anayasa: 1, "657-dmk": 1 });
		expect(report.unmatched).toBe(1); // 6085 sorusu
		expect(report.missingAnswer).toEqual([3]);
	});
});
