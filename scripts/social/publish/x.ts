import { createHmac, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { PostPlani } from "../types";
import { env, eksikler, hataMetni, type Yayinci } from "./types";

/**
 * X (Twitter) yayıncısı — OAuth 1.0a ile.
 *
 * **Neden OAuth 2.0 değil:** 2.0 kullanıcı bağlamı, iki saatte bir dolan bir
 * erişim jetonu ve her yenilemede DEĞİŞEN bir yenileme jetonu verir. Cron ile
 * çalışan bir hat için bu, her koşuda GitHub sırlarını API üzerinden
 * güncellemek demektir — tek bir kaçırılmış yazma hattı kalıcı olarak kilitler.
 * OAuth 1.0a jetonları süresizdir; dört sır bir kez konur ve bir daha
 * dokunulmaz.
 *
 * İmzalama elle yapılır (bağımlılık eklenmedi): gövdesi
 * `application/x-www-form-urlencoded` OLMAYAN isteklerde imza tabanına
 * yalnızca `oauth_*` parametreleri ve sorgu dizesi girer — bu yüzden görsel
 * multipart, gönderi ise JSON olarak yollanır ve imza küçük kalır.
 */

const ANAHTARLAR = [
	"X_API_KEY",
	"X_API_SECRET",
	"X_ACCESS_TOKEN",
	"X_ACCESS_SECRET",
];

/** RFC 3986. `encodeURIComponent` `!*'()` karakterlerini kaçırmaz; imza bozulur. */
function yuzdeKacir(deger: string): string {
	return encodeURIComponent(deger).replace(
		/[!*'()]/g,
		(ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

function imzaBasligi(
	yontem: "GET" | "POST",
	url: string,
	sorguParametreleri: Record<string, string> = {},
): string {
	const oauth: Record<string, string> = {
		oauth_consumer_key: env("X_API_KEY") as string,
		oauth_nonce: randomBytes(16).toString("hex"),
		oauth_signature_method: "HMAC-SHA1",
		oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
		oauth_token: env("X_ACCESS_TOKEN") as string,
		oauth_version: "1.0",
	};

	const tum = { ...oauth, ...sorguParametreleri };
	const parametreDizesi = Object.keys(tum)
		.sort()
		.map((ad) => `${yuzdeKacir(ad)}=${yuzdeKacir(tum[ad])}`)
		.join("&");
	const taban = [
		yontem,
		yuzdeKacir(url),
		yuzdeKacir(parametreDizesi),
	].join("&");
	const anahtar = `${yuzdeKacir(env("X_API_SECRET") as string)}&${yuzdeKacir(
		env("X_ACCESS_SECRET") as string,
	)}`;

	oauth.oauth_signature = createHmac("sha1", anahtar)
		.update(taban)
		.digest("base64");

	return `OAuth ${Object.keys(oauth)
		.sort()
		.map((ad) => `${yuzdeKacir(ad)}="${yuzdeKacir(oauth[ad])}"`)
		.join(", ")}`;
}

/**
 * Görseli yükler ve `media_id` döndürür.
 *
 * X, medya yükleme uçlarını v1.1'den v2'ye taşıdı ama eski uç bir süre daha
 * yanıt verdi. Hangi hesabın hangisine eriştiği plana göre değiştiği için
 * ÖNCE v2 denenir, 404/403'te v1.1'e düşülür. Tek uca bağlanmak, bu hattın
 * X tarafındaki bir kapatmayla sessizce durması demekti.
 */
async function gorselYukle(gorselYolu: string): Promise<string> {
	const veri = await readFile(gorselYolu);
	const govde = new FormData();

	govde.append(
		"media",
		new Blob([new Uint8Array(veri)], { type: "image/jpeg" }),
		"kart.jpg",
	);
	govde.append("media_category", "tweet_image");

	const uclar = [
		"https://api.x.com/2/media/upload",
		"https://upload.twitter.com/1.1/media/upload.json",
	];
	let sonHata = "";

	for (const uc of uclar) {
		const cevap = await fetch(uc, {
			method: "POST",
			headers: { Authorization: imzaBasligi("POST", uc) },
			body: govde,
		});

		if (cevap.ok) {
			const json = (await cevap.json()) as {
				id?: string;
				media_id_string?: string;
				data?: { id?: string };
			};
			const id = json.data?.id ?? json.id ?? json.media_id_string;

			if (id) return id;

			sonHata = `Yanıtta media id yok: ${JSON.stringify(json).slice(0, 200)}`;
			continue;
		}

		sonHata = `${uc} → ${await hataMetni(cevap)}`;

		// Yetki/uç hatası değilse (ör. 400 geçersiz görsel) diğer uca düşmek
		// aynı hatayı tekrarlamaktan başka işe yaramaz.
		if (cevap.status !== 403 && cevap.status !== 404) break;
	}

	throw new Error(`Görsel yüklenemedi — ${sonHata}`);
}

/**
 * Alt metin. Başarısızlığı paylaşımı DÜŞÜRMEZ: erişilebilirlik metni
 * olmadan yayımlamak, hiç yayımlamamaktan iyidir. Yalnızca uyarı basılır.
 */
async function altMetinEkle(mediaId: string, metin: string): Promise<void> {
	const uc = "https://api.x.com/1.1/media/metadata/create.json";
	const cevap = await fetch(uc, {
		method: "POST",
		headers: {
			Authorization: imzaBasligi("POST", uc),
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			media_id: mediaId,
			alt_text: { text: metin.slice(0, 1000) },
		}),
	});

	if (!cevap.ok) {
		console.warn(`    ! X alt metni eklenemedi: ${await hataMetni(cevap)}`);
	}
}

export const xYayincisi: Yayinci = {
	platform: "x",
	yapilandirildiMi: () => eksikler(ANAHTARLAR).length === 0,
	eksikAnahtarlar: () => eksikler(ANAHTARLAR),

	async paylas(plan: PostPlani, gorselYolu: string): Promise<string> {
		const mediaId = await gorselYukle(gorselYolu);

		await altMetinEkle(mediaId, plan.altMetin);

		const uc = "https://api.x.com/2/tweets";
		const cevap = await fetch(uc, {
			method: "POST",
			headers: {
				Authorization: imzaBasligi("POST", uc),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text: plan.metinler.x,
				media: { media_ids: [mediaId] },
			}),
		});

		if (!cevap.ok) throw new Error(await hataMetni(cevap));

		const json = (await cevap.json()) as { data?: { id?: string } };

		if (!json.data?.id) {
			throw new Error(`Yanıtta gönderi kimliği yok: ${JSON.stringify(json)}`);
		}

		return json.data.id;
	},
};
