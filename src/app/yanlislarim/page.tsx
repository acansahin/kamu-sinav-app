import type { Metadata } from "next";
import { ReviewCenter } from "@/features/review/review-center";
import { getAllTopicRefs } from "@/lib/content/topic-refs";
import { contentRepository } from "@/lib/repositories/content.repository";

export const metadata: Metadata = { title: "Yanlışlarım ve Tekrar" };

export default async function ReviewPage() {
	const [pool, topics] = await Promise.all([
		contentRepository.getAllQuestions(),
		getAllTopicRefs(),
	]);

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Yanlışlarım ve Tekrar</h1>
			<p className="mb-6 text-fg-muted">
				Sorular unutma eğrisine göre geri gelir: doğru bildiklerin seyrekleşir,
				zorlandıkların sık sık karşına çıkar.
			</p>
			<ReviewCenter pool={pool} topics={topics} />
		</div>
	);
}
