import { type VariantProps, cva } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Buton.
 *
 * Erişilebilirlik sözleşmesi (PROJECT_PLAN.md §13.2):
 *  - Dokunma hedefi en az 44px (min-h-11) — WCAG asgarisi 24px, yaş profili
 *    nedeniyle yükseltildi.
 *  - Odak halkası globals.css'teki :focus-visible kuralından gelir; burada
 *    outline-none KULLANILMAZ.
 */
const buttonVariants = cva(
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary: "bg-brand text-brand-fg hover:bg-brand-hover",
				secondary:
					"border border-line-strong bg-surface-raised text-fg hover:bg-surface-sunken",
				ghost: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
				danger: "border border-wrong bg-surface-raised text-wrong hover:bg-wrong-soft",
				/*
				 * Gradyan kahraman yüzeyin üstünde duran buton. Yüzey her iki
				 * temada da derin lacivert kaldığı için renkleri surface/brand
				 * token'larından ALINAMAZ — koyu temada ikisi de ters döner ve
				 * buton zemine gömülür. Bkz. globals.css → --gradient-btn-fg.
				 */
				kahraman:
					"bg-[color:var(--gradient-fg)] text-[color:var(--gradient-btn-fg)] hover:opacity-90",
			},
			size: {
				md: "",
				lg: "min-h-14 px-6 text-lg",
				sm: "min-h-11 px-3 text-sm",
			},
			block: { true: "w-full", false: "" },
		},
		defaultVariants: { variant: "primary", size: "md", block: false },
	},
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

export function Button({
	className,
	variant,
	size,
	block,
	...props
}: ComponentProps<"button"> & ButtonVariants) {
	return (
		<button
			className={cn(buttonVariants({ variant, size, block }), className)}
			{...props}
		/>
	);
}

export function ButtonLink({
	className,
	variant,
	size,
	block,
	...props
}: ComponentProps<typeof Link> & ButtonVariants) {
	return (
		<Link
			className={cn(buttonVariants({ variant, size, block }), className)}
			{...props}
		/>
	);
}
