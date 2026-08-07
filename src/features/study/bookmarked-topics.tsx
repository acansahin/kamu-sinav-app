"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { BookmarkCheck } from "lucide-react";
import { CardLink, SectionHeading } from "@/components/ui/card";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { routes } from "@/lib/routes";
import type { TopicRef } from "@/types/ui";

/**
 * `/konular` sayfasının üstündeki "Yer imlerin" bölümü.
 *
 * Yer imi kaydı yalnızca `topicId` tutar; ad ve rota için içerik tarafı
 * gerekir. Sayfa bir sunucu bileşeni olduğundan konular `topics` prop'uyla
 * geliyor — `ContinueCard`ın `getAllTopicRefs()` çıktısını aldığı desenin
 * aynısı.
 *
 * Yer imi yoksa (ya da IndexedDB açılamadıysa) bölüm HİÇ render edilmez;
 * `review-reminder.tsx` deseni. Boş bir "yer imlerin yok" kartı, hiç
 * kullanmayan kullanıcıya her açılışta gösterilecek kalıcı bir gürültüdür.
 */
export function BookmarkedTopics({ topics }: { topics: TopicRef[] }) {
	const bookmarks = useLiveQuery(
		() => progressRepository.getBookmarks("topic"),
		[],
		undefined,
	);

	if (bookmarks === undefined || bookmarks.length === 0) return null;

	const byId = new Map(topics.map((t) => [t.topicId, t]));
	// İçerikten kalkmış bir konunun yer imi kalabilir; satır silinmez, yalnızca
	// listede gösterilmez.
	const kayitli = bookmarks
		.map((b) => byId.get(b.refId))
		.filter((t): t is TopicRef => t !== undefined);

	if (kayitli.length === 0) return null;

	return (
		<section className="mb-8">
			<SectionHeading>Yer imlerin</SectionHeading>
			<ul className="grid gap-3 sm:grid-cols-2">
				{kayitli.map((topic) => (
					<li key={topic.topicId}>
						<CardLink
							href={routes.topic(topic.subjectId, topic.topicSlug)}
							className="flex h-full items-start gap-3"
						>
							<BookmarkCheck
								aria-hidden
								size={18}
								className="mt-0.5 shrink-0 text-brand"
							/>
							<span className="min-w-0">
								<span className="block font-semibold">{topic.topicName}</span>
								<span className="block text-sm text-fg-muted">
									{topic.subjectName}
								</span>
							</span>
						</CardLink>
					</li>
				))}
			</ul>
		</section>
	);
}
