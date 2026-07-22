import type { MetadataRoute } from "next";

/**
 * Web uygulama manifesti.
 *
 * Tüm yollar GÖRELİdir. Manifest, yayın konumuna göre kökte ya da bir alt
 * dizinde (GitHub Pages) durabilir; göreli yollar manifestin kendi konumuna
 * göre çözülür ve her iki durumda da doğru çalışır. Mutlak "/" yolları alt
 * dizinli yayında kırılırdı.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Kamu Sınav Akademi",
		short_name: "Kamu Sınav",
		description:
			"Görevde Yükselme ve Unvan Değişikliği sınavlarına hazırlık: konu özetleri, testler ve deneme sınavları.",
		lang: "tr",
		dir: "ltr",
		start_url: "./",
		scope: "./",
		display: "standalone",
		orientation: "portrait",
		background_color: "#f7f8fa",
		theme_color: "#17395e",
		categories: ["education"],
		icons: [
			{
				src: "./icons/icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "./icons/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "./icons/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
