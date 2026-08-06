"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FontScale, SpeechRate, ThemeChoice } from "@/types/progress";

/**
 * Görsel tercihler.
 *
 * Bunlar bilinçli olarak Dexie'de DEĞİL, localStorage'da tutulur: tema ve yazı
 * boyutunun ilk boyamadan ÖNCE senkron okunabilmesi gerekir, IndexedDB ise
 * asenkrondur. Aksi hâlde her açılışta tema sıçraması olur.
 *
 * `PreferencesScript` bileşeni aynı anahtarı <head> içinde okur; anahtar veya
 * şekil değişirse orayı da güncelleyin.
 */

export const PREFERENCES_STORAGE_KEY = "kamu-sinav-prefs";

interface PreferencesState {
	theme: ThemeChoice;
	fontScale: FontScale;
	highContrast: boolean;
	/**
	 * Konu özetlerinin sesli okunma hızı.
	 *
	 * Diğer üçünden farklı olarak `<html>` niteliklerine YANSIMAZ ve ilk
	 * boyamadan önce okunması gerekmez; `preferences-script.tsx` bu yüzden
	 * dokunulmadan kaldı (orada da not düşüldü).
	 *
	 * Kalıcı kayıtta bu alanı taşımayan eski tarayıcılar varsayılana düşer:
	 * zustand `persist`in varsayılan birleştirmesi sığdır ve eksik alanlar
	 * başlangıç değerini korur — göç gerekmez.
	 */
	speechRate: SpeechRate;
	setTheme: (theme: ThemeChoice) => void;
	setFontScale: (fontScale: FontScale) => void;
	setHighContrast: (highContrast: boolean) => void;
	setSpeechRate: (speechRate: SpeechRate) => void;
}

export const usePreferences = create<PreferencesState>()(
	persist(
		(set) => ({
			theme: "sistem",
			fontScale: "normal",
			highContrast: false,
			speechRate: "normal",
			setTheme: (theme) => set({ theme }),
			setFontScale: (fontScale) => set({ fontScale }),
			setHighContrast: (highContrast) => set({ highContrast }),
			setSpeechRate: (speechRate) => set({ speechRate }),
		}),
		{ name: PREFERENCES_STORAGE_KEY },
	),
);

/** Tercihleri <html> üzerindeki data-* niteliklerine yansıtır. */
export function useApplyPreferences(): void {
	const theme = usePreferences((s) => s.theme);
	const fontScale = usePreferences((s) => s.fontScale);
	const highContrast = usePreferences((s) => s.highContrast);

	useEffect(() => {
		const root = document.documentElement;

		if (theme === "sistem") root.removeAttribute("data-theme");
		else root.setAttribute("data-theme", theme);

		if (fontScale === "normal") root.removeAttribute("data-font-scale");
		else root.setAttribute("data-font-scale", fontScale);

		if (highContrast) root.setAttribute("data-contrast", "yuksek");
		else root.removeAttribute("data-contrast");
	}, [theme, fontScale, highContrast]);

	useSystemBarsStyle(theme);
}

/**
 * Durum ve jest çubuğu ikonlarını uygulama temasına bağlar. Yalnızca Android
 * paketinde iş görür; tarayıcıda sessizce hiçbir şey yapmaz.
 *
 * Capacitor'ın varsayılanı CİHAZIN gece modunu okur, uygulamanınkini değil.
 * Kullanıcı açık moddaki bir telefonda uygulamayı "Koyu"ya alırsa koyu başlığın
 * üstünde koyu ikonlar çıkar ve okunmaz hâle gelir — edge-to-edge'e geçtikten
 * sonra çubuğun arkasını artık uygulama boyadığı için bu gerçek bir kontrast
 * ihlalidir.
 */
function useSystemBarsStyle(theme: ThemeChoice): void {
	useEffect(() => {
		let cancelled = false;
		const koyuSorgu = window.matchMedia("(prefers-color-scheme: dark)");

		async function uygula(): Promise<void> {
			/*
			 * Dinamik yükleme bilinçli: statik içe aktarım @capacitor/core'u web
			 * yayınının ortak paketine sokar (bkz. lib/auth/supabase-client.ts).
			 */
			const { Capacitor, SystemBars, SystemBarsStyle } =
				await import("@capacitor/core");

			// Web implementasyonu `unavailable` fırlatır; native değilse hiç çağırma.
			if (cancelled || !Capacitor.isNativePlatform()) return;

			const koyu = theme === "koyu" || (theme === "sistem" && koyuSorgu.matches);

			/*
			 * Enum adı ZEMİNİ anlatır, ikonu değil: `Dark` = koyu zemin üzerinde
			 * açık ikon. Uygulama teması koyuyken istediğimiz budur.
			 */
			await SystemBars.setStyle({
				style: koyu ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
			});
		}

		const calistir = (): void => {
			// Çubuk stili tamamen kozmetik: başarısız olursa kullanıcıya
			// gösterilecek bir şey yok, uygulama çalışmaya devam eder.
			void uygula().catch(() => {});
		};

		calistir();

		// "Sistem" seçiliyken cihazın teması sonradan da değişebilir.
		if (theme !== "sistem") {
			return () => {
				cancelled = true;
			};
		}

		koyuSorgu.addEventListener("change", calistir);
		return () => {
			cancelled = true;
			koyuSorgu.removeEventListener("change", calistir);
		};
	}, [theme]);
}

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
	normal: "Normal",
	buyuk: "Büyük",
	"cok-buyuk": "Çok büyük",
};

export const THEME_LABELS: Record<ThemeChoice, string> = {
	sistem: "Sistem",
	acik: "Açık",
	koyu: "Koyu",
};

export const SPEECH_RATE_LABELS: Record<SpeechRate, string> = {
	yavas: "Yavaş",
	normal: "Normal",
	hizli: "Hızlı",
};
