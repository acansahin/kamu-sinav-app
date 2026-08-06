import { CalendarCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import type { SummaryDoc } from "@/types/content";

/**
 * Bir konu özetinin yazdırılabilir gövdesi.
 *
 * Hem tek konu sayfası hem ders paketi bunu kullanır; böylece ekranda görülen
 * ile kâğıda basılan aynı olur. Derlenmiş MDX içeriği `children` olarak gelir,
 * çünkü derleme asenkron ve sayfa seviyesinde yapılır.
 */
export function SummaryDocument({
	summary,
	children,
	headingLevel = "h1",
}: {
	summary: SummaryDoc;
	children: ReactNode;
	/** Ders paketinde her konu h2 olur, tek konu sayfasında h1. */
	headingLevel?: "h1" | "h2";
}) {
	const Heading = headingLevel;

	return (
		<>
			<Heading className="text-3xl font-bold tracking-tight">
				{summary.title}
			</Heading>

			{/*
			 * Güven damgası kâğıda da basılır: elden ele dolaşan bir çıktının
			 * hangi mevzuat sürümüne ait olduğu görünmezse, bayatladığında
			 * kimse fark etmez.
			 *
			 * Sesli okumada ise ATLANIR (`data-tts="skip"`): her dinlemenin
			 * başında "5 Ağustos 2026" gibi bir tarih duymak akışı bozar ve
			 * bilgi ekranda zaten görünür. Niteliği kaldırmayın — sözleşme
			 * `tests/unit/speech-extract.test.tsx` içinde sabitlenmiştir.
			 */}
			<p
				data-tts="skip"
				className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 text-sm text-fg-muted"
			>
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

			{/*
			 * `data-tts="body"` derlenmiş MDX gövdesini işaretler. Sesli
			 * okumadaki "gövdedeki `## Bir bakışta` bölümünü atla" kuralı
			 * YALNIZCA bu kapsamda uygulanır: yukarıdaki kartın başlığı da aynı
			 * metni taşıyor ve kural kapsamlanmasaydı ikisi birden atlanır,
			 * hiçbir konuda özet duyulmazdı.
			 */}
			<div data-tts="body" className="prose-okuma mt-8">
				{children}
			</div>
		</>
	);
}
