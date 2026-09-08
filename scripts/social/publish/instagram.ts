import type { PostPlani } from "../types";
import { bekle, graphGet, graphPost } from "./graph";
import { env, eksikler, type Yayinci } from "./types";

/**
 * Instagram yayıncısı.
 *
 * Üç kısıt bu dosyanın biçimini belirliyor:
 *
 * 1. **İkili yükleme YOK.** Görsel herkese açık bir HTTPS adresinden Meta
 *    tarafından ÇEKİLİR. Bu yüzden hat iki aşamalıdır ve görsel paylaşımdan
 *    önce yayımlanmış olmak zorundadır.
 * 2. **Yalnızca JPEG.** PNG gönderildiğinde container oluşuyor ama yayımlama
 *    adımı sebebi söylemeyen bir hatayla düşüyor (bkz. `config.ts`).
 * 3. **İki adım.** Önce container (`/media`), sonra yayımlama
 *    (`/media_publish`). Arada Meta görseli indirip işler; hazır olmadan
 *    yayımlamak `MEDIA_NOT_READY` verir. Bu yüzden durum yoklanır.
 *
 * Hesap **Business veya Creator** olmalı ve bir Facebook Sayfasına bağlı
 * olmalıdır; kişisel hesapta bu API hiç çalışmaz.
 */

const ANAHTARLAR = ["IG_USER_ID", "IG_TOKEN"];

/** Container'ın hazır olması için beklenecek en uzun süre. */
const YOKLAMA_ADIMI_MS = 4000;
const YOKLAMA_TAVANI = 15;

async function containerHazirMi(
	containerId: string,
	jeton: string,
): Promise<void> {
	for (let deneme = 0; deneme < YOKLAMA_TAVANI; deneme += 1) {
		const durum = await graphGet<{ status_code?: string; status?: string }>(
			containerId,
			{ fields: "status_code,status" },
			jeton,
		);

		if (durum.status_code === "FINISHED") return;

		if (durum.status_code === "ERROR" || durum.status_code === "EXPIRED") {
			throw new Error(
				`Container işlenemedi (${durum.status_code}): ${durum.status ?? ""}`,
			);
		}

		await bekle(YOKLAMA_ADIMI_MS);
	}

	throw new Error(
		`Container ${(YOKLAMA_ADIMI_MS * YOKLAMA_TAVANI) / 1000} saniyede hazır olmadı`,
	);
}

export const instagramYayincisi: Yayinci = {
	platform: "instagram",
	yapilandirildiMi: () => eksikler(ANAHTARLAR).length === 0,
	eksikAnahtarlar: () => eksikler(ANAHTARLAR),

	async paylas(plan: PostPlani): Promise<string> {
		const jeton = env("IG_TOKEN") as string;
		const kullanici = env("IG_USER_ID") as string;

		const container = await graphPost<{ id?: string }>(
			`${kullanici}/media`,
			{
				image_url: plan.gorselUrl,
				caption: plan.metinler.instagram,
				alt_text: plan.altMetin,
			},
			jeton,
		);

		if (!container.id) {
			throw new Error(
				`Container oluşturulamadı: ${JSON.stringify(container)}`,
			);
		}

		await containerHazirMi(container.id, jeton);

		const yayin = await graphPost<{ id?: string }>(
			`${kullanici}/media_publish`,
			{ creation_id: container.id },
			jeton,
		);

		if (!yayin.id) {
			throw new Error(`Yayımlanamadı: ${JSON.stringify(yayin)}`);
		}

		return yayin.id;
	},
};
