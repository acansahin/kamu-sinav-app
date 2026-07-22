"use client";

import { useEffect } from "react";

/**
 * Service worker kaydı.
 *
 * Yol göreli verilir: uygulama kökte de (Capacitor, Vercel) alt dizinde de
 * (GitHub Pages) yayınlanabiliyor. Mutlak "/sw.js" alt dizinli yayında
 * kapsam dışına düşer ve kayıt sessizce başarısız olur.
 */
export function ServiceWorkerRegistrar() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		// Geliştirme sırasında kayıt yapılmaz: önbellek, kod değişikliklerini
		// gizleyerek hata ayıklamayı zorlaştırır.
		if (process.env.NODE_ENV !== "production") return;

		const base = document.baseURI;
		void navigator.serviceWorker
			.register(new URL("sw.js", base).href, {
				scope: new URL("./", base).href,
			})
			.catch(() => {
				// Kayıt başarısız olursa uygulama çevrimiçi olarak çalışmaya
				// devam eder; kullanıcıya gösterilecek bir şey yok.
			});
	}, []);

	return null;
}
