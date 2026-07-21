import { cn } from "@/lib/utils/cn";

/**
 * İlerleme çubuğu.
 *
 * Renk tek başına anlam taşımaz: yüzde değeri her zaman metin olarak da
 * sunulur ve `aria-valuenow` ekran okuyucuya aktarılır.
 */
export function ProgressBar({
	value,
	max = 100,
	label,
	tone = "brand",
	className,
}: {
	value: number;
	max?: number;
	label: string;
	tone?: "brand" | "correct" | "wrong";
	className?: string;
}) {
	const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
	const toneClass =
		tone === "correct"
			? "bg-correct"
			: tone === "wrong"
				? "bg-wrong"
				: "bg-brand";

	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuenow={Math.round(pct)}
			aria-valuemin={0}
			aria-valuemax={100}
			className={cn(
				"h-2 w-full overflow-hidden rounded-full bg-surface-sunken",
				className,
			)}
		>
			<div
				className={cn("h-full rounded-full transition-[width]", toneClass)}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}
