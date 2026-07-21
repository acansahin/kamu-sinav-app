"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FontScale, ThemeChoice } from "@/types/progress";

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
	setTheme: (theme: ThemeChoice) => void;
	setFontScale: (fontScale: FontScale) => void;
	setHighContrast: (highContrast: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
	persist(
		(set) => ({
			theme: "sistem",
			fontScale: "normal",
			highContrast: false,
			setTheme: (theme) => set({ theme }),
			setFontScale: (fontScale) => set({ fontScale }),
			setHighContrast: (highContrast) => set({ highContrast }),
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
