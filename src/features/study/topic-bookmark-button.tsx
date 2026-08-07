"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { progressRepository } from "@/lib/repositories/progress.repository";

/**
 * Konuyu yer imine ekler/çıkarır.
 *
 * Yer imi altyapısı (`toggleBookmark`, mezar taşlı silme, senkron eşlemesi)
 * yazılmıştı ama arayüzde tek bir çağrı yeri yoktu; bu, o altyapının ilk
 * kullanıcısı. Kaydedilenler `/konular` sayfasının üstünde listelenir.
 *
 * Etiket durumu SÖYLER ("Yer imine ekle" ↔ "Yer imlerinde"): renk ve ikon tek
 * başına anlam taşımaz. `aria-pressed` kullanılmıyor — `speech-player.tsx`
 * ile aynı gerekçe, değişen etiket zaten durumu duyuruyor.
 */
export function TopicBookmarkButton({ topicId }: { topicId: string }) {
	const [saving, setSaving] = useState(false);

	const bookmarked = useLiveQuery(
		() => progressRepository.isBookmarked("topic", topicId),
		[topicId],
		undefined,
	);

	async function toggle() {
		setSaving(true);
		try {
			await progressRepository.toggleBookmark("topic", topicId);
		} finally {
			setSaving(false);
		}
	}

	// Durum bilinmeden düğme gösterilmez: yanlış etiketle çizip sonra
	// değiştirmek, kullanıcıya kaydettiğini geri alıyormuş gibi görünürdü.
	if (bookmarked === undefined) return null;

	return (
		<Button
			data-print="hide"
			data-tts="skip"
			variant="secondary"
			size="sm"
			onClick={toggle}
			disabled={saving}
		>
			{bookmarked ? (
				<BookmarkCheck aria-hidden size={16} className="text-brand" />
			) : (
				<Bookmark aria-hidden size={16} />
			)}
			{bookmarked ? "Yer imlerinde" : "Yer imine ekle"}
		</Button>
	);
}
