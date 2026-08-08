import type { SpeechRate } from "@/types/progress";

/**
 * Sesli okumanın veri şekilleri.
 *
 * Model TEK kademelidir: **parça = blok**. Bir parça hem ekranda vurgulanan DOM
 * elemanının (paragraf, liste öğesi, tablo satırı, vurgu kutusu, başlık) tamamı,
 * hem de tek bir `speak()` çağrısının birimidir.
 *
 * Önceki sürüm bloğu cümlelere bölüyordu ve bu tonlamayı bozuyordu: eklentinin
 * Android tarafı her `speak()` çağrısında motoru önce DURDURUP baştan
 * yapılandırıyor (`TextToSpeech.java`: `stop()` + `setLanguage` + `setSpeechRate`).
 * Cümle cümle çağırmak bir özette ~120 kez durdur-yapılandır döngüsü demekti:
 * cümleler arası boşluk ve her cümlede prosodi sıfırlaması. Bedeli, "Devam et"in
 * cümleyi değil paragrafı baştan okumasıdır — kabul edildi.
 */
export interface SpeechChunk {
	/** Motora verilecek, normalleştirilmiş metin. */
	text: string;
	/** Bu parça okunurken vurgulanacak eleman. */
	el: HTMLElement;
	/**
	 * Bu parçadan SONRA sessizlik bekletilsin mi? Tirenin bıraktığı duraklama.
	 * Bkz. `DURAK_SURESI_MS`.
	 */
	duraklat?: boolean;
}

/**
 * Tireden sonra beklenecek sessizlik (ms).
 *
 * ⚠️ **Duraklama motordan ALINAMIYOR; burada üretiliyor.** Cihazda sırayla üç
 * yol denendi ve üçü de duyulmadı:
 *   1. Virgül — motor cümle içi noktalamayı prosodiye çevirmiyor.
 *   2. Noktalı virgül — aynı sonuç.
 *   3. Ayrı `speak()` çağrısı — bu eklenti sürümünde kuyruk KESİNTİSİZ
 *      işleniyor, çağrılar arasında duyulur bir boşluk kalmıyor.
 *
 * (3) özellikle yanıltıcıydı: bu dosyanın eski notu "her `speak()` motoru
 * durdurup baştan yapılandırır, arada boşluk kalır" diyordu ve o varsayıma
 * dayanıldı. Paketteki JS incelenip bölmenin gerçekten çalıştığı doğrulandı,
 * yani varsayımın kendisi yanlıştı.
 *
 * Bu yüzden sessizlik okuma döngüsünde AÇIKÇA bekleniyor
 * (`use-speech-reader.ts`). Motorun davranışından bağımsız, dolayısıyla
 * güvenilir. Süre virgül hissi verecek kadar; tam durak kadar uzun değil.
 */
export const DURAK_SURESI_MS = 280;

/**
 * Bir bloğun hedeflenen üst karakter sınırı.
 *
 * Bu bir UX sınırıdır: aşan blok cümle sınırından paketlenerek bölünür ve
 * "Devam et"in tekrar okuyacağı en kötü hâli sınırlar (400 karakter ≈ 30 sn).
 * Ölçüldü: 191 düz paragrafın 187'si bunun altında, ortalama 183 karakter.
 *
 * ⚠️ **`MOTOR_TAVANI` ile karıştırmayın.** O bir cümle bölme eşiği DEĞİL, motorun
 * kendi girdisi sınırıdır (Android `getMaxSpeechInputLength()` = 4000) ve
 * yalnızca doğal bir sınır bulunamadığında, kelime boşluğundan uygulanır.
 */
export const BLOK_UST_SINIR = 400;
export const MOTOR_TAVANI = 3500;

/**
 * Parça sınırı işareti — tirenin bıraktığı duraklamayı üretir.
 *
 * ⚠️ **Noktalama bu iş için ÇALIŞMIYOR.** Cihazda sırayla virgül ve noktalı
 * virgül denendi; motor cümle içi noktalamayı duyulur bir duraklamaya
 * çevirmiyor. Metnin `speak()`e olduğu gibi ulaştığı doğrulandı, yani sorun
 * dönüşümde değil motorun prosodisinde.
 *
 * Bu motorda duraklama üreten TEK güvenilir mekanizma, yukarıda "sorun" olarak
 * anlatılan şeyin kendisidir: ayrı bir `speak()` çağrısı motoru durdurup baştan
 * yapılandırır ve arada duyulur bir boşluk kalır. Cümle başına yapıldığında
 * (~120 kez) okumayı kesikleştiren buydu; tirede yapıldığında istenen tam
 * olarak bu.
 *
 * Ölçek farkı kritiktir ve bu kuralı güvenli kılan şeydir. Ölçüldü: 30 özetin
 * tamamında 159 durak, yani **özet başına ortalama 5,3** (en kötü hâl
 * `mahalli-idareler` ile 14; iki özette hiç yok). Kesik okumaya yol açan ~120
 * ile kıyaslanamaz. Yeni içerik bu sayıyı belirgin biçimde büyütürse kural
 * yeniden ölçülmelidir.
 *
 * Kontrol karakteri seçildi: içerikte asla geçemez. Motora ASLA ulaşmaz —
 * `duraklardanBol` parçalara ayırırken tüketir.
 */
export const DURAK_ISARETI = "\u0001";

/**
 * Hız kademelerinin motor karşılıkları.
 *
 * Uçlar bilinçli olarak kullanılmıyor: ölçüldüğünde 0.5 Android'de sarhoş gibi
 * duyuluyor, 2.0 ise Türkçe hukuk metninde anlaşılmaz hâle geliyor (uzun
 * bileşik sözcükler ve ek yığınları). 0.8/1.0/1.3 duyulur biçimde farklı ve
 * üçü de anlaşılır.
 */
export const HIZ_DEGERLERI: Record<SpeechRate, number> = {
	yavas: 0.8,
	normal: 1.0,
	hizli: 1.3,
};
