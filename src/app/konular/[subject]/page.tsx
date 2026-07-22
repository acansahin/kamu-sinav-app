import { ArrowRight, FileText, Lock, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardLink } from "@/components/ui/card";
import { contentRepository } from "@/lib/repositories/content.repository";
import { routes } from "@/lib/routes";

interface Props {
	params: Promise<{ subject: string }>;
}

/** Statik export: tüm ders sayfaları derleme zamanında üretilir. */
export async function generateStaticParams() {
	const subjects = await contentRepository.getSubjects();
	return subjects.map((subject) => ({ subject: subject.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { subject: subjectId } = await params;
	const subject = await contentRepository.getSubject(subjectId);
	return { title: subject?.name ?? "Ders" };
}

export default async function SubjectPage({ params }: Props) {
	const { subject: subjectId } = await params;
	const subject = await contentRepository.getSubject(subjectId);
	if (!subject) notFound();

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">{subject.name}</h1>
			<p className="mb-4 text-fg-muted">{subject.description}</p>

			{subject.topics.some((topic) => topic.hasSummary) && (
				<p className="mb-6">
					<Link
						href={routes.subjectPrint(subject.id)}
						className="inline-flex min-h-11 items-center gap-2 font-medium text-brand underline"
					>
						<Printer aria-hidden size={16} />
						Dersin tamamını yazdır veya PDF kaydet
					</Link>
				</p>
			)}

			<ul className="space-y-3">
				{subject.topics.map((topic) => {
					const href = routes.topic(subject.id, topic.slug);

					// İçeriği hazır olmayan konu tıklanabilir görünmemeli:
					// boş sayfaya götüren bağlantı, olmayan bağlantıdan kötüdür.
					if (!topic.hasSummary) {
						return (
							<li key={topic.id}>
								<Card className="flex items-center gap-3 opacity-70">
									<Lock aria-hidden size={18} className="shrink-0 text-fg-subtle" />
									<div>
										<h2 className="font-semibold text-fg-muted">{topic.name}</h2>
										<p className="text-sm text-fg-subtle">
											Özet hazırlanıyor
										</p>
									</div>
								</Card>
							</li>
						);
					}

					return (
						<li key={topic.id}>
							<CardLink href={href} className="flex items-center gap-3">
								<FileText aria-hidden size={18} className="shrink-0 text-brand" />
								<div className="min-w-0 flex-1">
									<h2 className="font-semibold">{topic.name}</h2>
									<p className="text-sm text-fg-muted">
										~{topic.estimatedMinutes} dk okuma · {topic.questionCount} soru
									</p>
								</div>
								<ArrowRight aria-hidden size={18} className="shrink-0 text-fg-subtle" />
							</CardLink>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
