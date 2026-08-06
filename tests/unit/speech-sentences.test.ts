import { describe, expect, it } from "vitest";
import { bloklaraAyir, cumlelereBol } from "@/lib/speech/sentences";
import { BLOK_UST_SINIR, MOTOR_TAVANI } from "@/lib/speech/types";

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

/**
 * `content/subjects/etik/topics/etik-kurul-ve-mevzuat.mdx` içindeki gerçek
 * paragraf — bir kontenjan listesi ve **tek cümle**. Sınırı tek başına aştığı
 * için asla bölünmez; virgüllerinden bölmek bu listeyi altı ayrı yerde tam
 * durakla kesiyordu, oysa liste tonlamasını üreten şey tam da onun tek
 * utterance olmasıdır.
 */
const KONTENJAN_LISTESI =
	"Üyelerin kontenjanı maddede tek tek belirlenmiştir (5176 m.2): " +
	"bakanlık yapmış olanlardan 1, il belediye başkanlığı yapmış olanlardan 1, " +
	"Yargıtay–Danıştay–Sayıştay üyeliğinden emekli olanlardan 3, " +
	"müsteşarlık–büyükelçilik–valilik–düzenleyici kurul başkanlığı " +
	"görevlerinde bulunmuşlardan 3, üniversitede rektörlük veya dekanlık " +
	"yapmış öğretim üyelerinden 2, kamu kurumu niteliğindeki meslek " +
	"kuruluşlarında en üst kademe yöneticiliği yapmışlardan 1 üye.";

describe("bloklaraAyir", () => {
	it("bir bloğun cümlelerini tek parçada tutar", () => {
		const parcalar = bloklaraAyir("Kısa cümle. Bu da kısa. Üçüncüsü de öyle.");
		expect(parcalar).toHaveLength(1);
	});

	it("eşiği tek başına aşan cümleyi bölmez", () => {
		expect(KONTENJAN_LISTESI.length).toBeGreaterThan(BLOK_UST_SINIR);

		const parcalar = bloklaraAyir(KONTENJAN_LISTESI);

		expect(parcalar).toEqual([KONTENJAN_LISTESI]);
		for (const parca of parcalar) {
			expect(parca.endsWith(",")).toBe(false);
			expect(parca.endsWith(";")).toBe(false);
		}
	});

	it("üst sınırı aşan bloğu yalnızca cümle sınırından böler", () => {
		const cumle = `${"Memur ".repeat(20).trim()} sayılır.`;
		const parcalar = bloklaraAyir(`${cumle} ${cumle} ${cumle} ${cumle}`);

		expect(parcalar.length).toBeGreaterThan(1);
		for (const parca of parcalar) {
			expect(parca.endsWith("sayılır.")).toBe(true);
		}
	});

	/** Kelime sınırından bölme KALDIRILDI: cümle ortasında durak üretiyordu. */
	it("noktalama yoksa kelime sınırından bölmez", () => {
		const uzun = Array.from({ length: 60 }, () => "kelime").join(" ");
		expect(uzun.length).toBeGreaterThan(BLOK_UST_SINIR);
		expect(bloklaraAyir(uzun)).toEqual([uzun]);
	});

	/**
	 * Motor tavanı bir UX eşiği değil, Android `getMaxSpeechInputLength()`
	 * sınırıdır; yalnızca içerikte hiç görülmeyen devasa dizelerde devreye girer.
	 */
	it("motor tavanını aşan dizeyi keser", () => {
		const parcalar = bloklaraAyir("x".repeat(MOTOR_TAVANI + 500));
		expect(parcalar.length).toBeGreaterThan(1);
		for (const parca of parcalar) {
			expect(parca.length).toBeLessThanOrEqual(MOTOR_TAVANI);
		}
	});

	it("boş metinde boş dizi döner", () => {
		expect(bloklaraAyir("   ")).toEqual([]);
	});

	/** Hiçbir parça kaybolmamalı: birleştirme ve bölme metni korumalı. */
	it("metni kaybetmez", () => {
		const metin =
			"Kanun memurlar hakkında uygulanır. İşçi İş Kanunu'na tabidir. Üçüncü bir statü sözleşmeli personeldir.";
		const birlesik = bloklaraAyir(metin).join(" ");
		expect(birlesik.replace(/\s+/g, " ")).toBe(metin);
	});
});
