import type { NextConfig } from "next";

/**
 * SERT KISIT: çıktı tam statik olmak zorundadır.
 *
 * Sebep: uygulama Capacitor ile Android'e paketlenecek ve Capacitor bir WebView'e
 * statik dosya yükler — arkasında Node sunucusu yoktur. Aynı çıktı web tarafında
 * da ücretsiz statik hosting'e gider.
 *
 * Bunun sonuçları — ihlal edilirse Android paketi bozulur:
 *   - Server Actions, Route Handler (app/api), middleware, ISR KULLANILAMAZ.
 *   - Her dinamik rota `generateStaticParams` ile tam olarak sayılmalıdır.
 *   - Görsel optimizasyonu sunucu gerektirdiği için kapalıdır.
 *   - Build sırasında ağ bağımlılığı olmamalıdır (ör. next/font/google yerine
 *     sistem font yığını kullanılır).
 *
 * Sunucu gerektiren işler (Faz 3 kimlik doğrulama, Faz 5 içerik üretimi) uygulama
 * içinde değil; istemci SDK'sı ya da repo içindeki ayrı araçlar üzerinden çözülür.
 */
const nextConfig: NextConfig = {
	output: "export",
	// Statik sunucularda ve WebView'de klasör bazlı yönlendirme daha güvenilir
	trailingSlash: true,
	images: { unoptimized: true },
	typedRoutes: true,
};

export default nextConfig;
