import { AlertTriangle, Hash, Scale, Star } from "lucide-react";
import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

/**
 * Konu özetlerinde kullanılan vurgu bileşenleri.
 *
 * Yazım sözleşmesi (PROJECT_PLAN.md §5.3):
 *   <Kritik>  mutlaka bilinmesi gereken bilgi
 *   <Sayi>    ezberlenecek süre/oran/sayı
 *   <Tuzak>   sınavda karıştırılan ayrım
 *   <Madde>   mevzuat maddesi referansı (satır içi)
 *
 * Hepsi renkle birlikte ikon ve başlık metni taşır; renk tek başına anlam
 * taşımaz (renk körlüğü ve yüksek kontrast modu gereği).
 */

function Callout({
	tone,
	icon,
	title,
	children,
}: {
	tone: "correct" | "flag" | "brand";
	icon: ReactNode;
	title: string;
	children: ReactNode;
}) {
	const toneClasses = {
		correct: "border-correct/40 bg-correct-soft",
		flag: "border-flag/40 bg-flag-soft",
		brand: "border-brand/40 bg-brand-soft",
	}[tone];

	const titleClasses = {
		correct: "text-correct",
		flag: "text-flag",
		brand: "text-brand",
	}[tone];

	return (
		<aside className={`my-5 rounded-xl border p-4 ${toneClasses}`}>
			<p
				className={`mb-1.5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${titleClasses}`}
			>
				{icon}
				{title}
			</p>
			<div className="text-fg [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
				{children}
			</div>
		</aside>
	);
}

export function Kritik({ children }: { children: ReactNode }) {
	return (
		<Callout
			tone="correct"
			icon={<Star aria-hidden size={16} />}
			title="Kritik bilgi"
		>
			{children}
		</Callout>
	);
}

export function Tuzak({ children }: { children: ReactNode }) {
	return (
		<Callout
			tone="flag"
			icon={<AlertTriangle aria-hidden size={16} />}
			title="Sınav tuzağı"
		>
			{children}
		</Callout>
	);
}

/** Ezberlenmesi gereken sayıları öne çıkarır. */
export function Sayi({ children }: { children: ReactNode }) {
	return (
		<p className="my-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand-soft px-4 py-3 text-lg font-bold text-brand">
			<Hash aria-hidden size={18} className="shrink-0" />
			{children}
		</p>
	);
}

/** Satır içi mevzuat referansı: <Madde kanun="657" no="125" /> */
export function Madde({ kanun, no }: { kanun: string; no: string }) {
	return (
		<span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-sm font-medium text-fg-muted">
			<Scale aria-hidden size={13} className="shrink-0" />
			<span className="sr-only">Mevzuat referansı: </span>
			{kanun} s.K. m.{no}
		</span>
	);
}

export const mdxComponents: MDXComponents = {
	Kritik,
	Tuzak,
	Sayi,
	Madde,
};
