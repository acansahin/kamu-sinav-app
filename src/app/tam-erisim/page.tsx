import type { Metadata } from "next";
import { PurchasePanel } from "@/features/billing/purchase-panel";
import { contentRepository } from "@/lib/repositories/content.repository";

export const metadata: Metadata = {
	title: "Tam Erişim",
	description:
		"Bütün konu özetleri, soru havuzunun tamamı ve deneme sınavları tek seferlik bir ödemeyle kalıcı olarak açılır.",
};

/**
 * Tam erişim sayfası.
 *
 * İçerik sayıları burada, derleme anında okunur ve panele geçirilir: "1051
 * soru" gibi bir vaadin elle yazılması, havuz büyüdükçe sessizce yanlışa
 * dönerdi (`/hakkinda` ile aynı yaklaşım).
 *
 * Fiyat burada YOKTUR — istemcide mağazadan okunur.
 */
export default async function FullAccessPage() {
	const manifest = await contentRepository.getManifest();

	return (
		<div>
			<h1 className="mb-2 text-2xl font-bold">Tam Erişim</h1>
			<p className="mb-6 text-fg-muted">
				Uygulama ücretsiz indirilir ve bir bölümü satın alma olmadan
				kullanılabilir. Tam erişim, içeriğin tamamını kalıcı olarak açar.
			</p>

			<PurchasePanel
				totals={{
					subjects: manifest.totals.subjects,
					topics: manifest.totals.topics,
					questions: manifest.totals.publishedQuestions,
				}}
			/>
		</div>
	);
}
