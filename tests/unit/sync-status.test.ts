// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatLastSynced } from "@/lib/sync/sync-status";

/**
 * Senkron durumu — göstergenin doğruluğu buraya bağlı.
 *
 * Depo bir tekildir (modül düzeyinde önbellek); testler arasında sızmaması için
 * her testte modül sıfırlanır ve sahte localStorage temizlenir.
 */

const NOW = new Date("2026-07-24T12:00:00.000Z");

describe("formatLastSynced", () => {
	it("hiç eşitlenmediyse bunu söyler", () => {
		expect(formatLastSynced(null, NOW)).toBe("Henüz eşitlenmedi");
	});

	it("çok yakın zamanı 'az önce' sayar", () => {
		const at = new Date(NOW.getTime() - 10_000).toISOString();
		expect(formatLastSynced(at, NOW)).toBe("Az önce eşitlendi");
	});

	it("saat kaymasıyla gelecekteki damgayı da 'az önce' sayar", () => {
		const future = new Date(NOW.getTime() + 5_000).toISOString();
		expect(formatLastSynced(future, NOW)).toBe("Az önce eşitlendi");
	});

	it("dakikayı göreli yazar", () => {
		const at = new Date(NOW.getTime() - 5 * 60_000).toISOString();
		expect(formatLastSynced(at, NOW)).toBe("5 dakika önce eşitlendi");
	});

	it("saati göreli yazar", () => {
		const at = new Date(NOW.getTime() - 3 * 3_600_000).toISOString();
		expect(formatLastSynced(at, NOW)).toBe("3 saat önce eşitlendi");
	});

	it("günü göreli yazar", () => {
		const at = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
		expect(formatLastSynced(at, NOW)).toBe("2 gün önce eşitlendi");
	});

	it("bir haftadan eskisini mutlak tarihe düşürür", () => {
		const at = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
		const text = formatLastSynced(at, NOW);
		expect(text).toContain("tarihinde eşitlendi");
		expect(text).toContain("2026");
	});
});

describe("senkron durumu deposu", () => {
	beforeEach(() => {
		vi.resetModules();
		window.localStorage.clear();
	});

	async function load() {
		return import("@/lib/sync/sync-status");
	}

	it("eşitleme sürerken zaman damgasını korur", async () => {
		const m = await load();
		m.markSynced("2026-07-24T11:00:00.000Z");
		m.markSyncing();

		const status = m.getSyncStatus();
		expect(status.phase).toBe("syncing");
		expect(status.lastSyncedAt).toBe("2026-07-24T11:00:00.000Z");
	});

	it("başarı zaman damgasını yazar ve kalıcılaştırır", async () => {
		const m = await load();
		m.markSynced("2026-07-24T12:00:00.000Z");

		expect(m.getSyncStatus()).toEqual({
			phase: "idle",
			lastSyncedAt: "2026-07-24T12:00:00.000Z",
		});
		// Yeniden açılışta okunabilmesi için localStorage'a yazılmalı.
		expect(window.localStorage.getItem("kamu-sinav-son-esitleme")).toBe(
			"2026-07-24T12:00:00.000Z",
		);
	});

	it("hata, son başarılı zaman damgasını SİLMEZ", async () => {
		const m = await load();
		m.markSynced("2026-07-24T11:00:00.000Z");
		m.markSyncError();

		const status = m.getSyncStatus();
		expect(status.phase).toBe("error");
		expect(status.lastSyncedAt).toBe("2026-07-24T11:00:00.000Z");
	});

	it("açılışta kalıcı zaman damgasını okur", async () => {
		window.localStorage.setItem(
			"kamu-sinav-son-esitleme",
			"2026-07-20T09:00:00.000Z",
		);
		const m = await load();

		expect(m.getSyncStatus()).toEqual({
			phase: "idle",
			lastSyncedAt: "2026-07-20T09:00:00.000Z",
		});
	});

	it("değişimde aboneleri uyarır", async () => {
		const m = await load();
		const seen: string[] = [];
		const unsubscribe = m.subscribeSyncStatus((s) => seen.push(s.phase));

		m.markSyncing();
		m.markSynced("2026-07-24T12:00:00.000Z");
		unsubscribe();
		m.markSyncError();

		expect(seen).toEqual(["syncing", "idle"]);
	});
});
