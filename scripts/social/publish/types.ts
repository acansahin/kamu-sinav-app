import type { Platform, PostPlani } from "../types";

/**
 * Yayıncı sözleşmesi.
 *
 * Üç platform da aynı arayüzü uygular; `run.ts` hangisinin yapılandırıldığını
 * bilmez, sorar. Anahtarı olmayan platform sessizce ATLANIR — hata değil:
 * hesap özelliğinin Supabase anahtarı yokken kendiliğinden yerel sağlayıcıya
 * düşmesiyle aynı kural. Tek bir platformla başlamak, üçünü birden kurmayı
 * beklemekten iyidir.
 */
export type Yayinci = {
	platform: Platform;
	/** Gereken ortam değişkenleri var mı? */
	yapilandirildiMi(): boolean;
	/** Eksik olan değişkenlerin adları — günlüğe basmak için. */
	eksikAnahtarlar(): string[];
	/** Paylaşır ve platformun gönderi kimliğini döndürür. */
	paylas(plan: PostPlani, gorselYolu: string): Promise<string>;
};

/** Ortamdan okur; boş dize yok sayılır (GitHub Actions tanımsız sırrı boş geçer). */
export function env(ad: string): string | undefined {
	const deger = process.env[ad];

	return deger && deger.trim() !== "" ? deger.trim() : undefined;
}

export function eksikler(adlar: string[]): string[] {
	return adlar.filter((ad) => !env(ad));
}

/**
 * Hata gövdesini okunabilir hâle getirir.
 *
 * Platform hataları JSON'dur ve asıl sebep iç içe alanlarda saklıdır; ham
 * `response.statusText` ("Bad Request") hiçbir şey söylemez. Gövde ledger'a
 * yazıldığı için sonradan teşhis edilebilir olması gerekiyor.
 */
export async function hataMetni(cevap: Response): Promise<string> {
	const govde = await cevap.text().catch(() => "");

	return `HTTP ${cevap.status} · ${govde.slice(0, 400)}`;
}
