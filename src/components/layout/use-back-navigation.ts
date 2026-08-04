"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { parentRoute } from "@/lib/routes";

/** Kökte çıkışı onaylamak için ikinci basışın beklendiği süre. */
const EXIT_WINDOW_MS = 2000;

/**
 * Uygulamanın tek geri gezinme mantığı.
 *
 * İki farklı "geri" vardır ve bu hook ikisini de karşılar:
 *
 *  - **Geçmiş tabanlı.** Ayarlar, Arama ve Hesap her sayfadan açılabildiği için
 *    hiyerarşik bir üstleri yoktur; "test çözerken Ayarlar'a girip teste dönmek"
 *    ancak geçmişle çözülür. Uygulama içinde en az bir kez gezinildiyse
 *    `router.back()` çağrılır.
 *  - **Hiyerarşik yedek.** Derin bağlantıyla ya da uygulama soğuk açılışıyla
 *    doğrudan bir sayfaya girildiğinde geçmiş boştur; `router.back()` orada ölü
 *    kalır (APK'da uygulamadan çıkarır). O hâlde `parentRoute` ile üst sayfaya
 *    gidilir.
 *
 * Aynı mantık hem başlıktaki tuşa hem Android'in donanım geri tuşuna bağlanır.
 * **Tek bir yerde durması şart:** derinlik sayacı bileşen içinde tutulduğu için
 * iki ayrı çağrı iki ayrı sayaç doğurur ve donanım tuşu ekrandaki tuşla
 * uyumsuz davranmaya başlar. Bu yüzden hook kök düzende BİR KEZ çağrılır,
 * `goBack` aşağıya geçirilir.
 *
 * Kökte donanım tuşu uygulamadan çıkar; yanlışlıkla basış test ortasında
 * uygulamayı kapatmasın diye çıkış ikinci basışla onaylanır.
 */
export function useBackNavigation(): {
	/** Geri git: geçmiş varsa `router.back()`, yoksa hiyerarşik üst. */
	goBack: () => void;
	/** Kökte çıkış onayı bekleniyor mu? Kullanıcıya ipucu göstermek için. */
	showExitHint: boolean;
} {
	const pathname = usePathname();
	const router = useRouter();

	/** Uygulama içinde biriken geçmiş derinliği. */
	const depth = useRef(0);
	const previous = useRef<string | null>(null);
	/** Son rota değişimini bu hook'un kendi `back()` çağrısı mı doğurdu? */
	const goingBack = useRef(false);
	/**
	 * `goBack` ve donanım dinleyicisi güncel yolu buradan okur. Doğrudan
	 * `pathname` kapatılsaydı `goBack` her rota değişiminde yeni bir referans
	 * olurdu ve Capacitor dinleyicisi her sayfada sökülüp yeniden kurulurdu.
	 */
	const pathnameRef = useRef(pathname);

	const exitArmed = useRef(false);
	const [showExitHint, setShowExitHint] = useState(false);

	useEffect(() => {
		pathnameRef.current = pathname;

		if (previous.current === null) {
			previous.current = pathname;
			return;
		}
		if (previous.current === pathname) return;

		depth.current = goingBack.current
			? Math.max(0, depth.current - 1)
			: depth.current + 1;
		goingBack.current = false;
		previous.current = pathname;

		// Kökten ayrılındıysa bekleyen çıkış onayı düşer.
		exitArmed.current = false;
		setShowExitHint(false);
	}, [pathname]);

	/*
	 * Bilinen sınır: tarayıcının kendi geri tuşuyla yapılan gezinme sayaca
	 * yansımaz, dolayısıyla derinlik olduğundan büyük görünebilir. Sonucu
	 * zararsızdır (bir adım daha geri gidilir) ve APK'da tarayıcı çubuğu
	 * olmadığı için pratikte oluşmaz.
	 */
	const goBack = useCallback(() => {
		if (depth.current > 0) {
			goingBack.current = true;
			router.back();
		} else {
			router.push(parentRoute(pathnameRef.current));
		}
	}, [router]);

	// Android donanım geri tuşu.
	useEffect(() => {
		let cancelled = false;
		let remove: (() => void) | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function kur(): Promise<void> {
			/*
			 * Dinamik yükleme bilinçli: statik içe aktarım Capacitor'ı web
			 * yayınının ortak paketine sokar (bkz. lib/auth/supabase-client.ts).
			 */
			const { Capacitor } = await import("@capacitor/core");
			// Web'de donanım geri tuşu yoktur; tarayıcı kendi tuşunu zaten işler.
			if (cancelled || !Capacitor.isNativePlatform()) return;

			const { App } = await import("@capacitor/app");

			/*
			 * Dinleyici eklendiği anda Capacitor'ın varsayılan davranışı (WebView
			 * geçmişi varsa geri, yoksa çıkış) devre dışı kalır ve geri tuşunun
			 * tamamı bize düşer — kökteki çıkış dâhil.
			 */
			const handle = await App.addListener("backButton", () => {
				if (pathnameRef.current !== "/") {
					goBack();
					return;
				}

				if (exitArmed.current) {
					void App.exitApp();
					return;
				}

				exitArmed.current = true;
				setShowExitHint(true);
				timer = setTimeout(() => {
					exitArmed.current = false;
					setShowExitHint(false);
				}, EXIT_WINDOW_MS);
			});

			if (cancelled) {
				void handle.remove();
				return;
			}
			remove = () => void handle.remove();
		}

		// Kurulum başarısız olursa (eklenti yok, eski WebView) uygulama çalışmaya
		// devam eder; yalnızca varsayılan geri davranışına düşülür.
		void kur().catch(() => {});

		return () => {
			cancelled = true;
			remove?.();
			if (timer) clearTimeout(timer);
		};
	}, [goBack]);

	return { goBack, showExitHint };
}
