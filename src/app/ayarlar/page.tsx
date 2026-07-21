import type { Metadata } from "next";
import { SettingsPanel } from "@/features/settings/settings-panel";

export const metadata: Metadata = { title: "Ayarlar" };

export default function SettingsPage() {
	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Ayarlar</h1>
			<p className="mb-6 text-fg-muted">
				Görünüm tercihleri anında uygulanır ve bu cihazda saklanır.
			</p>
			<SettingsPanel />
		</div>
	);
}
