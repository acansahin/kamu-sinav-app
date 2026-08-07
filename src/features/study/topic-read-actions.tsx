"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, ListChecks, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";

/**
 * Konu okuma ekranının alt aksiyon çubuğu.
 *
 * Öğrenme döngüsünün dönüm noktası burasıdır: özet bitince kullanıcı boşlukta
 * bırakılmaz, doğrudan o konunun testine yönlendirilir
 * (PROJECT_PLAN.md §12.2).
 */
export function TopicReadActions({
	subjectId,
	topicId,
	topicSlug,
	questionCount,
}: {
	subjectId: string;
	topicId: string;
	topicSlug: string;
	questionCount: number;
}) {
	const [saving, setSaving] = useState(false);

	const progress = useLiveQuery(
		() => progressRepository.getTopicProgress(topicId),
		[topicId],
		undefined,
	);
	const isRead = progress?.summaryRead ?? false;

	async function markRead() {
		setSaving(true);
		try {
			await progressRepository.markSummaryRead(subjectId, topicId);
		} finally {
			setSaving(false);
		}
	}

	/*
	 * Geri alma, işaretin OTOMATİK de konabilmesiyle birlikte geldi
	 * (`summary-reader.tsx`): sona kaydırıp geçen kullanıcı istemediği bir
	 * durumla kalmamalı. Elle basılmış işaret için de aynı yol açık.
	 */
	async function unmarkRead() {
		setSaving(true);
		try {
			await progressRepository.unmarkSummaryRead(topicId);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			data-print="hide"
			className="mt-10 flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:flex-row sm:items-center"
		>
			{isRead ? (
				<div className="flex min-h-11 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
					<p className="flex items-center gap-2 font-medium text-correct">
						<Check aria-hidden size={20} />
						Bu konuyu okudun
					</p>
					<Button
						variant="ghost"
						size="sm"
						onClick={unmarkRead}
						disabled={saving}
					>
						<Undo2 aria-hidden size={16} />
						Geri al
					</Button>
				</div>
			) : (
				<Button
					variant="secondary"
					onClick={markRead}
					disabled={saving}
					className="flex-1"
				>
					<Check aria-hidden size={20} />
					{saving ? "Kaydediliyor…" : "Okudum olarak işaretle"}
				</Button>
			)}

			{questionCount > 0 ? (
				<ButtonLink
					href={routes.topicTest(subjectId, topicSlug)}
					className="flex-1"
				>
					<ListChecks aria-hidden size={20} />
					Bu konuyu test et
				</ButtonLink>
			) : (
				<p className="flex-1 text-sm text-fg-subtle">
					Bu konunun soruları henüz hazırlanıyor.
				</p>
			)}
		</div>
	);
}
