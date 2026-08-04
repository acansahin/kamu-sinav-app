import { BookOpen, Compass, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { CardLink } from "@/components/ui/card";

export const metadata: Metadata = {
	title: "Sayfa bulunamadı",
};

/**
 * Türkçe 404.
 *
 * Statik export'ta bu dosya `out/404.html` olur ve iki ayrı yolu birden
 * karşılar: `notFound()` çağıran sayfalar (kaldırılmış bir ders veya konu
 * kimliği) ile hiç eşleşmeyen URL'ler. Next.js'in yerleşik 404'ü İngilizce,
 * markasız ve dönüş bağlantısızdır — APK'da adres çubuğu olmadığı için oradan
 * çıkış yolu kalmaz.
 *
 * Sunucu bileşenidir: hiçbir durum tutmuyor, bu yüzden istemciye JS inmesin.
 */
export default function NotFound() {
	return (
		<div className="mx-auto max-w-lg py-12 text-center">
			<Compass
				aria-hidden
				size={48}
				className="mx-auto mb-4 text-fg-muted"
				strokeWidth={1.5}
			/>
			<h1 className="mb-3 text-2xl font-bold">Sayfa bulunamadı</h1>
			<p className="mb-6 text-fg-muted">
				Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir. Aşağıdan devam
				edebilirsiniz.
			</p>

			<ButtonLink href="/" block className="mb-6">
				Ana sayfaya dön
			</ButtonLink>

			<div className="grid gap-3 text-left sm:grid-cols-2">
				<CardLink href="/konular" className="flex items-center gap-3">
					<BookOpen aria-hidden size={22} className="shrink-0 text-brand" />
					<span>
						<span className="block font-semibold">Konular</span>
						<span className="block text-sm text-fg-muted">
							Ders ve konu özetleri
						</span>
					</span>
				</CardLink>
				<CardLink href="/testler" className="flex items-center gap-3">
					<ListChecks aria-hidden size={22} className="shrink-0 text-brand" />
					<span>
						<span className="block font-semibold">Testler</span>
						<span className="block text-sm text-fg-muted">
							Konu testleri ve denemeler
						</span>
					</span>
				</CardLink>
			</div>
		</div>
	);
}
