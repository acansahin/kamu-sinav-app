import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Yükseklik kademeleri. Gölge token'ları dört tema varyantının dördünde de
 * tanımlıdır: yüksek kontrastta ve baskıda `none`a iner, hiyerarşiyi orada
 * kenarlık taşır (bkz. globals.css).
 *
 * `duz` gölgesiz kart demektir — bilgilendirme şeritleri ve iç içe kartlar
 * gibi, üstünde durduğu yüzeyden ayrılması gerekmeyen yerler için.
 */
const YUKSEKLIKLER = {
	duz: "",
	kart: "shadow-kart",
	kahraman: "shadow-kahraman",
} as const;

type Yukseklik = keyof typeof YUKSEKLIKLER;

export function Card({
	className,
	elevation = "kart",
	...props
}: ComponentProps<"div"> & { elevation?: Yukseklik }) {
	return (
		<div
			className={cn(
				"rounded-kart border border-line bg-surface-raised p-5",
				YUKSEKLIKLER[elevation],
				className,
			)}
			{...props}
		/>
	);
}

/** Tamamı tıklanabilir kart. Odak halkası kartın tamamını çevreler. */
export function CardLink({
	className,
	elevation = "kart",
	...props
}: ComponentProps<typeof Link> & { elevation?: Yukseklik }) {
	return (
		<Link
			className={cn(
				"block rounded-kart border border-line bg-surface-raised p-5 transition-colors duration-150 ease-[var(--ease-cikis)] hover:border-line-strong hover:bg-surface-sunken",
				YUKSEKLIKLER[elevation],
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
