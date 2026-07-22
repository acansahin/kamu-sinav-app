import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PreferencesScript } from "@/components/layout/preferences-script";
import { ServiceWorkerRegistrar } from "@/features/offline/service-worker-registrar";
import "./globals.css";

export const metadata: Metadata = {
	title: {
		default: "Kamu Sınav Akademi",
		template: "%s · Kamu Sınav Akademi",
	},
	description:
		"Görevde Yükselme ve Unvan Değişikliği sınavlarına hazırlık: konu özetleri, konu testleri ve deneme sınavları. Reklamsız, çevrimdışı çalışır.",
	applicationName: "Kamu Sınav Akademi",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	// Kullanıcının yakınlaştırmasını asla engelleme — erişilebilirlik gereği
	maximumScale: 5,
	userScalable: true,
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="tr" suppressHydrationWarning>
			<head>
				<PreferencesScript />
			</head>
			<body className="min-h-dvh antialiased">
				<AppShell>{children}</AppShell>
				<ServiceWorkerRegistrar />
			</body>
		</html>
	);
}
