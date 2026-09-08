import type { PostPlani } from "../types";
import { graphPost } from "./graph";
import { env, eksikler, type Yayinci } from "./types";

/**
 * Facebook Sayfa yayıncısı.
 *
 * Görsel ikili olarak yüklenmez, `url` alanıyla verilir: aynı adresi
 * Instagram da kullanıyor (o zaten ikili kabul etmiyor) ve tek bir kaynaktan
 * beslenmek iki platformun farklı görsel yayımlaması riskini ortadan
 * kaldırıyor. Bunun bedeli sıra kısıtı — görsel önce `social-assets` dalına
 * itilmiş olmalı.
 *
 * **Jeton, kullanıcı jetonu DEĞİL Sayfa jetonudur.** Kullanıcı jetonundan
 * türetilen Sayfa jetonları (uzun ömürlü kullanıcı jetonundan alındığında)
 * süresizdir; kısa ömürlüden alınırsa bir saatte ölür ve hata ancak ertesi
 * gün cron çalışınca görülür. Kurulum adımları `store/social-kurulum.md`de.
 */

const ANAHTARLAR = ["FB_PAGE_ID", "FB_PAGE_TOKEN"];

export const facebookYayincisi: Yayinci = {
	platform: "facebook",
	yapilandirildiMi: () => eksikler(ANAHTARLAR).length === 0,
	eksikAnahtarlar: () => eksikler(ANAHTARLAR),

	async paylas(plan: PostPlani): Promise<string> {
		const sonuc = await graphPost<{ id?: string; post_id?: string }>(
			`${env("FB_PAGE_ID")}/photos`,
			{
				url: plan.gorselUrl,
				message: plan.metinler.facebook,
				alt_text_custom: plan.altMetin,
				published: "true",
			},
			env("FB_PAGE_TOKEN") as string,
		);

		// `post_id` akıştaki gönderi, `id` fotoğrafın kendisi. Denetimde işe
		// yarayan gönderidir; yoksa fotoğraf kimliğine düşülür.
		const kimlik = sonuc.post_id ?? sonuc.id;

		if (!kimlik) {
			throw new Error(`Yanıtta gönderi kimliği yok: ${JSON.stringify(sonuc)}`);
		}

		return kimlik;
	},
};
