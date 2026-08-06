// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryReader } from "@/features/study/summary-reader";

/**
 * Sesli okuma oynatıcısının davranışı.
 *
 * En değerli testler sondaki iki blok: "okundu" işaretinin YALNIZCA doğal
 * bitişte yazılması ve durdurulmuş bir okumanın geç gelen bir `speak`
 * cevabıyla devam etmemesi. İkisi de kolayca geri kaçar ve üretimde sessizce
 * bozulur.
 */

/**
 * Kontrol edilebilir `speak`: her çağrı elle çözülebilen bir promise döndürür.
 * Böylece "konuşma bitti", "kullanıcı durdurdu" ve "cevap geç geldi" senaryoları
 * zamanlayıcı beklemeden kurulabiliyor.
 *
 * `vi.hoisted` zorunlu: `vi.mock` fabrikaları dosyanın en üstüne taşınır ve
 * normal `const` tanımları o anda henüz oluşmamış olur.
 */
const { speak, stop, openInstall, markSummaryRead, bekleyenler } = vi.hoisted(
	() => {
		const kuyruk: { coz: () => void; reddet: (e: unknown) => void }[] = [];
		return {
			bekleyenler: kuyruk,
			speak: vi.fn<(o: { text: string; rate: number }) => Promise<void>>(
				() =>
					new Promise<void>((resolve, reject) => {
						kuyruk.push({ coz: () => resolve(), reddet: reject });
					}),
			),
			stop: vi.fn<() => Promise<void>>(() => Promise.resolve()),
			openInstall: vi.fn<() => Promise<void>>(() => Promise.resolve()),
			markSummaryRead:
				vi.fn<(subjectId: string, topicId: string) => Promise<void>>(() =>
					Promise.resolve(),
				),
		};
	},
);

let yetenek: unknown = { durum: "hazir" };

vi.mock("@/lib/speech/speech.provider", () => ({
	yetenegiYokla: () => Promise.resolve(yetenek),
	getSpeechProvider: () => ({ speak, stop, openInstall }),
}));

vi.mock("@/lib/repositories/progress.repository", () => ({
	progressRepository: { markSummaryRead },
}));

beforeEach(() => {
	bekleyenler.length = 0;
	speak.mockClear();
	stop.mockClear();
	markSummaryRead.mockClear();
	yetenek = { durum: "hazir" };
	// jsdom `scrollIntoView` uygulamıyor; vurgulama onu çağırıyor.
	Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function kur() {
	return render(
		<SummaryReader subjectId="657-dmk" topicId="657-dmk/genel-hukumler">
			<div data-tts="body">
				<p>Birinci paragraf burada duruyor ve yeterince uzundur efendim.</p>
				<p>İkinci paragraf burada duruyor ve yeterince uzundur efendim.</p>
			</div>
		</SummaryReader>,
	);
}

const tus = (ad: RegExp) => screen.getByRole("button", { name: ad });

/** İlk parçanın okunmaya başlamasını bekler. */
async function okumayaBasla() {
	await act(async () => {
		tus(/sesli oku/i).click();
	});
	await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
}

/** Bekleyen `speak` çağrısını doğal biten bir konuşma gibi tamamlar. */
async function parcayiBitir() {
	await act(async () => {
		bekleyenler.shift()?.coz();
	});
}

describe("okuma akışı", () => {
	it("ilk parçayı okur ve Türkçe dil etiketi sağlayıcıdan gelir", async () => {
		kur();
		await okumayaBasla();
		expect(speak).toHaveBeenCalledWith(
			expect.objectContaining({ text: expect.stringContaining("Birinci") }),
		);
	});

	it("parça bitince sıradakine geçer", async () => {
		kur();
		await okumayaBasla();
		await parcayiBitir();
		await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
		expect(speak.mock.calls[1][0]).toEqual(
			expect.objectContaining({ text: expect.stringContaining("İkinci") }),
		);
	});

	it("okunan blok vurgulanır ve vurgu sıradakine taşınır", async () => {
		const { container } = kur();
		await okumayaBasla();

		const paragraflar = container.querySelectorAll("p");
		await waitFor(() =>
			expect(paragraflar[0].hasAttribute("data-tts-active")).toBe(true),
		);

		await parcayiBitir();
		await waitFor(() =>
			expect(paragraflar[1].hasAttribute("data-tts-active")).toBe(true),
		);
		expect(paragraflar[0].hasAttribute("data-tts-active")).toBe(false);
	});
});

describe("duraklat ve devam", () => {
	it("duraklat sesi keser ve yeni parça başlatmaz", async () => {
		kur();
		await okumayaBasla();

		await act(async () => {
			tus(/duraklat/i).click();
		});

		expect(stop).toHaveBeenCalled();
		expect(speak).toHaveBeenCalledTimes(1);
		expect(tus(/devam et/i)).toBeTruthy();
	});

	/**
	 * Eklentide `resume()` yok; devam AYNI parçayı baştan okur. Ses anında
	 * kesildiği için bu bir tekrar değil, kullanıcının kaçırdığı cümlenin
	 * yeniden duyulmasıdır.
	 */
	it("devam AYNI parçadan başlar", async () => {
		kur();
		await okumayaBasla();
		const ilkMetin = speak.mock.calls[0][0];

		await act(async () => {
			tus(/duraklat/i).click();
		});
		await act(async () => {
			tus(/devam et/i).click();
		});

		await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
		expect(speak.mock.calls[1][0]).toEqual(ilkMetin);
	});

	it("duraklatınca vurgu KALIR — kullanıcı nerede kaldığını görmeli", async () => {
		const { container } = kur();
		await okumayaBasla();
		await act(async () => {
			tus(/duraklat/i).click();
		});
		expect(
			container.querySelector("p")?.hasAttribute("data-tts-active"),
		).toBe(true);
	});
});

describe("okundu işaretlemesi", () => {
	/** EN KRİTİK TEST: yarıda bırakılan okuma konuyu "okundu" yapmamalı. */
	it("ortada durdurulursa markSummaryRead ÇAĞRILMAZ", async () => {
		kur();
		await okumayaBasla();

		await act(async () => {
			tus(/durdur/i).click();
		});
		// Durdurmadan sonra bekleyen promise geç çözülse bile döngü devam etmemeli.
		await parcayiBitir();

		expect(markSummaryRead).not.toHaveBeenCalled();
		expect(speak).toHaveBeenCalledTimes(1);
	});

	it("sonuna kadar dinlenirse TAM BİR KEZ çağrılır", async () => {
		kur();
		await okumayaBasla();
		await parcayiBitir();
		await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
		await parcayiBitir();

		await waitFor(() => expect(markSummaryRead).toHaveBeenCalledTimes(1));
		expect(markSummaryRead).toHaveBeenCalledWith(
			"657-dmk",
			"657-dmk/genel-hukumler",
		);
	});

	it("durdurma vurguyu temizler", async () => {
		const { container } = kur();
		await okumayaBasla();
		await act(async () => {
			tus(/durdur/i).click();
		});
		expect(
			container.querySelector("p")?.hasAttribute("data-tts-active"),
		).toBe(false);
	});
});

describe("temizlik", () => {
	/**
	 * Capacitor'da native TTS bir işletim sistemi servisidir: WebView rota
	 * değiştirse de konuşmaya devam eder. Unmount'ta susmazsa kullanıcı
	 * özetten çıktığı hâlde sesi dinlemeye devam eder.
	 */
	it("unmount sesi durdurur", async () => {
		const { unmount } = kur();
		await okumayaBasla();
		stop.mockClear();

		unmount();
		expect(stop).toHaveBeenCalled();
	});

	it("unmount sonrası geç gelen cevap yeni parça başlatmaz", async () => {
		const { unmount } = kur();
		await okumayaBasla();
		unmount();

		await parcayiBitir();
		expect(speak).toHaveBeenCalledTimes(1);
	});
});

describe("Türkçe ses verisi yoksa", () => {
	it("uyarı gösterir ve kurulum düğmesi sunar", async () => {
		yetenek = { durum: "dil-yok", kurulumAcilabilir: true };
		kur();

		await act(async () => {
			tus(/sesli oku/i).click();
		});

		expect(await screen.findByRole("status")).toHaveProperty("textContent");
		expect(screen.getByText(/Türkçe ses verisi bulunamadı/i)).toBeTruthy();
		expect(speak).not.toHaveBeenCalled();

		await act(async () => {
			tus(/türkçe ses verisini yükle/i).click();
		});
		expect(openInstall).toHaveBeenCalled();
	});

	/** Kalıcı olarak ölü bir kontrol, yokluğundan daha çok gürültüdür. */
	it("motor hiç yoksa oynatıcı gizlenir", async () => {
		yetenek = { durum: "yok" };
		kur();

		await act(async () => {
			tus(/sesli oku/i).click();
		});

		await waitFor(() =>
			expect(screen.queryByRole("button", { name: /sesli oku/i })).toBeNull(),
		);
	});
});
