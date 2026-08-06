import { Clock, FileText } from "lucide-react";
import type { Metadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/content/mdx-components";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { AccessGate } from "@/features/billing/access-gate";
import { PrintButton } from "@/features/print/print-button";
import { SummaryDocument } from "@/features/study/summary-document";
import { SummaryReader } from "@/features/study/summary-reader";
import { TopicReadActions } from "@/features/study/topic-read-actions";
import { contentRepository } from "@/lib/repositories/content.repository";
import { routes } from "@/lib/routes";

interface Props {
	params: Promise<{ subject: string; topic: string }>;
}

/**
 * Statik export: özeti olan her konu derleme zamanında HTML'e dönüştürülür.
 * Böylece MDX derleyicisi istemciye hiç gitmez ve sayfa çevrimdışı açılır.
 */
export async function generateStaticParams() {
	const subjects = await contentRepository.getSubjects();
	return subjects.flatMap((subject) =>
		subject.topics
			.filter((topic) => topic.hasSummary)
			.map((topic) => ({ subject: subject.id, topic: topic.slug })),
	);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { subject, topic } = await params;
	const found = await contentRepository.getTopic(subject, topic);
	return { title: found?.name ?? "Konu" };
}

export default async function TopicPage({ params }: Props) {
	const { subject: subjectId, topic: topicSlug } = await params;

	const [subject, topic, summary] = await Promise.all([
		contentRepository.getSubject(subjectId),
		contentRepository.getTopic(subjectId, topicSlug),
		contentRepository.getSummary(subjectId, topicSlug),
	]);

	if (!subject || !topic || !summary) notFound();

	const { content } = await compileMDX({
		source: summary.body,
		components: mdxComponents,
		// GFM olmadan tablolar ham "| a | b |" metni olarak kalır. Konu özetleri
		// tablo ağırlıklı yazıldığı için bu eklenti zorunludur.
		options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
	});

	return (
		<article>
			<Breadcrumb
				items={[
					{ href: "/konular", label: "Konular" },
					{ href: routes.subject(subject.id), label: subject.shortName },
				]}
			/>

			<div data-print="hide" className="mb-4 flex flex-wrap items-center gap-2">
				<Badge>
					<Clock aria-hidden size={14} />~{summary.readingMinutes} dk okuma
				</Badge>
				<Badge tone="brand">{topic.questionCount} soru</Badge>
			</div>

			{/*
			 * Konum çubuğu ve rozetler kapının DIŞINDA: kilitli bir konuya derin
			 * bağlantıyla gelen kullanıcı nerede olduğunu ve nereye dönebileceğini
			 * görmeli. Kilitlenen şey özetin gövdesi ve okuma eylemleridir.
			 */}
			<AccessGate rule={{ kind: "topic", subjectId: subject.id, topicSlug: topic.slug }}>
				{/*
				 * Sesli okuma kapının İÇİNDE: kilitli bir özeti sesli çıkarmak
				 * paywall'ı tamamen atlardı (aramada soru sonuçları aynı gerekçeyle
				 * kapalı). Kilitliyken okunacak DOM da zaten mount edilmiyor.
				 */}
				<SummaryReader subjectId={subject.id} topicId={topic.id}>
					<SummaryDocument summary={summary}>{content}</SummaryDocument>
				</SummaryReader>

				<div data-print="hide" className="mt-8 flex flex-wrap gap-3">
					<PrintButton />
					<ButtonLink
						href={routes.subjectPrint(subject.id)}
						variant="secondary"
					>
						<FileText aria-hidden size={18} />
						Dersin tamamını yazdır
					</ButtonLink>
				</div>

				<TopicReadActions
					subjectId={subject.id}
					topicId={topic.id}
					topicSlug={topic.slug}
					questionCount={topic.questionCount}
				/>
			</AccessGate>
		</article>
	);
}
