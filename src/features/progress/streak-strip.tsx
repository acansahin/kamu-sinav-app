"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { cn } from "@/lib/utils/cn";

/**
 * Günlük seri ve son yedi günün çalışma şeridi.
 *
 * Seri bugüne kadar yalnızca `/istatistik` sayfasının içindeydi; alışkanlık
 * kurmanın en güçlü sinyali kullanıcının her açılışta gördüğü ekranda değildi.
 *
 * Veri `getStreakSummary` ile gelir — `getStatistics` DEĞİL: o tüm `attempts`
 * tablosunu belleğe alıyor ve bu bileşen ana sayfada her açılışta çalışıyor.
 *
 * Seri sıfırsa bileşen HİÇ render edilmez (`review-reminder.tsx` deseni):
 * "0 günlük seri" motive etmez, suçlar. Aynı erken çıkış `useLiveQuery`nin
 * `undefined` dönmesini de kapsar — IndexedDB açılamayan cihazda ana sayfa
 * sonsuz iskeletle donmaz (bkz. AGENTS.md, "Depolama yokluğu").
 */

const GUN_SAYISI = 7;

export function StreakStrip() {
	const data = useLiveQuery(
		() => progressRepository.getStreakSummary(GUN_SAYISI),
		[],
		undefined,
	);

	if (data === undefined || data.streakDays === 0) return null;

	return (
		<Card className="flex items-center gap-4">
			<div className="flex shrink-0 items-center gap-2">
				<Flame aria-hidden size={22} className="text-accent" />
				<p className="text-sm">
					<span className="text-xl font-bold tabular-nums">
						{data.streakDays}
					</span>{" "}
					<span className="text-fg-muted">günlük seri</span>
				</p>
			</div>

			{/*
			 * Renk tek başına anlam taşımaz: her nokta hem `title` (fare) hem
			 * `sr-only` (ekran okuyucu) metniyle ne olduğunu söyler.
			 *
			 * `title` NOKTAYA DEĞİL `<li>`ye konur — `statistics-panel.tsx`
			 * içindeki 28 günlük grafikle aynı sebep: içeriği olmayan bir öğeye
			 * konan `title` o öğenin erişilebilir ADI olur ve ekran okuyucu aynı
			 * cümleyi iki kez söyler.
			 */}
			<ul className="flex flex-1 justify-end gap-1.5">
				{data.activity.map((gun) => {
					const calisildi = gun.answered > 0;
					const tarih = new Date(`${gun.date}T00:00:00`);
					const etiket = tarih.toLocaleDateString("tr-TR", {
						day: "numeric",
						month: "long",
					});

					return (
						<li
							key={gun.date}
							className="flex flex-col items-center gap-1"
							title={`${etiket}: ${gun.answered} soru`}
						>
							<span
								aria-hidden
								className={cn(
									"size-6 rounded-full border",
									calisildi
										? "border-accent bg-accent"
										: "border-line bg-surface-sunken",
								)}
							/>
							<span aria-hidden className="text-xs text-fg-subtle">
								{tarih.toLocaleDateString("tr-TR", { weekday: "short" })}
							</span>
							<span className="sr-only">
								{etiket}: {gun.answered} soru
							</span>
						</li>
					);
				})}
			</ul>
		</Card>
	);
}
