import { describe, expect, it } from "vitest";
import {
	type ComparableQuestion,
	NEAR_DUPLICATE_THRESHOLD,
	findNearDuplicates,
	findNearDuplicatesAgainst,
	formatPair,
	jaccard,
	stemTokens,
} from "../../scripts/near-duplicates";

/**
 * Yakın-tekrar taraması.
 *
 * Fikstürler havuzda gerçekten yaşanmış vakalardır: aynı soru farklı
 * kitapçıklarda birkaç kelimesi değişerek ve şık sayısı değişerek yayımlandığı
 * için `ingest/dedupe.ts`in birebir anahtarı onları kaçırmıştı.
 */

function question(over: Partial<ComparableQuestion> & { id: string; stem: string }): ComparableQuestion {
	return {
		options: ["Bir", "İki", "Üç", "Dört"],
		correctIndex: 0,
		status: "review",
		...over,
	};
}

/** Fikstürün doğru şıkkının metni. */
function cevap(q: ComparableQuestion): string | undefined {
	return q.correctIndex === null ? undefined : q.options[q.correctIndex];
}

describe("stemTokens", () => {
	it("Türkçe küçültme ve aksan sadeleştirmesi uygular", () => {
		expect(stemTokens("IŞIK Ağır")).toEqual(new Set(["isik", "agir"]));
	});

	it("kalıp sözcükleri ve çok kısa kelimeleri atar", () => {
		const tokens = stemTokens(
			"657 sayılı Devlet Memurları Kanunu'na göre aşağıdakilerden hangisi doğrudur?",
		);
		expect(tokens.has("sayili")).toBe(false);
		expect(tokens.has("gore")).toBe(false);
		expect(tokens.has("hangisi")).toBe(false);
		expect(tokens.has("kanununa")).toBe(false);
		expect([...tokens].sort()).toEqual(["657", "devlet", "dogrudur", "memurlari"]);
	});

	it("PDF satır-sonu tirelemesini kapatır", () => {
		expect(stemTokens("korun- masına")).toEqual(stemTokens("korunmasına"));
	});
});

describe("jaccard", () => {
	it("aynı kümede 1, ayrık kümelerde 0 döner", () => {
		expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
		expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
	});

	it("boş kümede 0 döner (sıfıra bölme yok)", () => {
		expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
	});
});

describe("findNearDuplicates", () => {
	it("yazımı farklı ama aynı olan soruyu yakalar", () => {
		const pairs = findNearDuplicates([
			question({
				id: "meb-dan19m-q013",
				stem: "657 sayılı Devlet Memurları Kanunu'na göre eşinin kardeşi ölen bir devlet memuruna isteği üzerine en fazla kaç gün mazeret izni verilebilir?",
			}),
			question({
				id: "meb-cte19idm-q082",
				stem: "657 sayılı Devlet Memurları Kanunu’na göre eşinin kardeşi ölen bir Devlet memuruna isteği üzerine en fazla kaç gün mazeret izni verilir?",
			}),
		]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].score).toBeGreaterThan(NEAR_DUPLICATE_THRESHOLD);
	});

	it("şık sayısı farklı olsa da yakalar — MEB 5 şıklı, Sayıştay 4 şıklı yayımlar", () => {
		const stem =
			"657 sayılı Devlet Memurları Kanunu'nda “Devlet memurlarına, sınıfları içinde en yüksek derecelere kadar ilerleme imkânını sağlamaktır.” şeklinde tanımlanan ilke hangisidir?";
		const pairs = findNearDuplicates([
			question({ id: "besli", stem, options: ["A", "B", "C", "D", "E"] }),
			question({ id: "dortlu", stem }),
		]);

		expect(pairs.map((p) => p.score)).toEqual([1]);
	});

	it("gövdesi neredeyse aynı olan FARKLI hükümleri de rapora alır — kararı insan verir", () => {
		// 657 md.77: yabancı resmî kurum 10 yıl / uluslararası kuruluş 21 yıl.
		// İki cümle yalnızca birkaç kelimeyle ayrılır; hiçbir metin ölçütü bunu
		// gerçek tekrardan ayıramaz. Tarama bu yüzden hata değil uyarı üretir ve
		// çifti listeler; ölçüt "test edilen hüküm"dür, onu da editör görür.
		const pairs = findNearDuplicates([
			question({
				id: "yabanci",
				stem: "657 sayılı Devlet Memurları Kanunu uyarınca yabancı memleketlerin resmi kurumlarında kurumlarının muvafakati ile görev alacak memurlara, memuriyeti süresince kaç yıla kadar aylıksız izin verilebilir?",
				options: ["8", "10", "12", "21"],
				correctIndex: 1,
			}),
			question({
				id: "uluslararasi",
				stem: "657 sayılı Devlet Memurları Kanunu uyarınca uluslararası kuruluşlarda, kurumlarının muvafakati ile görev alacak memurlara, memuriyeti süresince kaç yıla kadar aylıksız izin verilebilir?",
				options: ["8", "10", "15", "21"],
				correctIndex: 3,
			}),
		]);

		expect(pairs).toHaveLength(1);
		// Doğru cevaplar farklı olduğu için liste sıralamasında arkaya düşer.
		expect(cevap(pairs[0].first)).not.toBe(cevap(pairs[0].second));
	});

	it("kalıp cümlesi değişmiş gerçek tekrarı kaçırmaz (eşik regresyonu)", () => {
		// Havuzda yaşandı: aynı "Kariyer" tanımı sorusu iki kitapçıkta farklı
		// kalıpla sorulmuş, benzerlik 0.69 çıkmıştı. Eşik 0.72 iken kaçıyordu.
		const pairs = findNearDuplicates([
			question({
				id: "meb-adl23-q022",
				stem: '657 sayılı Devlet Memurları Kanunu\'na göre, "Devlet memurlarına, yaptıkları hizmetler için lüzumlu bilgilere ve yetişme şartlarına uygun şekilde, sınıfları içinde en yüksek derecelere kadar ilerleme imkânı sağlamaktır." şeklinde ifade edilen temel ilke aşağıdakilerden hangisidir?',
				options: ["Eşitlik", "Liyakat", "İstihdam", "Sınıflandırma", "Kariyer"],
				correctIndex: 4,
			}),
			question({
				id: "meb-cte19m-q081",
				stem: '657 sayılı Devlet Memurları Kanunu\'nda "Devlet memurlarına, yaptıkları hizmetler için lüzumlu bilgilere ve yetişme şartlarına uygun şekilde, sınıfları içinde en yüksek derecelere kadar ilerleme imkânını sağlamaktır." şeklinde aşağıdakilerden hangisi tanımlanmıştır?',
				options: ["Sınıflandırma", "Kariyer", "Liyakat", "Sadakat"],
				correctIndex: 1,
			}),
		]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].score).toBeLessThan(0.72);
		expect(pairs[0].score).toBeGreaterThanOrEqual(NEAR_DUPLICATE_THRESHOLD);
	});

	it("alakasız soruları eşleştirmez", () => {
		const pairs = findNearDuplicates([
			question({ id: "a", stem: "657 sayılı Kanun'a göre aylıktan kesme cezası kaç gün içinde uygulanır?" }),
			question({ id: "b", stem: "2709 sayılı Anayasa'ya göre Anayasa Mahkemesi kaç üyeden oluşur?" }),
		]);

		expect(pairs).toEqual([]);
	});

	it("dersler arası karşılaştırma yapar — aynı hüküm iki dersin dosyasında olabilir", () => {
		const stem =
			"Mal bildirimlerindeki bilgilerin doğruluğunun kontrolü amacıyla ilgili kişi ve kuruluşlar talep edilen bilgileri en geç kaç gün içinde Kurula vermekle yükümlüdür?";
		const pairs = findNearDuplicates([
			question({ id: "etikte", stem }),
			question({ id: "dmkde", stem }),
		]);

		expect(pairs).toHaveLength(1);
	});

	it("kısa gövdeli farklı soruları eşleştirmez — oran kısa metinde şişer", () => {
		// Havuzdan gerçek vaka: iki soru tek kelimeyle ayrılıyor ve %67 alıyordu.
		const pairs = findNearDuplicates([
			question({ id: "anayasa-yargi-012", stem: "Yargıya ilişkin aşağıdaki ifadelerden hangisi yanlıştır?" }),
			question({ id: "anayasa-yurutme-012", stem: "Yürütmeye ilişkin aşağıdaki ifadelerden hangisi yanlıştır?" }),
		]);

		expect(pairs).toEqual([]);
	});

	it("kısa gövde tabanı, birebir örtüşen kökleri gizlemez", () => {
		// Aynı kök iki kez sorulmuşsa aday aynı cümleyi iki kez görür; gövde kısa
		// olsa da rapora girmeli (havuzda gerçekten var: adl23-q002 / dan19v-q002).
		const stem = "T.C. Anayasası'na göre aşağıdakilerden hangisi sosyal ve ekonomik haklar ve ödevlerdendir?";
		const pairs = findNearDuplicates([
			question({ id: "adl23", stem }),
			question({ id: "dan19v", stem }),
		]);

		expect(pairs).toHaveLength(1);
		expect(pairs[0].score).toBe(1);
	});

	it("doğru cevabı da aynı olan çiftleri listenin başına alır", () => {
		const ortak = "Devlet Memurları Disiplin Yönetmeliği uyarınca disiplin cezası verme yetkisi hangi sürede zamanaşımına uğrar sorusunun karşılığı nedir";
		const pairs = findNearDuplicates([
			question({ id: "farkli-cevap-a", stem: `${ortak} birinci hâlde`, options: ["Bir", "İki", "Üç", "Dört"], correctIndex: 0 }),
			question({ id: "farkli-cevap-b", stem: `${ortak} ikinci hâlde`, options: ["Bir", "İki", "Üç", "Dört"], correctIndex: 1 }),
			question({ id: "ayni-cevap-a", stem: `${ortak} üçüncü hâlde`, options: ["Bir", "İki", "Üç", "Dört"], correctIndex: 2 }),
			question({ id: "ayni-cevap-b", stem: `${ortak} dördüncü hâlde`, options: ["Bir", "İki", "Üç", "Dört"], correctIndex: 2 }),
		]);

		const ilk = pairs[0];
		expect(cevap(ilk.first)).toBe(cevap(ilk.second));
	});

	it("çiftleri benzerliği azalan sırada döner", () => {
		const pairs = findNearDuplicates([
			question({ id: "a", stem: "Disiplin cezası verme yetkisi hangi sürede zamanaşımına uğrar?" }),
			question({ id: "b", stem: "Disiplin cezası verme yetkisi hangi sürede zamanaşımına uğrar?" }),
			question({ id: "c", stem: "Disiplin cezası verme yetkisi hangi sürede zamanaşımına uğrar acaba?" }),
		]);

		expect(pairs.length).toBeGreaterThan(1);
		expect(pairs[0].score).toBeGreaterThanOrEqual(pairs[1].score);
	});
});

describe("findNearDuplicatesAgainst", () => {
	const havuz = [
		question({
			id: "meb-dan19m-q013",
			stem: "657 sayılı Devlet Memurları Kanunu'na göre eşinin kardeşi ölen bir devlet memuruna isteği üzerine en fazla kaç gün mazeret izni verilebilir?",
		}),
		question({ id: "alakasiz", stem: "2709 sayılı Anayasa'ya göre Anayasa Mahkemesi kaç üyeden oluşur?" }),
	];

	it("adayı havuzdaki soruyla eşleştirir", () => {
		const pairs = findNearDuplicatesAgainst(
			[
				question({
					id: "#82",
					stem: "657 sayılı Devlet Memurları Kanunu’na göre eşinin kardeşi ölen bir Devlet memuruna isteği üzerine en fazla kaç gün mazeret izni verilir?",
				}),
			],
			havuz,
		);

		expect(pairs).toHaveLength(1);
		// Rapor "yeni gelen ↔ havuzdaki" okunacak şekilde yazıldığı için sıra bağlayıcıdır.
		expect(pairs[0].first.id).toBe("#82");
		expect(pairs[0].second.id).toBe("meb-dan19m-q013");
	});

	it("havuzun KENDİ içindeki tekrarları raporlamaz", () => {
		const ikizHavuz = [...havuz, { ...havuz[0], id: "kopya" }];
		const pairs = findNearDuplicatesAgainst([], ikizHavuz);

		expect(pairs).toEqual([]);
	});

	it("cevap anahtarı eşleşmemiş adayı (correctIndex null) taşıyabilir", () => {
		const pairs = findNearDuplicatesAgainst(
			[{ id: "#82", stem: havuz[0].stem, options: havuz[0].options, correctIndex: null }],
			havuz,
		);

		expect(pairs).toHaveLength(1);
		expect(formatPair(pairs[0])[2]).toContain("(cevapsız)");
	});
});

describe("formatPair", () => {
	it("kimlikleri, şık sayısını, durumu ve iki doğru cevabı birlikte gösterir", () => {
		const [head, , answers] = formatPair({
			score: 0.88,
			first: question({ id: "eski", stem: "Aynı soru", correctIndex: 0 }),
			second: question({ id: "yeni", stem: "Aynı soru", options: ["Bir", "İki", "Üç", "Dört", "Beş"], correctIndex: 4 }),
		});

		expect(head).toContain("%88");
		expect(head).toContain("eski (4 şık, review)");
		expect(head).toContain("yeni (5 şık, review)");
		// İki doğru cevabın yan yana görünmesi, "aynı hükmü mü ölçüyorlar"
		// kararının tek satırda verilebilmesi içindir.
		expect(answers).toContain("Bir");
		expect(answers).toContain("Beş");
	});
});
