"use client";

import {
	BookOpen,
	CircleUserRound,
	House,
	ListChecks,
	RefreshCw,
	Search,
	Settings,
	Timer,
	TrendingUp,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { BackButton } from "@/components/layout/back-button";
import { isAccountConfigured } from "@/lib/auth/supabase-client";
import { useIdentity } from "@/lib/stores/identity";
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
	{ href: "/deneme", label: "Deneme", icon: Timer },
	{ href: "/yanlislarim", label: "Tekrar", icon: RefreshCw },
	{ href: "/ilerleme", label: "İlerleme", icon: TrendingUp },
];

function isActive(pathname: string, href: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
	useApplyPreferences();
	const pathname = usePathname();
	const identity = useIdentity();

	// Hesap yapılandırılmamışsa (Supabase anahtarı yok) çalışmayan bir ikon
	// gösterilmez — olmayan özelliği varmış gibi göstermeme ilkesi
	// (PROJECT_PLAN.md §3.2). Bu durumda ikon başlıkta hiç yer almaz.
	const accountConfigured = isAccountConfigured();
	const signedIn = identity.kind === "account";

	/*
	 * Dar ekranda başlıkta logo + üç ikon zaten sınırda; geri tuşu dördüncü
	 * hedef olarak eklenince kelime markasına yer kalmıyor. Bu yüzden geri
	 * tuşunun göründüğü sayfalarda marka mobilde gizlenir. Ana sayfaya erişim
	 * kaybolmaz: hem alt gezinme çubuğunda hem masaüstü menüsünde yer alıyor.
	 */
	const isHome = pathname === "/";

	return (
		<div className="flex min-h-dvh flex-col">
			{/* Klavye kullanıcıları her sayfada gezinmeyi atlayabilmeli */}
			<a
				href="#icerik"
				data-print="hide"
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-fg"
			>
				İçeriğe geç
			</a>

			{/*
			 * Üst pay durum çubuğu içindir: başlık ekranın en tepesine yapışır ve
			 * kendi zeminini çubuğun ARKASINA boyar. Böylece bant uygulamanın
			 * açık/koyu temasını izler — native pencere arka planını değil.
			 */}
			<header
				data-print="hide"
				className="sticky top-0 z-30 border-b border-line bg-surface-raised/95 pt-[var(--safe-top)] backdrop-blur"
			>
				<div className="mx-auto flex w-full max-w-5xl items-center gap-2 py-3 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] sm:gap-4">
					{/* Ana sayfada kendini gizler ama ağaçta kalır — bkz. BackButton. */}
					<BackButton />

					<Link
						href="/"
						className={cn(
							"min-h-11 shrink-0 items-center text-lg font-bold tracking-tight text-fg no-underline",
							isHome ? "flex" : "hidden sm:flex",
						)}
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
						href="/arama"
						aria-label="Arama"
						className={cn(
							"ml-auto flex size-11 items-center justify-center rounded-lg transition-colors md:ml-0",
							pathname.startsWith("/arama")
								? "bg-brand-soft text-brand"
								: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
						)}
					>
						<Search aria-hidden size={20} />
					</Link>

					<Link
						href="/ayarlar"
						aria-label="Ayarlar"
						className={cn(
							"flex size-11 items-center justify-center rounded-lg transition-colors",
							pathname.startsWith("/ayarlar")
								? "bg-brand-soft text-brand"
								: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
						)}
					>
						<Settings aria-hidden size={20} />
					</Link>

					{accountConfigured && (
						<Link
							href="/hesap"
							// Giriş yapılmışsa dolu, yapılmamışsa boş kullanıcı ikonu;
							// etiket de durumu söyler, ikon tek başına anlam taşımasın.
							aria-label={signedIn ? "Hesabım" : "Giriş yap"}
							className={cn(
								"flex size-11 items-center justify-center rounded-lg transition-colors",
								pathname.startsWith("/hesap")
									? "bg-brand-soft text-brand"
									: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
							)}
						>
							{signedIn ? (
								<CircleUserRound aria-hidden size={20} />
							) : (
								<UserRound aria-hidden size={20} />
							)}
						</Link>
					)}
				</div>
			</header>

			<main
				id="icerik"
				className="mx-auto w-full max-w-5xl flex-1 py-6 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] print:max-w-none print:py-0 print:pl-0 print:pr-0"
			>
				{children}
			</main>

			{/*
			 * Şeffaflık sayfaları her yerden erişilebilir olmalı: içeriğin nereden
			 * geldiğini ve verinin nasıl işlendiğini söylemek ürünün tezi
			 * (PROJECT_PLAN.md §4), Ayarlar'a gömülü kalmamalı.
			 *
			 * Alt boşluk burada: sabit mobil gezinme çubuğunun altında kalmamak için
			 * gereken pay, sayfanın SON öğesi olan bu bloğa verilir. Çubuk jest
			 * çubuğu kadar uzadığı için pay da onunla birlikte büyümek zorunda;
			 * aksi hâlde bu bağlantılar çubuğun altında kaybolur. Geniş ekranda
			 * gezinme çubuğu yok ama jest çubuğu duruyor, pay orada da eklenir.
			 */}
			<footer
				data-print="hide"
				className="mx-auto w-full max-w-5xl pb-[calc(6rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] text-sm md:pb-[calc(2rem+var(--safe-bottom))]"
			>
				<nav aria-label="Alt bilgi">
					<ul className="flex flex-wrap items-center gap-x-5 border-t border-line pt-2">
						<li>
							<Link
								href="/hakkinda"
								className="inline-flex min-h-11 items-center font-medium text-fg-muted hover:text-fg"
							>
								Hakkında
							</Link>
						</li>
						<li>
							<Link
								href="/gizlilik"
								className="inline-flex min-h-11 items-center font-medium text-fg-muted hover:text-fg"
							>
								Kişisel Verilerin Korunması
							</Link>
						</li>
					</ul>
				</nav>
			</footer>

			{/*
			 * Mobilde alt gezinme: birincil aksiyonlar başparmak erişiminde.
			 * Alt pay jest çubuğu içindir — zemin çubuğun arkasına uzanır, hedefler
			 * onun üstünde kalır.
			 */}
			<nav
				aria-label="Ana menü"
				data-print="hide"
				className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[var(--safe-bottom)] md:hidden"
			>
				<ul className="mx-auto flex max-w-5xl pl-[var(--safe-left)] pr-[var(--safe-right)]">
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
