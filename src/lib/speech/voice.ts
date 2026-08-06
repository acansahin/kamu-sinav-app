/**
 * Cihazdaki en iyi Türkçe sesin seçimi.
 *
 * Ayrı bir modül çünkü `speech.provider.ts` eklentiyi DİNAMİK yüklüyor ve bu
 * yüzden zor test edilir; seçim mantığı `lib/` kuralına uygun olarak saf
 * tutuldu — dize ve dizi işi, hiçbir yan etki yok.
 *
 * ⚠️ **Ağ sesleri bilinçli olarak elenir.** Uygulama çevrimdışı çalışma sözü
 * veriyor ve ağ sesi kullanmak okunan metni motorun sunucusuna göndermek
 * demektir. Ayrıca bağlantı yokken sessizce başarısız olur.
 *
 * ⚠️ **`pitch` ELLENMEZ** (burada da, çağıranda da). Android'de pitch değişimi
 * motor içinde kaba bir yeniden örneklemedir; sesi daha *yapay* yapar, daha
 * gerçekçi değil — istenenin tam tersi yöne gider.
 */

/** Eklentinin `getSupportedVoices()` çıktısının ihtiyacımız olan alanları. */
export interface SesAdayi {
	lang: string;
	localService: boolean;
	voiceURI: string;
}

/**
 * En iyi Türkçe sesin ORİJİNAL dizideki indeksi.
 *
 * Dönen değer doğrudan `speak({ voice })` alanına gider ve eklenti onu kendi
 * ses listesinde indeksler; **filtrelenmiş dizinin indeksini döndürmek** sessizce
 * yanlış (çoğunlukla İngilizce) sesi seçtirirdi. Bu, buradaki en olası hata ve
 * testle kilitlenmiştir.
 *
 * Aday sayısı ikiden azsa `null` döner: tek ses varsa seçim hiçbir şeyi
 * değiştirmez, üstelik `voice` gönderilmediğinde eklenti `setVoice()`'u HİÇ
 * çağırmaz (`getInt("voice", -1)`), yani her `speak()`te bir tam sıralama
 * yükünden de kurtuluruz.
 */
export function enIyiTurkceSes(sesler: readonly SesAdayi[]): number | null {
	const adaylar = sesler
		.map((ses, indeks) => ({ ses, indeks }))
		.filter(({ ses }) => uygunMu(ses));

	if (adaylar.length < 2) return null;

	/*
	 * Sıralama ölçütleri eklentinin kendi liste sırasından BAĞIMSIZ olmak
	 * zorunda: aynı cihazda iki çalıştırma arasında sıra değişirse kullanıcı
	 * konudan konuya farklı ses duyar. Eşitlik `voiceURI` alfabetiğiyle
	 * kırılıyor, yani sonuç deterministik.
	 */
	const siralanmis = [...adaylar].sort((a, b) => {
		const fark =
			puan(b.ses) - puan(a.ses) ||
			a.ses.voiceURI.localeCompare(b.ses.voiceURI, "tr");
		return fark;
	});

	return siralanmis[0].indeks;
}

function uygunMu(ses: SesAdayi): boolean {
	// `toLowerCase()` YOK (AGENTS.md Türkçe tuzağı); `i` bayrağı yeterli.
	if (!/^tr\b/i.test(ses.lang)) return false;
	if (ses.localService !== true) return false;
	/*
	 * Bazı motorlar ağ sesini `localService: true` diye bildiriyor; `voiceURI`
	 * içindeki "network" ibaresi ikinci ve daha güvenilir işaret.
	 */
	if (/network/i.test(ses.voiceURI)) return false;
	return true;
}

/** Büyük puan önce gelir. */
function puan(ses: SesAdayi): number {
	let deger = 0;
	// Tam bölge etiketi, düz "tr"ye tercih edilir.
	if (ses.lang === "tr-TR") deger += 4;
	// Google TTS yerel ses paketlerini "-local" ile bitiriyor.
	if (/-local$/i.test(ses.voiceURI)) deger += 2;
	// "-x-" varyant işareti taşıyan sesler genelde daha yeni ve daha doğal.
	if (ses.voiceURI.includes("-x-")) deger += 1;
	return deger;
}
