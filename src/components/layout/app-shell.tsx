"use client";

import { BookOpen, House, ListChecks, Settings, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { useApplyPreferences } from "@/lib/stores/preferences";
import { cn } from "@/lib/utils/cn";

interface NavItem {
	href: Route;
	label: string;
	icon: typeof House;
}

const NAV_ITEMS: NavItem[] = [
	{ href: "/", label: "Ana Sayfa", icon: House },
	{ href: "/konular", label: "Konular", icon: BookOpen },
	{ href: "/testler", label: "Testler", icon: ListChecks },
	{ href: "/ilerleme", label: "İlerleme", icon: TrendingUp },
];

function isActive(pathname: string, href: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
	useApplyPreferences();
	const pathname = usePathname();

	return (
		<div className="flex min-h-dvh flex-col">
			{/* Klavye kullanıcıları her sayfada gezinmeyi atlayabilmeli */}
			<a
				href="#icerik"
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-fg"
			>
				İçeriğe geç
			</a>

			<header className="sticky top-0 z-30 border-b border-line bg-surface-raised/95 backdrop-blur">
				<div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
					<Link
						href="/"
						className="flex min-h-11 items-center text-lg font-bold tracking-tight text-fg no-underline"
					>
						Kamu Sınav <span className="text-brand">Akademi</span>
					</Link>

					<nav aria-label="Ana menü" className="ml-auto hidden md:block">
						<ul className="flex items-center gap-1">
							{NAV_ITEMS.map(({ href, label, icon: Icon }) => {
								const active = isActive(pathname, href);
								return (
									<li key={href}>
										<Link
											href={href}
											aria-current={active ? "page" : undefined}
											className={cn(
												"flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors",
												active
													? "bg-brand-soft text-brand"
													: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
											)}
										>
											<Icon aria-hidden size={18} />
											{label}
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>

					<Link
						href="/ayarlar"
						aria-label="Ayarlar"
						className={cn(
							"flex size-11 items-center justify-center rounded-lg transition-colors md:ml-0",
							pathname.startsWith("/ayarlar")
								? "bg-brand-soft text-brand"
								: "ml-auto text-fg-muted hover:bg-surface-sunken hover:text-fg md:ml-0",
						)}
					>
						<Settings aria-hidden size={20} />
					</Link>
				</div>
			</header>

			<main
				id="icerik"
				className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-10"
			>
				{children}
			</main>

			{/* Mobilde alt gezinme: birincil aksiyonlar başparmak erişiminde */}
			<nav
				aria-label="Ana menü"
				className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised md:hidden"
			>
				<ul className="mx-auto flex max-w-5xl">
					{NAV_ITEMS.map(({ href, label, icon: Icon }) => {
						const active = isActive(pathname, href);
						return (
							<li key={href} className="flex-1">
								<Link
									href={href}
									aria-current={active ? "page" : undefined}
									className={cn(
										"flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
										active ? "text-brand" : "text-fg-muted",
									)}
								>
									<Icon aria-hidden size={22} />
									{label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
		</div>
	);
}
