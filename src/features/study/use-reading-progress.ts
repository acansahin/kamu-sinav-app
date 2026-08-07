"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Okuma oranı ve "sona varıldı mı" gözlemi.
 *
 * İki ayrı mekanizma bilinçli olarak ayrı: oran her kaydırmada değişen sürekli
 * bir değer (rAF ile kısılmış tek dinleyici), sona varış ise bir kez olan ayrık
 * bir olay (`IntersectionObserver`). Oranı eşiğe vurup "sona varıldı" demek,
 * kısa özetlerde sayfa hiç kaydırılmadan tetiklenirdi.
 */

/**
 * Nirengi kaç ms görünür kalırsa "okundu" sayılır.
 *
 * Bekleme ZORUNLU: sona atlayıp hemen geri dönen bir kaydırma (kullanıcı
 * testin nerede olduğuna bakıyor) işaretlemeyi tetiklememeli.
 */
const OKUNDU_BEKLEME_MS = 2000;

export function useReadingProgress(kokRef: RefObject<HTMLElement | null>): number {
	const [oran, setOran] = useState(0);

	useEffect(() => {
		const kok = kokRef.current;
		if (!kok) return;

		let bekleyen = 0;

		function hesapla(): void {
			bekleyen = 0;
			const el = kokRef.current;
			if (!el) return;

			const ust = el.offsetTop;
			// Okunacak mesafe: gövdenin ekrana sığmayan kısmı. Gövde ekrandan
			// kısaysa okunacak bir şey yok, oran doğrudan tamdır.
			const mesafe = el.offsetHeight - window.innerHeight;
			if (mesafe <= 0) {
				setOran(1);
				return;
			}

			const gecilen = window.scrollY - ust;
			setOran(Math.min(1, Math.max(0, gecilen / mesafe)));
		}

		function kaydirildi(): void {
			// rAF ile kısma: kaydırma olayı saniyede onlarca kez tetiklenir ve
			// `offsetHeight` okuması düzen hesabı zorlar; kısılmazsa kaydırma
			// takılmalı görünür.
			if (bekleyen !== 0) return;
			bekleyen = requestAnimationFrame(hesapla);
		}

		hesapla();
		window.addEventListener("scroll", kaydirildi, { passive: true });
		window.addEventListener("resize", kaydirildi, { passive: true });

		return () => {
			if (bekleyen !== 0) cancelAnimationFrame(bekleyen);
			window.removeEventListener("scroll", kaydirildi);
			window.removeEventListener("resize", kaydirildi);
		};
	}, [kokRef]);

	return oran;
}

/**
 * Nirengi yeterince uzun görünür kalınca `geldi`yi bir kez çağırır.
 *
 * @param etkin Gözlemcinin kurulup kurulmayacağı. Konu zaten okunmuşsa `false`
 *   geçilir; kapalıyken hiçbir gözlemci kurulmaz.
 */
export function useReachedEnd(
	nirengiRef: RefObject<HTMLElement | null>,
	etkin: boolean,
	geldi: () => void,
): void {
	useEffect(() => {
		const nirengi = nirengiRef.current;
		if (!etkin || !nirengi) return;

		let sayac: ReturnType<typeof setTimeout> | null = null;

		const gozlemci = new IntersectionObserver((girisler) => {
			const gorunur = girisler.some((g) => g.isIntersecting);

			if (gorunur) {
				sayac ??= setTimeout(() => {
					gozlemci.disconnect();
					geldi();
				}, OKUNDU_BEKLEME_MS);
				return;
			}

			// Görünürlük kesildi: sayaç sıfırlanır, ekranda kalma süresi
			// birikmez. Yoksa üç kez uğrayıp giden kaydırma da eşiği doldururdu.
			if (sayac !== null) {
				clearTimeout(sayac);
				sayac = null;
			}
		});

		gozlemci.observe(nirengi);

		return () => {
			if (sayac !== null) clearTimeout(sayac);
			gozlemci.disconnect();
		};
	}, [nirengiRef, etkin, geldi]);
}
