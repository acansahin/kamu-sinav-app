import { describe, expect, it } from "vitest";
import { assemble } from "../../scripts/ingest/assemble";
import { classify } from "../../scripts/ingest/classify";
import { dedupeCandidates } from "../../scripts/ingest/dedupe";
import { parseBooklet } from "../../scripts/ingest/parse-booklet";
import { parseKey } from "../../scripts/ingest/parse-key";
import {
	type ColoredRun,
	isNeutralColor,
	markGroups,
	matchMarkedAnswers,
} from "../../scripts/ingest/parse-marked-key";
import { type PoolQuestion, splitByPool } from "../../scripts/ingest/pool";
import { splitBookletAndKey } from "../../scripts/ingest/split-booklet";
import type { CandidateQuestion, ParsedQuestion } from "../../scripts/ingest/types";

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

	it("beş şıklı soruyu (A–E) ayrıştırır ve geçerli sayar", () => {
		// MEB/ÖSYM kitapçıkları 5 şıklıdır; parser E'yi de yakalamalı.
		const text = [
			"1) 5 şıklı bir soru gövdesi?",
			"A) birinci",
			"B) ikinci",
			"C) üçüncü",
			"D) dördüncü",
			"E) beşinci",
		].join("\n");
		const [q] = parseBooklet(text);
		expect(q?.options).toHaveLength(5);
		expect(q?.options[4]).toBe("beşinci");
		expect(q?.parseOk).toBe(true);
	});

	it("dört şık çıkmayan soruyu bozuk işaretler", () => {
		const text = ["5) Eksik şıklı soru?", "A) a", "B) b"].join("\n");
		const [q] = parseBooklet(text);
		expect(q?.parseOk).toBe(false);
		expect(q?.options).toHaveLength(2);
	});

	it("MEB biçimini (N. markörü) ayrıştırır ve numaralı yönerge önsözünü atlar", () => {
		// MEB/ÖDSGM kitapçığı: sorulardan önce numaralı bir GENEL AÇIKLAMA önsözü var
		// ve sorular "N." (parantez değil) ile başlıyor. Önsöz soru sanılmamalı.
		const text = [
			"1. Bu soru kitapçığında 100 soru vardır.",
			"2. Sınav süresi 110 dakikadır.",
			"3. İşaretlemelerinizi kurşun kalemle yapınız.",
			// Numara yeniden 1'e döner → sorular başlar.
			"1. 2709 sayılı Anayasa'ya göre egemenlik kime aittir?",
			"A) Millete",
			"B) Cumhurbaşkanına",
			"C) TBMM'ye",
			"D) Hükûmete",
			"E) Yargıya",
			"2. 657 sayılı Kanuna göre aşağıdakilerden hangisi temel ilkedir?",
			"A) Sınıflandırma",
			"B) Eşitlik",
			"C) Tarafsızlık",
			"D) Süreklilik",
			"E) Güvence",
		].join("\n");

		const questions = parseBooklet(text);
		expect(questions).toHaveLength(2); // önsözün 3 maddesi soru sayılmadı
		expect(questions[0]?.number).toBe(1);
		expect(questions[0]?.stem).toContain("egemenlik kime aittir");
		expect(questions[0]?.stem).not.toContain("kitapçığında"); // önsöz sızmadı
		expect(questions[0]?.options).toEqual([
			"Millete",
			"Cumhurbaşkanına",
			"TBMM'ye",
			"Hükûmete",
			"Yargıya",
		]);
		expect(questions[0]?.parseOk).toBe(true);
		expect(questions[1]?.number).toBe(2);
		expect(questions[1]?.options).toHaveLength(5);
	});

	it("gövdedeki numaralı alt-maddeleri yeni soru sanmaz", () => {
		// "Aşağıdakilerden hangileri?" tipi soruda gövde 1./2./3. ile numaralı
		// ifadeler taşır; bunlar şıktan ÖNCE geldiği için gövdenin parçasıdır.
		// Soru bölgesi ilk şıkla açılır (yönerge bölgesi değil), bu yüzden alt-madde
		// içeren soruyu Q2 olarak (ilk sorudan sonra) kurgularız.
		const text = [
			"1. Bu kitapçıkta 50 soru vardır.", // önsöz
			"2. Süre 60 dakikadır.",
			"1. Basit ilk soru?", // Q1 — şıklarıyla soru bölgesini açar
			"A) w",
			"B) x",
			"C) y",
			"D) z",
			"2. Aşağıdaki ifadelerden hangileri doğrudur?", // Q2 — alt-maddeli
			"1. Birinci ifade",
			"2. İkinci ifade",
			"3. Üçüncü ifade",
			"A) Yalnız 1",
			"B) 1 ve 2",
			"C) 2 ve 3",
			"D) 1, 2 ve 3",
			"E) Hiçbiri",
		].join("\n");

		const questions = parseBooklet(text);
		expect(questions).toHaveLength(2);
		expect(questions[1]?.stem).toContain("hangileri doğrudur");
		expect(questions[1]?.stem).toContain("Birinci ifade");
		expect(questions[1]?.stem).toContain("Üçüncü ifade");
		expect(questions[1]?.options).toHaveLength(5);
		expect(questions[1]?.options[0]).toBe("Yalnız 1");
	});

	it("birden çok numaralı yönerge kutusunu atlar, gerçek ilk soruyu korur", () => {
		// Gerçek MEB kalıbı: sorulardan önce İKİ numaralı yönerge kutusu (numara
		// yeniden 1'e döner). Restart değil, İLK ŞIK gerçek soruyu belirler.
		const text = [
			"1. Sınav saat 10.00'da başlayacaktır.", // 1. kutu
			"2. Cep telefonu bulundurmayınız.",
			"1. Cevap kâğıdınızı imzalayınız.", // 2. kutu (numara yeniden 1)
			"2. Kitapçık türünüzü kodlayınız.",
			"3. Kurşun kalem kullanınız.",
			"1. Gerçek ilk soru gövdesi?", // Q1
			"A) a",
			"B) b",
			"C) c",
			"D) d",
		].join("\n");

		const questions = parseBooklet(text);
		expect(questions).toHaveLength(1);
		expect(questions[0]?.stem).toBe("Gerçek ilk soru gövdesi?");
		expect(questions[0]?.options).toEqual(["a", "b", "c", "d"]);
		expect(questions[0]?.parseOk).toBe(true);
	});

	it("tek satıra yatay dizili kısa şıkları ayrı ayrı okur", () => {
		// MEB kısa şıkları yatay dizer: "A) 9/1 B) 10/1 C) 10/2 D) 10/3".
		const text = [
			"1. Giriş derece ve kademesi aşağıdakilerden hangisidir?",
			"A) 9/1 B) 10/1 C) 10/2 D) 10/3",
		].join("\n");

		const [q] = parseBooklet(text);
		expect(q?.options).toEqual(["9/1", "10/1", "10/2", "10/3"]);
		expect(q?.parseOk).toBe(true);
	});

	it("değişken sayfa numaralı üstbilgiyi eler, son şıkka bulaştırmaz", () => {
		// Gerçek MEB kaçağı: her sayfada dönen "NİNŞAAT MÜHENDİSİ A" başlığı sayfa
		// numarası taşıdığından düz eşleşmeyle yakalanmaz; rakam-düşülmüş sıklıkla
		// yakalanıp son şıkka ("10/3") yapışması önlenmeli.
		const text = [
			"1. Giriş derecesi?",
			"A) 9/1 B) 10/1 C) 10/2 D) 10/3",
			"2İNŞAAT MÜHENDİSİ A",
			"2. İkinci?",
			"A) a",
			"B) b",
			"C) c",
			"D) d",
			"4İNŞAAT MÜHENDİSİ A",
			"3. Üçüncü?",
			"A) e",
			"B) f",
			"C) g",
			"D) h",
			"6İNŞAAT MÜHENDİSİ A",
			"4. Dördüncü?",
			"A) i",
			"B) j",
			"C) k",
			"D) l",
			"8İNŞAAT MÜHENDİSİ A",
			"5. Beşinci?",
			"A) m",
			"B) n",
			"C) o",
			"D) p",
			"10İNŞAAT MÜHENDİSİ A",
		].join("\n");

		const qs = parseBooklet(text, 5); // başlık 5 kez döndü → eşik 5
		expect(qs).toHaveLength(5);
		expect(qs[0]?.options).toEqual(["9/1", "10/1", "10/2", "10/3"]); // temiz
		expect(qs[1]?.options).toEqual(["a", "b", "c", "d"]);
	});

	it("kısa kitapçıkta düşük tekrarlı BÜYÜK HARF üstbilgiyi son şıkka bulaştırmaz", () => {
		// Danıştay 2019 kalıbı: 9 sayfa, üstbilgi 3 yapışık biçime bölünür ve
		// eşiği (5) aşamaz; ama tamamen BÜYÜK HARF olduğundan 2+ tekrarla elenmeli.
		// Aksi hâlde ayrı satırdaki başlık, açık son şıkka ("Otuz") eklenirdi.
		const footer = "ÖLÇME, DEĞERLENDİRME VE SINAV HİZMETLERİ GENEL MÜDÜRLÜĞÜ";
		const text = [
			"1. Birinci soru?",
			"A) a B) b C) c D) Otuz",
			"4VERİ HAZIRLAMA VE KONTROL İŞLETMENİ A",
			footer,
			"2. İkinci soru?",
			"A) e B) f C) g D) h",
			"6VERİ HAZIRLAMA VE KONTROL İŞLETMENİ A",
			footer,
			"3. Üçüncü soru?",
			"A) i B) j C) k D) l",
			"8VERİ HAZIRLAMA VE KONTROL İŞLETMENİ A",
			footer,
		].join("\n");

		// Varsayılan eşik 5; başlık/altbilgi biçimleri yalnızca 3 kez geçiyor.
		const qs = parseBooklet(text);
		expect(qs).toHaveLength(3);
		expect(qs[0]?.options).toEqual(["a", "b", "c", "Otuz"]); // üstbilgi bulaşmadı
		expect(qs[2]?.options).toEqual(["i", "j", "k", "l"]);
	});

	it("sık tekrarlanan GÖVDE satırını üstbilgi sanıp elemez", () => {
		// Gerçek kaçak: "yanlıştır?" bir kitapçıkta onlarca soruda kendi satırına
		// sarar ve sıklık eşiğini rahat aşar. Elenirse soru ANLAM OLARAK TERSİNE
		// döner ("hangisi yanlıştır?" → "hangisi?"), üstelik sessizce: gövde
		// dilbilgisel görünmeye devam eder. Üstbilgiden ayıran şey mixed-case
		// olmasıdır; sıklık tek başına ölçüt olamaz.
		const tail = "yanlıştır?";
		const lines: string[] = [];
		for (let i = 1; i <= 6; i += 1) {
			lines.push(`${i}. Devlet memurları ile ilgili aşağıdakilerden hangisi`);
			lines.push(tail);
			lines.push("A) a B) b C) c D) d");
		}
		const qs = parseBooklet(lines.join("\n"));

		expect(qs).toHaveLength(6);
		for (const q of qs) {
			expect(q.stem).toContain("yanlıştır?");
			expect(q.parseOk).toBe(true);
		}
	});

	it("gövde ortasındaki sık tekrarlı sarma satırını düşürmez", () => {
		// TMO 2015 kalıbı: uzun kanun adı hecelenerek sarar ("...Kanun Hük-") ve
		// aynı kanuna atıf yapan 10 soruda birebir tekrarlar. Bu satır gövdenin
		// ORTASINDADIR — sonu "?" ile bitme sezgisiyle yakalanamaz, sessizce düşer.
		const wrap = "Rejiminin Düzenlenmesine Dair Kanun Hük-";
		const lines: string[] = [];
		for (let i = 1; i <= 6; i += 1) {
			lines.push(`${i}. 399 sayılı Kamu İktisadi Teşebbüsleri Personel`);
			lines.push(wrap);
			lines.push("münde Kararname’ye göre aşağıdakilerden hangisidir?");
			lines.push("A) a B) b C) c D) d");
		}
		const qs = parseBooklet(lines.join("\n"));

		expect(qs).toHaveLength(6);
		expect(qs[0]?.stem).toBe(
			"399 sayılı Kamu İktisadi Teşebbüsleri Personel Rejiminin Düzenlenmesine " +
				"Dair Kanun Hük- münde Kararname’ye göre aşağıdakilerden hangisidir?",
		);
	});

	it("tek maddelik önsözden sonra ilk soruyu (restart olmadan, şıkla) yakalar", () => {
		// Önsöz tek maddeyse numara küçülmez; soru bölgesi ilk şıkla açılmalı.
		const text = [
			"1. Bu kitapçıkta 20 soru vardır.", // tek maddelik önsöz
			"1. 5176 sayılı Kanun neyi düzenler?", // gerçek soru
			"A) a",
			"B) b",
			"C) c",
			"D) d",
			"E) e",
		].join("\n");

		const questions = parseBooklet(text);
		expect(questions).toHaveLength(1);
		expect(questions[0]?.stem).toContain("5176 sayılı Kanun");
		expect(questions[0]?.stem).not.toContain("kitapçıkta");
		expect(questions[0]?.options).toHaveLength(5);
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

	it("beş şıklı sınavda E cevabını da tanır", () => {
		// MEB/ÖSYM kitapçıkları 5 şıklıdır; anahtar E'yi de içerebilir.
		const key = parseKey("1 E 2 A 3 D 4 C 5 B");
		expect(key.get(1)).toBe(4); // E
		expect(key.get(2)).toBe(0); // A
		expect(key.get(5)).toBe(1); // B
		expect(key.size).toBe(5);
	});

	it("numarası noktalı (1. E) anahtar biçimini de okur", () => {
		// MEB anahtarları numarayı noktayla yazar; nokta yutulmalı.
		const key = parseKey("1. E  2. A  3. D");
		expect(key.get(1)).toBe(4);
		expect(key.get(2)).toBe(0);
		expect(key.get(3)).toBe(3);
		expect(key.size).toBe(3);
	});
});

describe("splitBookletAndKey", () => {
	it("birleşik metni CEVAP ANAHTARI başlığından ikiye böler", () => {
		const text = [
			"1. Soru gövdesi?",
			"A) a",
			"B) b",
			"C) c",
			"D) d",
			"E) e",
			"CEVAP ANAHTARI",
			"1. E  2. A",
		].join("\n");

		const { bookletText, keyText } = splitBookletAndKey(text);
		expect(bookletText).toContain("Soru gövdesi");
		expect(bookletText).not.toContain("CEVAP ANAHTARI");
		expect(keyText).toContain("CEVAP ANAHTARI");
		expect(keyText).toContain("1. E");
		// Anahtar ızgarası soru bölümüne sızmamalı.
		expect(bookletText).not.toContain("1. E");
	});

	it("başlık yoksa anahtarı boş bırakır, soruyu olduğu gibi verir", () => {
		const text = "1. Soru?\nA) a\nB) b\nC) c\nD) d";
		const { bookletText, keyText } = splitBookletAndKey(text);
		expect(keyText).toBe("");
		expect(bookletText).toBe(text);
	});

	it("başlığı büyük/küçük harf ve Türkçe I tuzağına düşmeden bulur", () => {
		// "Cevap Anahtarı" karışık yazılışta da, "ANAHTARLARI" çoğulunda da eşleşmeli.
		const a = splitBookletAndKey("soru\nCevap Anahtarı\n1 E");
		expect(a.keyText).toContain("Cevap Anahtarı");
		const b = splitBookletAndKey("soru\nCEVAP ANAHTARLARI\n1 E");
		expect(b.keyText).toContain("CEVAP ANAHTARLARI");
	});

	it("tek dosyalık birleşik akış: böl → ayrıştır → anahtarla eşleş", () => {
		// Uçtan uca: birleşik metinden hem sorular hem doğru cevaplar çıkmalı,
		// anahtar ızgarası son sorunun şıkkına bulaşmamalı.
		const combined = [
			"1. Bu kitapçıkta 2 soru vardır.", // önsöz
			"1. 2709 sayılı Anayasa niteliği?",
			"A) a1",
			"B) b1",
			"C) c1",
			"D) d1",
			"E) e1",
			"2. 657 temel ilke değildir?",
			"A) a2",
			"B) b2",
			"C) c2",
			"D) d2",
			"E) e2",
			"CEVAP ANAHTARI",
			"1. E  2. C",
		].join("\n");

		const { bookletText, keyText } = splitBookletAndKey(combined);
		const parsed = parseBooklet(bookletText);
		const answers = parseKey(keyText);

		expect(parsed).toHaveLength(2);
		// Son sorunun son şıkkı temiz ("e2"), anahtar bulaşmamış.
		expect(parsed[1]?.options).toEqual(["a2", "b2", "c2", "d2", "e2"]);
		expect(answers.get(1)).toBe(4); // E
		expect(answers.get(2)).toBe(2); // C

		const { candidates } = assemble(parsed, answers, { origin: "MEB test" });
		expect(candidates[0]?.correctIndex).toBe(4);
		expect(candidates[0]?.subjectId).toBe("anayasa");
		expect(candidates[1]?.correctIndex).toBe(2);
		expect(candidates[1]?.subjectId).toBe("657-dmk");
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

	it("mevzuat atfı olmayan 'etik kavramları' sorusunu etik'e koyar", () => {
		// Gerçek MEB Şube Müdürü sorusu: 5176/etik kurul demeden "etik kavramları".
		expect(
			classify(
				"“…standartlardır.” ifadesi aşağıdaki etik kavramlarından hangisi ile ilişkilidir?",
			).subjectId,
		).toBe("etik");
	});

	it("çekimli 'etiği' biçimini de (foldlanınca 'etigi') etik sayar", () => {
		expect(classify("Kamu görevlileri etiği ile ilgili aşağıdakilerden hangisi?").subjectId).toBe(
			"etik",
		);
	});

	it("'etiket' ve '-etik' ekli sözcükleri etik SANMAZ", () => {
		// "etiket" (?!et) ile, "estetik/sentetik" \b sözcük sınırıyla elenmeli.
		expect(classify("Ürün üzerindeki fiyat etiketi nasıl okunur?").subjectId).toBeNull();
		expect(classify("Estetik ve sentetik malzemelerin farkı nedir?").subjectId).toBeNull();
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

describe("dedupeCandidates", () => {
	const candidate = (
		number: number,
		stem: string,
		options: string[],
		correctIndex: number,
		origin = "kaynak",
	): CandidateQuestion => ({
		number,
		subjectId: "657-dmk",
		topicId: null,
		difficulty: null,
		stem,
		options,
		correctIndex,
		legalRef: null,
		explanation: null,
		source: { kind: "official-past-exam", origin, license: "public-official" },
		status: "draft",
	});

	it("şıkları karıştırılmış aynı soruyu tek sayar", () => {
		// Aynı gövde + aynı şık KÜMESİ (farklı sıra, farklı doğru harf) → tek.
		const a = candidate(15, "Vekâlet görevi ile ilgili yanlış olan?", ["p", "q", "r", "s"], 3, "avukat");
		const b = candidate(22, "Vekâlet görevi ile ilgili yanlış olan?", ["q", "s", "r", "p"], 1, "sosyolog");
		const { unique, duplicatesRemoved } = dedupeCandidates([a, b]);
		expect(unique).toHaveLength(1);
		expect(duplicatesRemoved).toBe(1);
		// İlk görülen (kendi şık sırası + cevabıyla) korunur.
		expect(unique[0]?.source.origin).toBe("avukat");
		expect(unique[0]?.correctIndex).toBe(3);
	});

	it("PDF tire kırpması ve Türkçe küçültme farkını yutup tek sayar", () => {
		const a = candidate(1, "Kişisel verilerin korun- masına ilişkin?", ["a", "b", "c", "d"], 0);
		const b = candidate(1, "Kişisel verilerin korunmasına İLİŞKİN?", ["a", "b", "c", "d"], 0);
		expect(dedupeCandidates([a, b]).unique).toHaveLength(1);
	});

	it("kaynaklar arası kesme işareti/noktalama farkını yutup tek sayar", () => {
		// Aynı soru, gövdede "Meclisinde" vs "Meclisi'nde" (kesme işareti) farkı.
		const a = candidate(9, "TBMM Meclisinde görüşülme usulü?", ["a", "b", "c", "d"], 2);
		const b = candidate(9, "TBMM Meclisi'nde görüşülme usulü?", ["a", "b", "c", "d"], 2);
		expect(dedupeCandidates([a, b]).unique).toHaveLength(1);
	});

	it("gövdesi aynı ama şık kümesi farklı gerçek soruları ayrı tutar", () => {
		const a = candidate(1, "Aynı gövde?", ["a", "b", "c", "d"], 0);
		const b = candidate(1, "Aynı gövde?", ["a", "b", "c", "x"], 0);
		expect(dedupeCandidates([a, b]).unique).toHaveLength(2);
	});

	it("farklı soruları korur ve sırayı bozmaz", () => {
		const a = candidate(1, "Birinci soru?", ["a", "b", "c", "d"], 0);
		const b = candidate(2, "İkinci soru?", ["a", "b", "c", "d"], 1);
		const { unique, duplicatesRemoved } = dedupeCandidates([a, b]);
		expect(unique).toHaveLength(2);
		expect(duplicatesRemoved).toBe(0);
		expect(unique.map((c) => c.number)).toEqual([1, 2]);
	});
});

describe("splitByPool", () => {
	const candidate = (number: number, stem: string, options: string[]): CandidateQuestion => ({
		number,
		subjectId: "657-dmk",
		topicId: null,
		difficulty: null,
		stem,
		options,
		correctIndex: 0,
		legalRef: null,
		explanation: null,
		source: { kind: "official-past-exam", origin: "kaynak", license: "public-official" },
		status: "draft",
	});

	const pooled = (id: string, stem: string, options: string[]): PoolQuestion => ({
		id,
		stem,
		options,
		correctIndex: 0,
		status: "review",
	});

	it("havuzda birebir karşılığı olan adayı düşer ve eşleştiği soruyu bildirir", () => {
		const { fresh, alreadyInPool } = splitByPool(
			[candidate(82, "Eşinin kardeşi ölen memura kaç gün izin verilir?", ["Beş", "Yedi"])],
			[pooled("meb-dan19m-q013", "Eşinin kardeşi ölen memura kaç gün izin verilir?", ["Beş", "Yedi"])],
		);

		expect(fresh).toEqual([]);
		expect(alreadyInPool).toHaveLength(1);
		expect(alreadyInPool[0].poolId).toBe("meb-dan19m-q013");
	});

	it("şıkları karıştırılmış aynı soruyu da havuzda bulur", () => {
		// Kitapçıklar arası şık karıştırması dedupeKey'de sıralanarak yutulur.
		const { fresh } = splitByPool(
			[candidate(82, "Aynı gövde?", ["Yedi", "Beş"])],
			[pooled("havuzdaki", "Aynı gövde?", ["Beş", "Yedi"])],
		);

		expect(fresh).toEqual([]);
	});

	it("gövdesi aynı ama şık kümesi farklı adayı yeni sayar — karar editörün", () => {
		const { fresh, alreadyInPool } = splitByPool(
			[candidate(82, "Aynı gövde?", ["Beş", "Altı"])],
			[pooled("havuzdaki", "Aynı gövde?", ["Beş", "Yedi"])],
		);

		expect(fresh).toHaveLength(1);
		expect(alreadyInPool).toEqual([]);
	});

	it("boş havuzda her adayı yeni sayar — depo okunamazsa ithal durmamalı", () => {
		const { fresh } = splitByPool([candidate(1, "Herhangi bir soru?", ["a", "b"])], []);
		expect(fresh).toHaveLength(1);
	});
});

describe("markGroups", () => {
	const red = (text: string): ColoredRun => ({ color: "#ff0000", text });
	const black = (text: string): ColoredRun => ({ color: "#000000", text });

	it("ardışık renkli parçaları tek işaret sayar, harfi ayırır", () => {
		expect(markGroups([black("1. Soru?"), red("B)"), red("1912"), black("2. Soru?")])).toEqual([
			{ letter: "B", text: "1912" },
		]);
	});

	it("harf ile parantez ayrı parçalara bölünmüşse de harfi okur", () => {
		// DHMİ kitapçığında ölçüldü: bazı şıklarda "A" ve ")" ayrı çizim parçası.
		expect(markGroups([red("A"), red(")"), red("1900")])).toEqual([{ letter: "A", text: "1900" }]);
	});

	it("araya giren siyah metin işareti kapatır — iki cevap birleşmez", () => {
		expect(markGroups([red("B) Birinci"), black("araya giren gövde"), red("C) İkinci")])).toEqual([
			{ letter: "B", text: "Birinci" },
			{ letter: "C", text: "İkinci" },
		]);
	});

	it("harfi boyanmamış işareti metniyle taşır", () => {
		expect(markGroups([red("Yeşilköy Havaalanı")])).toEqual([
			{ letter: null, text: "Yeşilköy Havaalanı" },
		]);
	});

	it("gri ve siyah parçalardan işaret üretmez", () => {
		expect(markGroups([black("B) Yanlış"), { color: "#333333", text: "C) Yanlış" }])).toEqual([]);
	});
});

describe("matchMarkedAnswers", () => {
	const question = (number: number, options: string[]): ParsedQuestion => ({
		number,
		stem: `${number}. soru?`,
		options,
		parseOk: true,
	});

	const q1 = question(1, ["1900", "1912", "1919", "1923"]);
	const q2 = question(2, ["Çevre", "Ulaştırma ve Altyapı Bakanlığı", "Ticaret", "İçişleri"]);

	it("harf ve metin uyuşuyorsa eşler", () => {
		const { answers, problems } = matchMarkedAnswers(
			[q1, q2],
			[
				{ letter: "B", text: "1912" },
				{ letter: "B", text: "Ulaştırma ve Altyapı Bakanlığı" },
			],
		);
		expect([...answers]).toEqual([
			[1, 1],
			[2, 1],
		]);
		expect(problems).toEqual([]);
	});

	it("harf okunamamışsa şıkkı içerikten bulur", () => {
		const { answers } = matchMarkedAnswers([q2], [{ letter: null, text: "Ulaştırma ve Altyapı" }]);
		expect([...answers]).toEqual([[2, 1]]);
	});

	it("harf metinle çelişiyorsa metne uyar — boyama harfi kaydırabilir", () => {
		const { answers } = matchMarkedAnswers([q2], [{ letter: "A", text: "Ulaştırma ve Altyapı Bakanlığı" }]);
		expect([...answers]).toEqual([[2, 1]]);
	});

	it("sahte işareti atlar ve sonraki soruları kaydırmaz", () => {
		// Sayfa numarası gibi kırmızı bir artefakt araya girdiğinde.
		const { answers } = matchMarkedAnswers(
			[q1, q2],
			[
				{ letter: null, text: "5" },
				{ letter: "B", text: "1912" },
				{ letter: "B", text: "Ulaştırma ve Altyapı Bakanlığı" },
			],
		);
		expect([...answers]).toEqual([
			[1, 1],
			[2, 1],
		]);
	});

	it("hiçbir şıkla eşleşmeyen soruyu CEVAPSIZ bırakır, tahmin etmez", () => {
		const { answers, problems } = matchMarkedAnswers([q1], [{ letter: null, text: "Bambaşka" }]);
		expect(answers.size).toBe(0);
		expect(problems[0]).toContain("#1");
	});

	it("kısa şıklarda tam eşitlik arar — 1912 ile 1919 karışmaz", () => {
		const { answers } = matchMarkedAnswers([q1], [{ letter: null, text: "1919" }]);
		expect([...answers]).toEqual([[1, 2]]);
	});

	it("satır sonu tirelemesi ve büyük/küçük harf farkını yutar", () => {
		const q = question(7, ["Aşma sahası", "Hareket sahası", "Manevra sahası", "PAT sahası"]);
		const { answers } = matchMarkedAnswers([q], [{ letter: null, text: "AŞMA SA- HASI" }]);
		expect([...answers]).toEqual([[7, 0]]);
	});

	it("işaret ve soru sayısı farklıysa uyarır ama eşleşenleri korur", () => {
		const { answers, problems } = matchMarkedAnswers([q1, q2], [{ letter: "B", text: "1912" }]);
		expect([...answers]).toEqual([[1, 1]]);
		expect(problems.some((p) => p.includes("farklı"))).toBe(true);
	});
});

describe("isNeutralColor", () => {
	it("siyah, beyaz ve grileri nötr sayar", () => {
		for (const color of ["#000000", "#ffffff", "#7f7f7f"]) expect(isNeutralColor(color)).toBe(true);
	});

	it("renkli değerleri işaret sayar", () => {
		for (const color of ["#ff0000", "#0000ff", "#008000"]) expect(isNeutralColor(color)).toBe(false);
	});

	it("tanımadığı biçimi nötr sayar — bilinmeyenden işaret üretmez", () => {
		expect(isNeutralColor("rgb(255,0,0)")).toBe(true);
	});
});
