import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

export interface Crumb {
	href: Route;
	label: string;
}

/**
 * Konum çubuğu (breadcrumb).
 *
 * Başlıktaki geri tuşunu tamamlar: geri tuşu "geldiğin yere" döndürür, bu ise
 * hiyerarşideki üst sayfalara. Geçmişe bağlı olmadığı için derin bağlantıyla
 * veya çevrimdışı açılan bir sayfada da çalışır.
 *
 * Bağlantılar dokunma hedefi sözleşmesine uyar (`min-h-11`, PROJECT_PLAN §13.2);
 * alt bilgideki bağlantılarla aynı ölçüdedir.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
	if (items.length === 0) return null;

	return (
		<nav aria-label="Konum" data-print="hide" className="mb-2 text-sm">
			{items.map((item, index) => (
				<Fragment key={item.href}>
					{index > 0 && (
						<span aria-hidden className="text-fg-subtle">
							{" / "}
						</span>
					)}
					<Link
						href={item.href}
						className="inline-flex min-h-11 items-center font-medium text-fg-muted hover:text-fg"
					>
						{item.label}
					</Link>
				</Fragment>
			))}
		</nav>
	);
}
