import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Halka biçimli ilerleme göstergesi.
 *
 * Grafik kütüphanesi EKLENMEZ — tek bir `<circle>` ve `stroke-dasharray`
 * yeterli. `features/stats/statistics-panel.tsx` içindeki 28 günlük sütun
 * grafiği de aynı yaklaşımla elle yazılmıştır.
 *
 * Erişilebilirlik sözleşmesi `progress-bar.tsx` ile aynıdır ve gevşetilemez:
 * renk tek başına anlam taşımaz, bu yüzden yüzde HER ZAMAN halkanın ortasında
 * metin olarak da görünür; `role="progressbar"` ve zorunlu `label` ekran
 * okuyucuya değeri aktarır.
 *
 * Ölçüler rem tabanlıdır: yazı boyutu tercihi (`data-font-scale`) değiştiğinde
 * halka da birlikte büyür. Sabit piksel vermek onu geride bırakırdı.
 */

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BOYUTLAR = {
	sm: { kutu: "size-14", yazi: "text-sm font-semibold" },
	md: { kutu: "size-20", yazi: "text-lg font-bold" },
	lg: { kutu: "size-24", yazi: "text-xl font-bold" },
} as const;

/**
 * Ton, hem dolgu hem İZ rengini belirler. `gradyan` tonu kahraman yüzeyler
 * içindir: orada `--surface-sunken` izi zemine karışır, dolgu rengi olarak
 * `--brand` ise koyu temada açık maviye dönüp gradyanın üstünde kaybolur.
 */
const TONLAR = {
	brand: { iz: "stroke-surface-sunken", dolgu: "stroke-brand" },
	correct: { iz: "stroke-surface-sunken", dolgu: "stroke-correct" },
	wrong: { iz: "stroke-surface-sunken", dolgu: "stroke-wrong" },
	accent: { iz: "stroke-surface-sunken", dolgu: "stroke-accent" },
	gradyan: {
		iz: "stroke-[color:var(--gradient-fg)] opacity-25",
		dolgu: "stroke-[color:var(--gradient-fg)]",
	},
} as const;

export function ProgressRing({
	value,
	max = 100,
	label,
	tone = "brand",
	size = "md",
	display,
	className,
}: {
	value: number;
	max?: number;
	/** Ekran okuyucunun duyacağı açıklama. Zorunlu. */
	label: string;
	tone?: keyof typeof TONLAR;
	size?: keyof typeof BOYUTLAR;
	/** Ortadaki metin. Verilmezse yuvarlanmış yüzde yazılır. */
	display?: ReactNode;
	className?: string;
}) {
	const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
	const { kutu, yazi } = BOYUTLAR[size];
	const { iz, dolgu } = TONLAR[tone];

	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuenow={Math.round(pct)}
			aria-valuemin={0}
			aria-valuemax={100}
			className={cn("relative shrink-0", kutu, className)}
		>
			<svg
				viewBox="0 0 100 100"
				className="size-full -rotate-90"
				aria-hidden="true"
			>
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					strokeWidth="10"
					className={iz}
				/>
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					strokeWidth="10"
					strokeLinecap="round"
					strokeDasharray={CIRCUMFERENCE}
					strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
					className={cn(
						"transition-[stroke-dashoffset] duration-300 ease-[var(--ease-cikis)]",
						dolgu,
					)}
				/>
			</svg>
			<span
				className={cn(
					"absolute inset-0 flex items-center justify-center tabular-nums",
					yazi,
				)}
			>
				{display ?? `%${Math.round(pct)}`}
			</span>
		</div>
	);
}
