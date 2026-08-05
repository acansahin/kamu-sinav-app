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
import { DatabaseNotice } from "@/components/layout/database-notice";
import { useBackNavigation } from "@/components/layout/use-back-navigation";
import { isAccountConfigured } from "@/lib/auth/supabase-client";
import { useResolveEntitlement } from "@/lib/stores/entitlement";
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

	/*
	 * Hak çözümlemesi de kök düzende BİR KEZ kurulur: ikinci bir çağrı ikinci
	 * bir Play sorgusu ve ikinci bir `resume` dinleyicisi doğurur.
	 */
	useResolveEntitlement();

	const pathname = usePathname();
	const identity = useIdentity();

	/*
	 * Geri gezinme kök düzende BİR KEZ kurulur: geçmiş derinliği sayacının tek
	 * örneği olmalı ve rota değişimlerinde korunmalı. Aynı `goBack` hem
	 * başlıktaki tuşa hem Android donanım tuşuna bağlanır.
	 */
	const { goBack, showExitHint } = useBackNavigation();

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
				{/*
				 * `lg:gap-2`, `sm:gap-4`ten geri adımdır: etiketli menü tam da bu
				 * eşikte devreye giriyor ve satır en kalabalık hâlini alıyor
				 * (geri tuşu + marka + altı menü öğesi + üç ikon). Boşluğu burada
				 * kısmak, dokunma hedeflerinin İÇİNE dokunmadan ~40px kazandırır;
				 * alternatifi ikonları ya da etiketleri küçültmekti ve ikisi de
				 * erişilebilirlik sözleşmesini deler.
				 */}
				<div className="mx-auto flex w-full max-w-5xl items-center gap-2 py-3 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] sm:gap-4 lg:gap-2">
					{!isHome && <BackButton onBack={goBack} />}

					{/*
					 * Başlıkta daralınca GERİYE ADIM ATAN öğe markadır: `min-w-0` +
					 * `truncate` ile kırpılır. Bilinçli bir tahliye valfi — menü
					 * `shrink-0` olduğu için baskı bir yere gitmek zorunda ve markanın
					 * kısalması, menü etiketinin satır atlamasından da dokunma
					 * hedefinin ezilmesinden de zararsızdır. Ana sayfaya erişim
					 * kaybolmaz: menüde ve alt çubukta "Ana Sayfa" zaten var.
					 */}
					<Link
						href="/"
						className={cn(
							"min-h-11 min-w-0 items-center text-lg font-bold tracking-tight text-fg no-underline",
							isHome ? "flex" : "hidden sm:flex",
						)}
					>
						<span className="truncate">
							Kamu Sınav <span className="text-brand">Akademi</span>
						</span>
					</Link>

					{/*
					 * Eşik `md` değil `lg`: altı etiketli menü + marka + iki ikon,
					 * ölçüldüğünde 768px'te sığmıyordu (gereken ~962px, mevcut 736px).
					 * Sığmayınca satır taşıyor, tek iki kelimelik etiket olan
					 * "Ana Sayfa" iki satıra düşüyor ve ikonlar 44px'ten 20px'e
					 * eziliyordu. 1024px altında zaten alt gezinme çubuğu var.
					 *
					 * `shrink-0` + `whitespace-nowrap` birlikte çalışır: menü asla
					 * sıkışmaz, etiketler asla sarmalanmaz.
					 */}
					<nav
						aria-label="Ana menü"
						className="ml-auto hidden shrink-0 lg:block"
					>
						<ul className="flex items-center gap-1">
							{NAV_ITEMS.map(({ href, label, icon: Icon }) => {
								const active = isActive(pathname, href);
								return (
									<li key={href}>
										<Link
											href={href}
											aria-current={active ? "page" : undefined}
											className={cn(
												"flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-base font-medium transition-colors",
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

					{/*
					 * Bu üç ikonda `shrink-0` süs değil, erişilebilirlik sözleşmesinin
					 * parçası: flex satırı daralınca `size-11` bir ALT sınır değildir,
					 * esnek taban genişliğidir ve ölçümde hedefler 44px'ten 20px'e
					 * düşüyordu. `shrink-0` olmadan dokunma hedefi sessizce küçülür.
					 */}
					<Link
						href="/arama"
						aria-label="Arama"
						className={cn(
							"ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors lg:ml-0",
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
							"flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
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
								"flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
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

			{/*
			 * Depolama açılamadıysa uyarı başlığın hemen altında, her sayfada durur:
			 * sorunun görünür sonucu (kaydedilmeyen ilerleme, dolmayan istatistik)
			 * tek bir ekrana ait değil.
			 */}
			<DatabaseNotice />

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
				className="mx-auto w-full max-w-5xl pb-[calc(6rem+var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] text-sm lg:pb-[calc(2rem+var(--safe-bottom))]"
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
						<li>
							<Link
								href="/kullanim-kosullari"
								className="inline-flex min-h-11 items-center font-medium text-fg-muted hover:text-fg"
							>
								Kullanım Koşulları
							</Link>
						</li>
					</ul>
				</nav>

				{/*
				 * Sorumluluk reddi her sayfanın altında durur, bir alt sayfaya gömülü
				 * değil: mevzuat içeriği taşıyan bir üründe kullanıcının uygulamayı
				 * resmî bir kaynak sanması gerçek bir risktir ve uyarının görülmesi
				 * ayrı bir tıklamaya bağlı olmamalıdır.
				 */}
				<p className="text-fg-subtle">
					Bağımsız bir hazırlık uygulamasıdır; hiçbir kamu kurumuyla bağlantılı
					değildir. İçerik bilgi amaçlıdır, bağlayıcı metin Resmî
					Gazete&rsquo;dir.
				</p>
			</footer>

			{/*
			 * Mobilde ve tablette alt gezinme: birincil aksiyonlar başparmak
			 * erişiminde. Alt pay jest çubuğu içindir — zemin çubuğun arkasına
			 * uzanır, hedefler onun üstünde kalır.
			 *
			 * Eşik üstteki menüyle AYNI olmak zorunda (`lg`): ikisi birbirinin
			 * yerine geçer, arada bir boşluk kalırsa o genişlikte hiç gezinme
			 * görünmez. Aşağıdaki footer payı ve çıkış ipucu da bu çubuğun
			 * varlığına bağlıdır; eşik değişirse üçü birlikte değişir.
			 */}
			<nav
				aria-label="Ana menü"
				data-print="hide"
				className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[var(--safe-bottom)] lg:hidden"
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

			{/*
			 * Kökte donanım geri tuşuna basıldığında çıkış onayı. Yalnızca Android
			 * paketinde görünür; tarayıcıda `showExitHint` hiç true olmaz.
			 *
			 * Animasyon yok: `prefers-reduced-motion` gözetmek zorunda kalmadan
			 * anında görünür, iki saniye sonra kaybolur. Alt gezinme çubuğunun
			 * ÜSTÜNDE konumlanır, onu örtmez.
			 */}
			{showExitHint && (
				<div
					role="status"
					aria-live="polite"
					data-print="hide"
					className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+var(--safe-bottom))] z-40 flex justify-center px-4 lg:bottom-[calc(1rem+var(--safe-bottom))]"
				>
					<p className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-surface shadow-lg">
						Çıkmak için tekrar basın
					</p>
				</div>
			)}
		</div>
	);
}
