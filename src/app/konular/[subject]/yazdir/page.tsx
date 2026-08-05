import type { Metadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/content/mdx-components";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card } from "@/components/ui/card";
import { AccessGate } from "@/features/billing/access-gate";
import { PrintButton } from "@/features/print/print-button";
import { SummaryDocument } from "@/features/study/summary-document";
import { contentRepository } from "@/lib/repositories/content.repository";
import { routes } from "@/lib/routes";

interface Props {
	params: Promise<{ subject: string }>;
}

export async function generateStaticParams() {
	const subjects = await contentRepository.getSubjects();
	return subjects
		.filter((subject) => subject.topics.some((topic) => topic.hasSummary))
		.map((subject) => ({ subject: subject.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { subject: subjectId } = await params;
	const subject = await contentRepository.getSubject(subjectId);
	return { title: subject ? `${subject.name} — Yazdır` : "Yazdır" };
}

/**
 * Ders paketi: bir dersin tüm konu özetleri tek belgede.
 *
 * PDF için ayrı bir kütüphane yoktur; sayfa yazdırma için tasarlanmıştır ve
 * kullanıcı tarayıcının "PDF olarak kaydet" seçeneğini kullanır. Türkçe
 * karakterler ve tablolar font gömmeye gerek kalmadan doğru basılır.
 */
export default async function SubjectPrintPage({ params }: Props) {
	const { subject: subjectId } = await params;
	const subject = await contentRepository.getSubject(subjectId);
	if (!subject) notFound();

	const printable = subject.topics.filter((topic) => topic.hasSummary);
	if (printable.length === 0) notFound();

	// Tüm özetler derleme zamanında derlenir; çalışma anında iş yapılmaz.
	const documents = await Promise.all(
		printable.map(async (topic) => {
			const summary = await contentRepository.getSummary(subject.id, topic.slug);
			if (!summary) return null;

			const { content } = await compileMDX({
				source: summary.body,
				components: mdxComponents,
				options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
			});
			return { topic, summary, content };
		}),
	);

	const lastVerified = documents
		.filter((doc) => doc !== null)
		.map((doc) => doc.summary.lastVerifiedAt)
		.sort()
		.at(0);

	return (
		<div>
			<div data-print="hide" className="mb-8">
				<Breadcrumb
					items={[
						{ href: "/konular", label: "Konular" },
						{ href: routes.subject(subject.id), label: subject.shortName },
					]}
				/>

				<h1 className="text-2xl font-bold">{subject.name} — Ders Paketi</h1>
				<p className="mt-1 text-fg-muted">
					{printable.length} konu özeti tek belgede. Yazdırma penceresinde hedef
					olarak &ldquo;PDF olarak kaydet&rdquo;i seçerek dosya olarak
					indirebilirsin.
				</p>
			</div>

			{/*
			 * Ücretsiz derste bile kilitli: bu sayfa dersin TÜM konu özetlerini
			 * basar, yani ücretsiz konunun yanında kilitli olanları da içerir.
			 * Yazdırma butonu da kapının içinde — kilitliyken basılacak bir belge
			 * yok.
			 */}
			<AccessGate rule={{ kind: "print" }}>
				<Card data-print="hide" className="mb-8 flex flex-wrap items-center justify-between gap-4">
					<p className="text-sm text-fg-muted">
						Her konu yeni sayfada başlar. Çıktıda menüler ve butonlar yer almaz.
					</p>
					<PrintButton variant="primary" label="Yazdır veya PDF kaydet" />
				</Card>

				{/* Kâğıda basılan kısım buradan başlar */}
				<header className="mb-10">
					<h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
					<p className="mt-2 text-fg-muted">{subject.description}</p>
					{lastVerified && (
						<p className="mt-3 text-sm text-fg-subtle">
							Bu paketteki en eski doğrulama tarihi:{" "}
							{new Date(lastVerified).toLocaleDateString("tr-TR", {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}{" "}
							· Kamu Sınav Akademi
						</p>
					)}
				</header>

				{documents.map((doc) =>
					doc === null ? null : (
						<article
							key={doc.topic.id}
							data-print="page-break"
							className="mb-16 border-t border-line pt-8 first:border-t-0 first:pt-0"
						>
							<SummaryDocument summary={doc.summary} headingLevel="h2">
								{doc.content}
							</SummaryDocument>
						</article>
					),
				)}
			</AccessGate>
		</div>
	);
}
