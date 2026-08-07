"use client";

import { useEffect, useRef } from "react";

/**
 * Anahtar değiştiğinde sayfayı başa alır.
 *
 * Soru koşucularının tamamı (konu testi, deneme sınavı, tekrar oturumu) tek bir
 * sayfada soruyu YERİNDE değiştiriyor. Uzun bir soruda aşağı kaydırıp "Sonraki"ye
 * basan kullanıcıda kaydırma konumu olduğu yerde kalıyor ve yeni soru ekranın
 * üstünde, görünmez bir yerde başlıyordu — cihazda bildirilen hata buydu.
 *
 * Kaydırma ANİDİR, yumuşak değil. Bu bir içerik DEĞİŞİMİ, aynı içerik içinde
 * hareket değil; yumuşak kaydırma araya giren metinleri akıtır ve yeni sorunun
 * görünmesini geciktirir. Ayrıca hareket duyarlılığı olan kullanıcıda zaten ani
 * olmak zorundaydı, iki ayrı davranış tutmanın karşılığı yok.
 *
 * İlk render'da hiç kaydırma yapılmaz: sayfa zaten tepededir ve yarıda kalmış
 * bir oturum geri yüklendiğinde kullanıcının konumunu bozmak istemeyiz.
 */
export function useScrollToTop(anahtar: unknown): void {
	const ilkRender = useRef(true);

	useEffect(() => {
		if (ilkRender.current) {
			ilkRender.current = false;
			return;
		}

		// Kaydırma kozmetiktir; desteklenmediği ortamlarda (eski WebView, test)
		// akışı fırlatarak kesmemeli.
		try {
			window.scrollTo({ top: 0, behavior: "auto" });
		} catch {
			/* kaydırma yok — soru yine değişti */
		}
	}, [anahtar]);
}
