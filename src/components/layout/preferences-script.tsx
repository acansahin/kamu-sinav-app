import { PREFERENCES_STORAGE_KEY } from "@/lib/stores/preferences";

/**
 * Tercihleri ilk boyamadan önce uygular.
 *
 * React hidratasyonu beklenirse kullanıcı bir kare boyunca yanlış temayı ve
 * yanlış yazı boyutunu görür. Bu betik <head> içinde senkron çalışır ve o
 * sıçramayı engeller.
 *
 * localStorage anahtarı ve veri şekli `lib/stores/preferences.ts` ile aynı
 * olmak zorundadır — Zustand persist `{ state: {...}, version: n }` yazar.
 *
 * Burada YALNIZCA ilk boyamayı etkileyen tercihler okunur. `speechRate` (sesli
 * okuma hızı) bilinçli olarak yok: hiçbir `<html>` niteliğine yansımıyor ve
 * ancak kullanıcı oynatıcıya bastığında gerekiyor. Betik bilinmeyen alanları
 * zaten görmezden gelir; yeni bir GÖRSEL tercih eklenirse buraya da eklenmeli.
 */
export function PreferencesScript() {
	const script = `
(function () {
	try {
		var raw = localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)});
		if (!raw) return;
		var prefs = (JSON.parse(raw) || {}).state || {};
		var root = document.documentElement;
		if (prefs.theme && prefs.theme !== "sistem") root.setAttribute("data-theme", prefs.theme);
		if (prefs.fontScale && prefs.fontScale !== "normal") root.setAttribute("data-font-scale", prefs.fontScale);
		if (prefs.highContrast) root.setAttribute("data-contrast", "yuksek");
	} catch (e) {
		/* tercih okunamazsa varsayılanlarla devam et */
	}
})();`.trim();

	// Betik sabittir ve kullanıcı girdisi içermez; tek değişken kısmı derleme
	// zamanında JSON.stringify ile kaçırılan localStorage anahtarıdır.
	return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
