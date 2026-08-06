import { describe, expect, it } from "vitest";
import { type SesAdayi, enIyiTurkceSes } from "@/lib/speech/voice";

/**
 * Türkçe ses seçimi.
 *
 * Bu modülün tek çıktısı bir İNDEKStir ve yanlış indeks sessiz bir hatadır:
 * okuma çalışır, yalnızca Türkçe metin İngilizce sesle okunur. Testlerin çoğu
 * bu yüzden indeksin kendisine bakıyor.
 */

function ses(kismi: Partial<SesAdayi>): SesAdayi {
	return {
		lang: "tr-TR",
		localService: true,
		voiceURI: "tr-tr-x-tra-local",
		...kismi,
	};
}

describe("eleme", () => {
	it("Türkçe olmayan sesleri saymaz", () => {
		const sesler = [
			ses({ lang: "en-US", voiceURI: "en-us-x-sfg-local" }),
			ses({ lang: "de-DE", voiceURI: "de-de-x-deb-local" }),
			ses({ voiceURI: "tr-tr-x-tra-local" }),
		];
		// Geriye tek Türkçe aday kalır → seçim bir şey değiştirmez.
		expect(enIyiTurkceSes(sesler)).toBeNull();
	});

	it("ağ seslerini eler — çevrimdışı vaadi ve gizlilik", () => {
		const sesler = [
			ses({ localService: false, voiceURI: "tr-tr-x-net-a" }),
			ses({ voiceURI: "tr-tr-x-tra-network" }),
			ses({ voiceURI: "tr-tr-x-tra-local" }),
		];
		expect(enIyiTurkceSes(sesler)).toBeNull();
	});

	it("hiç Türkçe ses yoksa null döner", () => {
		expect(enIyiTurkceSes([ses({ lang: "en-US" })])).toBeNull();
	});

	it("boş listede null döner", () => {
		expect(enIyiTurkceSes([])).toBeNull();
	});

	/**
	 * Tek adayda seçim hiçbir şeyi değiştirmez; üstelik `voice` gönderilmediğinde
	 * eklenti `setVoice()`'u hiç çağırmaz ve her `speak()`te bir sıralama
	 * yükünden kurtuluruz.
	 */
	it("tek yerel Türkçe seste null döner", () => {
		expect(enIyiTurkceSes([ses({})])).toBeNull();
	});
});

describe("seçim", () => {
	/**
	 * BURADAKİ EN OLASI HATA: filtrelenmiş dizinin indeksini döndürmek. Araya
	 * İngilizce sesler konarak iki indeks bilinçli olarak ayrıştırıldı — bu
	 * hatayı başka hiçbir test yakalayamaz.
	 */
	it("ORİJİNAL dizideki indeksi döndürür", () => {
		const sesler = [
			ses({ lang: "en-US", voiceURI: "en-us-x-sfg-local" }),
			ses({ lang: "en-GB", voiceURI: "en-gb-x-gba-local" }),
			ses({ lang: "tr", voiceURI: "tr-tr-x-tra-network" }),
			ses({ lang: "tr", voiceURI: "tr-tr-b-local" }),
			ses({ lang: "tr-TR", voiceURI: "tr-tr-x-tra-local" }),
		];

		expect(enIyiTurkceSes(sesler)).toBe(4);
	});

	it("tam bölge etiketini düz 'tr'ye tercih eder", () => {
		const sesler = [
			ses({ lang: "tr", voiceURI: "tr-a-local" }),
			ses({ lang: "tr-TR", voiceURI: "tr-b-local" }),
		];
		expect(enIyiTurkceSes(sesler)).toBe(1);
	});

	/** Sonuç, giriş sırasından bağımsız olmalı: aynı cihaz her zaman aynı ses. */
	it("giriş sırası değişse de aynı sesi seçer", () => {
		const iyi = ses({ lang: "tr-TR", voiceURI: "tr-tr-x-tra-local" });
		const zayif = ses({ lang: "tr", voiceURI: "tr-tr-a" });

		expect(enIyiTurkceSes([zayif, iyi])).toBe(1);
		expect(enIyiTurkceSes([iyi, zayif])).toBe(0);
	});

	/** Eşit puanda `voiceURI` alfabetiği karar verir — deterministik. */
	it("eşit puanda alfabetik olarak ilkini seçer", () => {
		const sesler = [
			ses({ voiceURI: "tr-tr-x-tzz-local" }),
			ses({ voiceURI: "tr-tr-x-taa-local" }),
		];
		expect(enIyiTurkceSes(sesler)).toBe(1);
	});
});
