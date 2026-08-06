import type { SpeechRate } from "@/types/progress";

/**
 * Sesli okumanın veri şekilleri.
 *
 * İki kademeli bir model var ve ikisi bilinçli olarak AYRI:
 *
 *   - **Blok**: ekranda vurgulanan DOM elemanı (paragraf, liste öğesi, tablo
 *     satırı, vurgu kutusu, başlık).
 *   - **Parça** (`SpeechChunk`): `speak()` çağrısının birimi — blok içindeki
 *     bir cümle.
 *
 * Tek bir birim iki ihtiyacı birden karşılayamazdı: vurgulama için doğal birim
 * blok, duraklatma çözünürlüğü için doğal birim cümledir. Bir paragrafı tek
 * parça yapmak "Devam et"in koca bir paragrafı baştan okuması demekti.
 */
export interface SpeechChunk {
	/** Motora verilecek, normalleştirilmiş metin. */
	text: string;
	/** Bu parça okunurken vurgulanacak eleman. */
	el: HTMLElement;
	/**
	 * Parçanın ait olduğu blok sırası.
	 *
	 * Kaydırma yalnızca bu değer DEĞİŞTİĞİNDE yapılır; aynı paragrafın üçüncü
	 * cümlesinde sayfa tekrar kaydırılmaz.
	 */
	blockIndex: number;
}

/**
 * Bir parçanın hedeflenen karakter aralığı.
 *
 * Alt sınır: çok kısa parçalar arasında Capacitor köprüsünün gidiş-dönüşü
 * duyulabilir bir boşluk üretir; kısa cümleler bu yüzden birleştirilir.
 *
 * Üst sınır UX'tir, motor sınırı DEĞİL: Android'in `getMaxSpeechInputLength()`
 * değeri 4000 karakterdir ve içerikteki en uzun paragraf bunun onda biri.
 * Sınırı belirleyen şey "Devam et"in ne kadarını tekrar okuyacağıdır.
 */
export const PARCA_ALT_SINIR = 45;
export const PARCA_UST_SINIR = 200;
/** Bölünecek doğal nokta bulunamazsa uygulanan mutlak tavan. */
export const PARCA_MUTLAK_TAVAN = 300;

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
