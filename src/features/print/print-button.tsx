"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Yazdırma / PDF kaydetme.
 *
 * Ayrı bir PDF kütüphanesi yerine tarayıcının yazdırma motoru kullanılır:
 * Türkçe karakterler ve tablolar için font gömmek gerekmez, çıktı ekrandaki
 * içerikle birebir aynıdır ve çevrimdışı çalışır. Kullanıcı yazdırma
 * penceresinde hedef olarak "PDF olarak kaydet"i seçer.
 */
export function PrintButton({
	label = "Yazdır veya PDF kaydet",
	variant = "secondary",
}: {
	label?: string;
	variant?: "primary" | "secondary";
}) {
	return (
		<Button variant={variant} onClick={() => window.print()}>
			<Printer aria-hidden size={18} />
			{label}
		</Button>
	);
}
