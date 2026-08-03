import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatisticsPanel } from "@/features/stats/statistics-panel";
import { contentRepository } from "@/lib/repositories/content.repository";

export const metadata: Metadata = { title: "İstatistikler" };

export default async function StatisticsPage() {
	const manifest = await contentRepository.getManifest();
	const subjectNames = Object.fromEntries(
		manifest.subjects.map((subject) => [subject.id, subject.name]),
	);

	return (
		<div>
			<Breadcrumb items={[{ href: "/ilerleme", label: "İlerleme" }]} />
			<h1 className="mb-1 text-2xl font-bold">İstatistikler</h1>
			<p className="mb-6 text-fg-muted">
				Zaman içindeki gelişimin ve hangi konularda nerede durduğun.
			</p>
			<StatisticsPanel subjectNames={subjectNames} />
		</div>
	);
}
