// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "@/components/layout/back-button";
import { useBackNavigation } from "@/components/layout/use-back-navigation";

/**
 * Geri gezinmenin karar tablosu.
 *
 * Buradaki tek gerçek risk şu: derinlik sayacı yanlış sayarsa `router.back()`
 * uygulama geçmişinin DIŞINA taşar ve APK'da uygulamadan çıkar — kullanıcı
 * test ortasında kendini ana ekranda bulur. Sayaç saf fonksiyon olmadığı
 * (rota değişimlerinin sırasına bağlı olduğu) için ancak burada sınanır;
 * `parentRoute`'un kendisi `tests/unit/routes.test.ts` içinde ayrıca testli.
 *
 * Capacitor dinamik olarak yükleniyor ve `isNativePlatform()` tarayıcıda
 * false döndüğü için donanım tuşu yolu bu ortamda hiç kurulmaz; testler
 * ekrandaki tuşun davranışını ölçer.
 */

const back = vi.fn();
const push = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
	usePathname: () => pathname,
	useRouter: () => ({ back, push }),
}));

/** Hook'u tuşla birlikte gerçek kullanımdaki gibi bağlayan kabuk. */
function Kabuk() {
	const { goBack, showExitHint } = useBackNavigation();
	return (
		<>
			<BackButton onBack={goBack} />
			{showExitHint && <span>Çıkmak için tekrar basın</span>}
		</>
	);
}

beforeEach(() => {
	back.mockClear();
	push.mockClear();
	pathname = "/";
});

// Vitest'te `globals` kapalı olduğu için testing-library kendiliğinden
// temizlemez; temizlenmezse önceki testin DOM'u kalır ve sorgular çift eşleşir.
afterEach(cleanup);

describe("useBackNavigation", () => {
	it("geçmiş yokken hiyerarşik üste gider", () => {
		// Derin bağlantı ya da soğuk açılış: uygulama içinde hiç gezinilmedi.
		pathname = "/konular/657-dmk/disiplin-cezalari";
		render(<Kabuk />);

		fireEvent.click(screen.getByRole("button", { name: "Geri" }));

		expect(push).toHaveBeenCalledWith("/konular/657-dmk");
		expect(back).not.toHaveBeenCalled();
	});

	it("uygulama içinde gezinildiyse geçmişi kullanır", () => {
		pathname = "/testler/657-dmk/disiplin-cezalari/test-1";
		const { rerender } = render(<Kabuk />);

		// Test çözerken Ayarlar'a girildi: hiyerarşik üstü test sayfası DEĞİL,
		// bu senaryoyu ancak geçmiş çözer.
		pathname = "/ayarlar";
		rerender(<Kabuk />);

		fireEvent.click(screen.getByRole("button", { name: "Geri" }));

		expect(back).toHaveBeenCalledOnce();
		expect(push).not.toHaveBeenCalled();
	});

	it("kendi geri gidişini sayar, derinliği şişirmez", () => {
		pathname = "/konular";
		const { rerender } = render(<Kabuk />);

		pathname = "/ayarlar";
		rerender(<Kabuk />);

		// Bir ileri, bir geri: derinlik sıfıra döner.
		fireEvent.click(screen.getByRole("button", { name: "Geri" }));
		expect(back).toHaveBeenCalledOnce();

		pathname = "/konular";
		rerender(<Kabuk />);

		// Derinlik tükendiği için ikinci basış artık geçmişe değil üste gitmeli;
		// aksi hâlde `back()` uygulama geçmişinin dışına taşardı.
		fireEvent.click(screen.getByRole("button", { name: "Geri" }));
		expect(back).toHaveBeenCalledOnce();
		expect(push).toHaveBeenCalledWith("/");
	});

	it("aynı rotaya yeniden render derinliği artırmaz", () => {
		pathname = "/arama";
		const { rerender } = render(<Kabuk />);

		// Arama kutusuna her harf yazıldığında bileşen yeniden render olur;
		// bunlar gezinme değildir.
		rerender(<Kabuk />);
		rerender(<Kabuk />);

		fireEvent.click(screen.getByRole("button", { name: "Geri" }));

		expect(back).not.toHaveBeenCalled();
		expect(push).toHaveBeenCalledWith("/");
	});

	it("tarayıcıda çıkış ipucu gösterilmez", () => {
		render(<Kabuk />);

		// İpucu yalnızca donanım tuşuyla tetiklenir; web'de o yol hiç kurulmaz.
		expect(screen.queryByText("Çıkmak için tekrar basın")).toBeNull();
	});
});
