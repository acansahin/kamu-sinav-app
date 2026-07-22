import { defineConfig, devices } from "@playwright/test";

/**
 * Uçtan uca testler statik export üzerinde çalışır, dev sunucusunda değil.
 *
 * Sebep: uygulamanın gerçekte dağıtılan biçimi `out/` klasörüdür. Dev
 * sunucusunda geçen bir test, statik export'ta kırılan bir hatayı kaçırabilir
 * — service worker yalnızca üretimde kayıt olur, rotalar `trailingSlash` ile
 * klasör olarak üretilir.
 */
export default defineConfig({
	testDir: "tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? "github" : "list",

	use: {
		baseURL: "http://localhost:4173",
		trace: "on-first-retry",
		locale: "tr-TR",
		timezoneId: "Europe/Istanbul",
	},

	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		// Hedef kitlenin bir bölümü mobilden çalışıyor; alt gezinme ve
		// dokunma hedefleri yalnızca dar ekranda görünür.
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],

	webServer: {
		command: "npx serve out -p 4173 -L",
		url: "http://localhost:4173",
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
	},
});
