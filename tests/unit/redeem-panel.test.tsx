// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedeemPanel } from "@/features/billing/redeem-panel";
import type { Entitlement } from "@/lib/billing/entitlement";
import type { RedeemOutcome } from "@/lib/stores/entitlement";

/**
 * Kod kutusunun görünürlüğü ve geri bildirimi.
 *
 * En kritik olanı ilk ikisi: kutu, kilit UYGULANMAYAN ortamda (tarayıcı)
 * görünürse olmayan bir kilidin çaresini sunar; hak zaten açıkken görünürse
 * kullanıcıyı bir şey eksik sanmaya iter. İkisi de sessiz hatalardır.
 */

let entitlement: Entitlement | undefined;
let sonuc: RedeemOutcome;

const redeemAccessCode = vi.fn<(raw: string) => Promise<RedeemOutcome>>(
	async () => sonuc,
);

vi.mock("@/lib/stores/entitlement", () => ({
	useEntitlement: () => entitlement,
	redeemAccessCode: (raw: string) => redeemAccessCode(raw),
}));

beforeEach(() => {
	entitlement = { paywallActive: true, fullAccess: false };
	sonuc = { ok: true, hash: "x" };
	redeemAccessCode.mockClear();
});

afterEach(cleanup);

async function kodGir(deger: string) {
	fireEvent.change(screen.getByLabelText("Erişim kodu"), {
		target: { value: deger },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: /kodu kullan/i }));
	});
}

describe("RedeemPanel", () => {
	it("hak çözülmeden hiç görünmez", () => {
		entitlement = undefined;
		render(<RedeemPanel />);
		expect(screen.queryByLabelText("Erişim kodu")).toBeNull();
	});

	it("tarayıcıda (kilitsiz ortam) görünmez", () => {
		entitlement = { paywallActive: false, fullAccess: false };
		render(<RedeemPanel />);
		expect(screen.queryByLabelText("Erişim kodu")).toBeNull();
	});

	it("hak zaten açıkken görünmez", () => {
		entitlement = { paywallActive: true, fullAccess: true };
		render(<RedeemPanel />);
		expect(screen.queryByLabelText("Erişim kodu")).toBeNull();
	});

	it("boş kodla gönderilemez", () => {
		render(<RedeemPanel />);
		expect(
			screen.getByRole<HTMLButtonElement>("button", { name: /kodu kullan/i })
				.disabled,
		).toBe(true);
	});

	it("geçerli kodu kabul eder", async () => {
		render(<RedeemPanel />);
		await kodGir("ABCD-1234-EFGH");

		expect(redeemAccessCode).toHaveBeenCalledWith("ABCD-1234-EFGH");
		expect(screen.getByRole("status").textContent).toContain(
			"Tam erişim açıldı",
		);
	});

	/** Yanlış yazım HATA DEĞİLDİR: `alert` değil `status` rolüyle bildirilir. */
	it("biçim hatasını uyarı tonuyla değil bilgi tonuyla söyler", async () => {
		sonuc = { ok: false, reason: "bicim" };
		render(<RedeemPanel />);
		await kodGir("kisa");

		expect(screen.getByRole("status").textContent).toMatch(/kontrol edin/i);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("geçersiz kodu hata olarak bildirir", async () => {
		sonuc = { ok: false, reason: "gecersiz" };
		render(<RedeemPanel />);
		await kodGir("ZZZZ-9999-ZZZZ");

		expect(screen.getByRole("alert").textContent).toMatch(
			/bu kod geçerli değil/i,
		);
	});

	/** Kaydedilemeyen kod SESSİZCE geçilemez — erişim uygulama kapanınca gider. */
	it("kaydedilemeyen kodu açıkça söyler", async () => {
		sonuc = { ok: false, reason: "depo" };
		render(<RedeemPanel />);
		await kodGir("ABCD-1234-EFGH");

		expect(screen.getByRole("alert").textContent).toMatch(/kaydedilemedi/i);
	});
});
