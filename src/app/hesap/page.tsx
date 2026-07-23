import type { Metadata } from "next";
import { AccountPanel } from "@/features/account/account-panel";

export const metadata: Metadata = { title: "Hesap" };

export default function AccountPage() {
	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Hesap</h1>
			<p className="mb-6 text-fg-muted">
				Hesap açmak isteğe bağlıdır. Uygulamanın tamamı hesapsız da çalışır.
			</p>
			<AccountPanel />
		</div>
	);
}
