import type { Metadata } from "next";
import Link from "next/link";
import { ProgressOverview } from "@/features/progress/progress-overview";
import { getAllTopicRefs } from "@/lib/content/topic-refs";

export const metadata: Metadata = { title: "İlerleme" };

export default async function ProgressPage() {
	const topics = await getAllTopicRefs();

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">İlerleme</h1>
			<p className="mb-4 text-fg-muted">
				Verilerin yalnızca bu cihazda tutulur; hesap gerekmez.
			</p>
			<p className="mb-6">
				<Link href="/istatistik" className="font-medium text-brand underline">
					Ayrıntılı istatistiklere git
				</Link>
			</p>
			<ProgressOverview topics={topics} />
		</div>
	);
}
