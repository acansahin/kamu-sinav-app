import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { Metadata } from "next";
import { SearchPanel } from "@/features/search/search-panel";
import type { SearchEntry } from "@/types/search";

export const metadata: Metadata = { title: "Arama" };

/**
 * İndeks derleme zamanında okunup sayfaya gömülür.
 *
 * Statik export nedeniyle çalışma anında sunucu yok; gömme, hem alt dizinli
 * yayında hem Capacitor WebView'de aynı şekilde çalışmasını garanti eder.
 */
export default async function SearchPage() {
	const raw = await readFile(
		path.join(process.cwd(), "public", "content", "search-index.json"),
		"utf8",
	);
	const index = JSON.parse(raw) as SearchEntry[];

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Arama</h1>
			<p className="mb-6 text-fg-muted">
				Konu özetleri ve soruların tamamında ara.
			</p>
			<SearchPanel index={index} />
		</div>
	);
}
