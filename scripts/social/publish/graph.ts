import { env, hataMetni } from "./types";

/**
 * Meta Graph API ortak katmanı — Facebook Sayfa ve Instagram aynı API'yi
 * kullanır.
 *
 * ⚠️ **Sürüm tek ayardır ve süresi dolar.** Meta her Graph sürümünü yaklaşık
 * iki yıl yaşatır; süresi dolan sürüme yapılan çağrı bir gün aniden hata
 * vermeye başlar. Sabit yazılmasının sebebi öngörülebilirlik: sürümsüz çağrı
 * Meta'nın seçtiği en eski sürüme düşer ve davranış habersiz değişir. Hattın
 * durduğunu görürseniz bakılacak İLK yer burasıdır; `GRAPH_VERSION` ortam
 * değişkeniyle kod değiştirmeden yükseltilebilir.
 */
export const GRAPH_SURUM = env("GRAPH_VERSION") ?? "v23.0";

export function graphUrl(yol: string): string {
	return `https://graph.facebook.com/${GRAPH_SURUM}/${yol}`;
}

/**
 * Graph'a form-urlencoded POST.
 *
 * Erişim jetonu gövdeye konur, sorgu dizesine DEĞİL: sorgu dizesindeki
 * jetonlar ara sunucu ve erişim günlüklerine düşer.
 */
export async function graphPost<T>(
	yol: string,
	alanlar: Record<string, string>,
	jeton: string,
): Promise<T> {
	const govde = new URLSearchParams({ ...alanlar, access_token: jeton });
	const cevap = await fetch(graphUrl(yol), {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: govde,
	});

	if (!cevap.ok) throw new Error(await hataMetni(cevap));

	return (await cevap.json()) as T;
}

export async function graphGet<T>(
	yol: string,
	alanlar: Record<string, string>,
	jeton: string,
): Promise<T> {
	const sorgu = new URLSearchParams({ ...alanlar, access_token: jeton });
	const cevap = await fetch(`${graphUrl(yol)}?${sorgu}`, { method: "GET" });

	if (!cevap.ok) throw new Error(await hataMetni(cevap));

	return (await cevap.json()) as T;
}

export function bekle(ms: number): Promise<void> {
	return new Promise((coz) => setTimeout(coz, ms));
}
