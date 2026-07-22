"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, CalendarClock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { progressRepository } from "@/lib/repositories/progress.repository";

/**
 * Ana sayfadaki tekrar hatırlatması.
 *
 * Vadesi gelen tekrar yoksa hiç görünmez: boş bir "0 tekrar" kartı yer kaplar
 * ve kullanıcıyı yanıltır.
 */
export function ReviewReminder() {
	const summary = useLiveQuery(
		() => progressRepository.getReviewSummary(),
		[],
		undefined,
	);

	if (!summary || summary.due === 0) return null;

	return (
		<Card className="flex flex-wrap items-center justify-between gap-4 border-flag/40 bg-flag-soft">
			<div className="flex items-center gap-3">
				<CalendarClock aria-hidden size={22} className="shrink-0 text-flag" />
				<div>
					<p className="font-bold">
						Bugün {summary.due} tekrarın var
					</p>
					<p className="text-sm text-fg-muted">
						Unutmadan önce hatırlamak, yeniden öğrenmekten hızlıdır.
					</p>
				</div>
			</div>
			<ButtonLink href="/yanlislarim">
				Tekrara başla
				<ArrowRight aria-hidden size={18} />
			</ButtonLink>
		</Card>
	);
}
