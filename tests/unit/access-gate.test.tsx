// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessGate } from "@/features/billing/access-gate";
import type { Entitlement } from "@/lib/billing/entitlement";

/**
 * Kapının üç hâli.
 *
 * En kritik olanı ortadaki: hak henüz çözülmemişken kapı NE içeriği NE kilidi
 * gösterir. Erken bir "kilitli" varsayımı ödemiş kullanıcıya bir kare boyunca
 * satın alma ekranı gösterirdi; erken bir "açık" varsayımı kilitli içeriği
 * yüzeye çıkarırdı. İkisi de sessiz hatalardır ve ancak burada yakalanır.
 */

let entitlement: Entitlement | undefined;

vi.mock("@/lib/stores/entitlement", () => ({
	useEntitlement: () => entitlement,
}));

beforeEach(() => {
	entitlement = undefined;
});

afterEach(cleanup);

const GIZLI = "korunan içerik";

function kur() {
	render(
		<AccessGate rule={{ kind: "exam" }}>
			<p>{GIZLI}</p>
		</AccessGate>,
	);
}

describe("AccessGate", () => {
	it("hak çözülmeden ne içeriği ne kilidi gösterir", () => {
		kur();
		expect(screen.queryByText(GIZLI)).toBeNull();
		expect(screen.queryByText(/tam erişime dahil/i)).toBeNull();
		expect(screen.getByRole("status").textContent).toContain("Yükleniyor");
	});

	it("tarayıcıda içeriği gösterir — paywall etkin değil", () => {
		entitlement = { paywallActive: false, fullAccess: false };
		kur();
		expect(screen.getByText(GIZLI)).toBeTruthy();
	});

	it("tam erişimde içeriği gösterir", () => {
		entitlement = { paywallActive: true, fullAccess: true };
		kur();
		expect(screen.getByText(GIZLI)).toBeTruthy();
	});

	it("kısıtlı hâlde içeriği HİÇ render etmez ve kilidi gösterir", () => {
		entitlement = { paywallActive: true, fullAccess: false };
		kur();
		expect(screen.queryByText(GIZLI)).toBeNull();
		expect(screen.getByText(/deneme sınavları tam erişime dahil/i)).toBeTruthy();
	});

	/**
	 * Konu kuralı ders ve konuyu birlikte değerlendirir; ücretsiz konu kısıtlı
	 * hâlde bile açıktır.
	 */
	it("ücretsiz konu kısıtlı hâlde bile açıktır", () => {
		entitlement = { paywallActive: true, fullAccess: false };
		render(
			<AccessGate
				rule={{ kind: "topic", subjectId: "657-dmk", topicSlug: "genel-hukumler" }}
			>
				<p>{GIZLI}</p>
			</AccessGate>,
		);
		expect(screen.getByText(GIZLI)).toBeTruthy();
	});

	it("kilitli konu kilit panelini gösterir", () => {
		entitlement = { paywallActive: true, fullAccess: false };
		render(
			<AccessGate rule={{ kind: "topic", subjectId: "anayasa", topicSlug: "yasama" }}>
				<p>{GIZLI}</p>
			</AccessGate>,
		);
		expect(screen.queryByText(GIZLI)).toBeNull();
		expect(screen.getByRole("link", { name: /tam erişimi incele/i })).toBeTruthy();
	});
});
