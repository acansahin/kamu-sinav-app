"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { parentRoute } from "@/lib/routes";

/**
 * Başlıktaki geri tuşu.
 *
 * İki farklı "geri" vardır ve bu bileşen ikisini de karşılar:
 *
 *  - **Geçmiş tabanlı.** Ayarlar, Arama ve Hesap her sayfadan açılabildiği için
 *    hiyerarşik bir üstleri yoktur; "test çözerken Ayarlar'a girip teste dönmek"
 *    ancak geçmişle çözülür. Uygulama içinde en az bir kez gezinildiyse
 *    `router.back()` çağrılır.
 *  - **Hiyerarşik yedek.** Derin bağlantıyla ya da uygulama soğuk açılışıyla
 *    doğrudan bir sayfaya girildiğinde geçmiş boştur; `router.back()` orada ölü
 *    kalır (APK'da uygulamadan çıkarabilir). O hâlde `parentRoute` ile üst
 *    sayfaya gidilir.
 *
 * Ana sayfada `null` döner ama bileşen ağaçtan ÇIKMAZ: AppShell kök düzende
 * yaşadığı için sayaç rota değişimlerinde korunur, koşullu render edilseydi
 * her ana sayfa ziyaretinde sıfırlanırdı.
 */
export function BackButton() {
	const pathname = usePathname();
	const router = useRouter();

	/** Uygulama içinde biriken geçmiş derinliği. */
	const depth = useRef(0);
	const previous = useRef<string | null>(null);
	/** Son rota değişimini bu bileşenin kendi `back()` çağrısı mı doğurdu? */
	const goingBack = useRef(false);

	useEffect(() => {
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
	}, [pathname]);

	if (pathname === "/") return null;

	/*
	 * Bilinen sınır: tarayıcının kendi geri tuşuyla yapılan gezinme sayaca
	 * yansımaz, dolayısıyla derinlik olduğundan büyük görünebilir. Sonucu
	 * zararsızdır (bir adım daha geri gidilir) ve APK'da tarayıcı çubuğu
	 * olmadığı için pratikte oluşmaz.
	 */
	function goBack() {
		if (depth.current > 0) {
			goingBack.current = true;
			router.back();
		} else {
			router.push(parentRoute(pathname));
		}
	}

	return (
		<button
			type="button"
			onClick={goBack}
			aria-label="Geri"
			className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
		>
			<ArrowLeft aria-hidden size={20} />
		</button>
	);
}
