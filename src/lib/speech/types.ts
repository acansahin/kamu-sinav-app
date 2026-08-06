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
}

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
