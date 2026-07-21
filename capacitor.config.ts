import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android paketleme yapılandırması.
 *
 * `webDir` Next.js'in statik export çıktısını gösterir. Bu yüzden APK üretmeden
 * önce mutlaka `npm run build` çalışmış ve `out/` oluşmuş olmalıdır —
 * `npm run android:sync` bunu sırayla yapar.
 *
 * `appId` bir Java paket adı olduğu için küçük harf ve nokta dışında karakter
 * içeremez; tire veya Türkçe karakter kullanılamaz.
 */
const config: CapacitorConfig = {
	appId: "tr.kamusinavakademi.app",
	appName: "Kamu Sınav Akademi",
	webDir: "out",
	android: {
		// Uygulama tamamen çevrimdışı çalışır; düz metin ağ trafiğine gerek yok.
		allowMixedContent: false,
	},
};

export default config;
