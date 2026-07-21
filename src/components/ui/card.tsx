import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"rounded-xl border border-line bg-surface-raised p-5",
				className,
			)}
			{...props}
		/>
	);
}

/** Tamamı tıklanabilir kart. Odak halkası kartın tamamını çevreler. */
export function CardLink({ className, ...props }: ComponentProps<typeof Link>) {
	return (
		<Link
			className={cn(
				"block rounded-xl border border-line bg-surface-raised p-5 transition-colors hover:border-line-strong hover:bg-surface-sunken",
				className,
			)}
			{...props}
		/>
	);
}

export function SectionHeading({
	children,
	action,
}: {
	children: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="mb-3 flex items-baseline justify-between gap-4">
			<h2 className="text-xl font-bold">{children}</h2>
			{action}
		</div>
	);
}
