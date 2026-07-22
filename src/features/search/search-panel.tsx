"use client";

import { BookOpen, ListChecks, Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import {
	extractSnippet,
	foldForSearch,
	matchesAllTokens,
	tokenize,
} from "@/lib/search/normalize";
import type { SearchEntry } from "@/types/search";

const MAX_RESULTS = 40;

/**
 * Global arama.
 *
 * İndeks sayfaya gömülür, çalışma anında indirilmez. Sebep mimari: uygulama
 * hem alt dizinli GitHub Pages'te hem kökten servis eden Capacitor WebView'de
 * çalışıyor; bir fetch URL'sini her iki ortamda da doğru kurmak kırılgan
 * olurdu. Gömülü indeks her yerde aynı davranır ve çevrimdışı çalışır.
 */
export function SearchPanel({ index }: { index: SearchEntry[] }) {
	const [query, setQuery] = useState("");
	const inputId = useId();

	// Yazarken her tuşta 225 kayıt taranmasın; React girişi öncelikli tutar.
	const deferredQuery = useDeferredValue(query);

	// Normalleştirme bir kez yapılır, her aramada değil.
	const haystacks = useMemo(
		() =>
			index.map((entry) => ({
				entry,
				haystack: foldForSearch(`${entry.title} ${entry.context} ${entry.body}`),
			})),
		[index],
	);

	const tokens = useMemo(() => tokenize(deferredQuery), [deferredQuery]);

	const results = useMemo(() => {
		if (tokens.length === 0) return [];
		return haystacks
			.filter((item) => matchesAllTokens(item, tokens))
			// Konu özetleri önce: kullanıcı bir kavramı aradığında önce
			// açıklamasını, sonra o kavramı ölçen soruları görmek ister.
			.sort((a, b) =>
				a.entry.kind === b.entry.kind ? 0 : a.entry.kind === "topic" ? -1 : 1,
			)
			.slice(0, MAX_RESULTS);
	}, [haystacks, tokens]);

	const searched = tokens.length > 0;

	return (
		<div>
			<label htmlFor={inputId} className="block font-semibold">
				Ne arıyorsun?
			</label>
			<div className="relative mt-2">
				<Search
					aria-hidden
					size={20}
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
				/>
				<input
					id={inputId}
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="disiplin cezası, izin süresi, etik kurul…"
					autoComplete="off"
					className="min-h-14 w-full rounded-xl border-2 border-line bg-surface-raised py-2 pe-4 ps-11 text-base"
				/>
			</div>
			<p className="mt-2 text-sm text-fg-muted">
				Türkçe karakter kullanmasan da bulur: &ldquo;cezalari&rdquo; yazmak
				&ldquo;cezaları&rdquo; için yeterli.
			</p>

			<div aria-live="polite" className="mt-6">
				{!searched ? (
					<p className="text-fg-subtle">
						{index.length} konu ve soru arasında arama yapabilirsin.
					</p>
				) : results.length === 0 ? (
					<Card className="text-center">
						<p className="font-semibold">Sonuç bulunamadı</p>
						<p className="mt-1 text-sm text-fg-muted">
							Farklı bir kelime deneyebilir veya kelime sayısını azaltabilirsin.
							Arama, yazdığın kelimelerin <strong>tümünü</strong> içeren
							sonuçları gösterir.
						</p>
					</Card>
				) : (
					<>
						<p className="mb-3 text-sm text-fg-muted">
							{results.length}
							{results.length === MAX_RESULTS && "+"} sonuç
						</p>
						<ul className="space-y-3">
							{results.map(({ entry }) => {
								const isTopic = entry.kind === "topic";
								const href = isTopic
									? routes.topic(entry.subjectId, entry.topicSlug)
									: routes.topicTest(entry.subjectId, entry.topicSlug);

								return (
									<li key={`${entry.kind}-${entry.id}`}>
										<Link
											href={href}
											className="block rounded-xl border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong hover:bg-surface-sunken"
										>
											<div className="mb-1.5 flex flex-wrap items-center gap-2">
												<Badge tone={isTopic ? "brand" : "neutral"}>
													{isTopic ? (
														<BookOpen aria-hidden size={13} />
													) : (
														<ListChecks aria-hidden size={13} />
													)}
													{isTopic ? "Konu özeti" : "Soru"}
												</Badge>
												<span className="text-sm text-fg-subtle">
													{entry.context}
												</span>
											</div>
											<p className="font-semibold leading-relaxed">
												{entry.title}
											</p>
											<p className="mt-1 text-sm leading-relaxed text-fg-muted">
												{extractSnippet(entry.body, tokens)}
											</p>
										</Link>
									</li>
								);
							})}
						</ul>
					</>
				)}
			</div>
		</div>
	);
}
