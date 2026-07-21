import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "brand" | "correct" | "wrong" | "flag";

const TONE_CLASSES: Record<Tone, string> = {
	neutral: "border-line bg-surface-sunken text-fg-muted",
	brand: "border-brand/40 bg-brand-soft text-brand",
	correct: "border-correct/40 bg-correct-soft text-correct",
	wrong: "border-wrong/40 bg-wrong-soft text-wrong",
	flag: "border-flag/40 bg-flag-soft text-flag",
};

export function Badge({
	children,
	tone = "neutral",
	className,
}: {
	children: ReactNode;
	tone?: Tone;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium",
				TONE_CLASSES[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}
