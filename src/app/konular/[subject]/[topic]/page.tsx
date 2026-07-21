import { CalendarCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/content/mdx-components";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TopicReadActions } from "@/features/study/topic-read-actions";
import { contentRepository } from "@/lib/repositories/content.repository";

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
			<nav aria-label="Konum" className="mb-4 text-sm text-fg-muted">
				<Link href="/konular" className="hover:text-fg">
					Konular
				</Link>
				<span aria-hidden> / </span>
				<Link href={`/konular/${subject.id}`} className="hover:text-fg">
					{subject.shortName}
				</Link>
			</nav>

			<h1 className="text-3xl font-bold tracking-tight">{summary.title}</h1>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<Badge>
					<Clock aria-hidden size={14} />~{summary.readingMinutes} dk okuma
				</Badge>
				<Badge tone="brand">{topic.questionCount} soru</Badge>
			</div>

			{/*
			 * Güven rozeti — rakiplerin en büyük açığı içeriğin bayatlaması.
			 * Kullanıcı hangi mevzuat sürümüne baktığını her zaman görür.
			 * Bkz. PROJECT_PLAN.md §4, taahhüt 4.
			 */}
			<p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-sm text-fg-muted">
				<CalendarCheck aria-hidden size={15} className="shrink-0" />
				<span>
					<strong className="font-semibold text-fg">
						{summary.legislationVersion}
					</strong>
					{" · "}
					Son doğrulama:{" "}
					{new Date(summary.lastVerifiedAt).toLocaleDateString("tr-TR", {
						day: "numeric",
						month: "long",
						year: "numeric",
					})}
				</span>
			</p>

			<Card className="mt-6 border-brand/40 bg-brand-soft">
				<h2 className="mb-2 text-base font-bold text-brand">Bir bakışta</h2>
				<ul className="list-disc space-y-1.5 ps-5 text-fg">
					{summary.keyPoints.map((point) => (
						<li key={point}>{point}</li>
					))}
				</ul>
			</Card>

			<div className="prose-okuma mt-8">{content}</div>

			<TopicReadActions
				subjectId={subject.id}
				topicId={topic.id}
				topicSlug={topic.slug}
				questionCount={topic.questionCount}
			/>
		</article>
	);
}
