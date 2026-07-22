import { describe, expect, it } from "vitest";
import {
	type SchedulerState,
	describeInterval,
	dueDateFrom,
	gradeFromAttempt,
	scheduler,
} from "@/lib/scheduler/sm2";
import { computeStreak, dayKey } from "@/lib/scoring/streak";

/** Ardışık notları uygulayıp son durumu döner. */
function apply(grades: number[]): SchedulerState {
	let state = scheduler.initial();
	for (const grade of grades) {
		state = scheduler.next(state, grade as 0 | 1 | 2 | 3 | 4 | 5);
	}
	return state;
}

describe("gradeFromAttempt", () => {
	it("boş bırakmaya en düşük notu verir", () => {
		expect(gradeFromAttempt(false, null, 5000)).toBe(0);
	});

	it("boş bırakmak, yanlış cevaplamaktan daha düşük not alır", () => {
		// Ürün kararı: yanlış cevapta en azından bir kanaat vardır.
		expect(gradeFromAttempt(false, null, 5000)).toBeLessThan(
			gradeFromAttempt(false, 1, 5000),
		);
	});

	it("hızlı doğru cevaba en yüksek notu verir", () => {
		expect(gradeFromAttempt(true, 0, 5_000)).toBe(5);
	});

	it("yavaş doğru cevap, hızlı doğru cevaptan düşük not alır", () => {
		expect(gradeFromAttempt(true, 0, 90_000)).toBeLessThan(
			gradeFromAttempt(true, 0, 5_000),
		);
	});
});

describe("SM-2 zamanlayıcı", () => {
	it("ilk doğru cevaptan sonra aralık 1 gündür", () => {
		expect(apply([5]).intervalDays).toBe(1);
	});

	it("ikinci doğru cevaptan sonra aralık 6 gündür", () => {
		expect(apply([5, 5]).intervalDays).toBe(6);
	});

	it("üst üste doğru cevaplarda aralık büyür", () => {
		const state = apply([5, 5, 5, 5]);
		expect(state.intervalDays).toBeGreaterThan(6);
		expect(state.repetitions).toBe(4);
	});

	it("yanlış cevap aralığı 1 güne sıfırlar ve tekrar sayacını sıfırlar", () => {
		const state = apply([5, 5, 5, 2]);
		expect(state.intervalDays).toBe(1);
		expect(state.repetitions).toBe(0);
	});

	it("yanlış cevap unutma sayacını artırır", () => {
		expect(apply([5, 2]).lapses).toBe(1);
		expect(apply([5, 2, 5, 2]).lapses).toBe(2);
	});

	it("kolaylık katsayısı alt sınırın altına inmez", () => {
		// Sürekli en düşük notu ver; katsayı 1.3'te durmalı.
		const state = apply(Array<number>(20).fill(0));
		expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
		expect(state.easeFactor).toBeCloseTo(1.3, 5);
	});

	it("zor sorular kolay sorulardan daha sık geri gelir", () => {
		const kolay = apply([5, 5, 5, 5]);
		const zorlanilan = apply([3, 3, 3, 3]);
		expect(zorlanilan.intervalDays).toBeLessThan(kolay.intervalDays);
	});

	it("başlangıç durumu bilinen SM-2 değerleridir", () => {
		const initial = scheduler.initial();
		expect(initial.easeFactor).toBe(2.5);
		expect(initial.repetitions).toBe(0);
		expect(initial.lapses).toBe(0);
	});
});

describe("dueDateFrom", () => {
	it("aralığı takvim tarihine çevirir", () => {
		const from = new Date(2026, 6, 21);
		const due = new Date(dueDateFrom(6, from));
		expect(due.getDate()).toBe(27);
	});

	it("ay sınırını doğru aşar", () => {
		const from = new Date(2026, 6, 30);
		const due = new Date(dueDateFrom(5, from));
		expect(due.getMonth()).toBe(7); // Ağustos
		expect(due.getDate()).toBe(4);
	});
});

describe("describeInterval", () => {
	it("süreyi insan diliyle anlatır", () => {
		expect(describeInterval(1)).toBe("yarın");
		expect(describeInterval(3)).toBe("3 gün sonra");
		expect(describeInterval(14)).toBe("2 hafta sonra");
		expect(describeInterval(60)).toBe("2 ay sonra");
	});
});

describe("computeStreak", () => {
	it("hiç çalışılmamışsa sıfırdır", () => {
		expect(computeStreak([], "2026-07-21")).toBe(0);
	});

	it("ardışık günleri sayar", () => {
		const days = ["2026-07-19", "2026-07-20", "2026-07-21"];
		expect(computeStreak(days, "2026-07-21")).toBe(3);
	});

	it("bugün çalışılmamışsa ama dün çalışıldıysa seri korunur", () => {
		// Sabah uygulamayı açan kullanıcıya "serin bozuldu" demek yanlış olurdu.
		const days = ["2026-07-19", "2026-07-20"];
		expect(computeStreak(days, "2026-07-21")).toBe(2);
	});

	it("bir gün tamamen atlandığında seri kopar", () => {
		const days = ["2026-07-17", "2026-07-18", "2026-07-20", "2026-07-21"];
		expect(computeStreak(days, "2026-07-21")).toBe(2);
	});

	it("iki gün önce bitmişse seri sıfırdır", () => {
		expect(computeStreak(["2026-07-19"], "2026-07-21")).toBe(0);
	});

	it("ay sınırını aşan seriyi doğru sayar", () => {
		const days = ["2026-06-29", "2026-06-30", "2026-07-01"];
		expect(computeStreak(days, "2026-07-01")).toBe(3);
	});

	it("sıralanmamış girdide de çalışır", () => {
		const days = ["2026-07-21", "2026-07-19", "2026-07-20"];
		expect(computeStreak(days, "2026-07-21")).toBe(3);
	});
});

describe("dayKey", () => {
	it("yerel tarihi sıfır dolgulu biçimde verir", () => {
		expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
	});
});
