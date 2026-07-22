"use client";

import { Cloud, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useIdentity } from "@/lib/stores/identity";

/**
 * Hesap durumu.
 *
 * Burada bilinçli olarak ÇALIŞMAYAN bir giriş formu yok. Uygulama, olmayan
 * özelliği varmış gibi göstermeme ilkesini izliyor (PROJECT_PLAN.md §3.2,
 * rakiplerin 4 numaralı zayıf yönü: "vaat edilen özellik teslim edilmiyor").
 * Kart, bugün doğru olanı söyler ve bugünkü yedek yoluna yönlendirir.
 */
export function AccountCard() {
	const identity = useIdentity();

	return (
		<Card>
			<h2 className="mb-1 text-lg font-bold">Hesap</h2>

			{identity.kind === "account" ? (
				<p className="text-fg-muted">
					<span className="font-medium text-fg">{identity.email}</span> ile
					giriş yaptın.
				</p>
			) : (
				<>
					<p className="mb-4 text-fg-muted">
						Bu cihazda anonim çalışıyorsun. Hesap gerekmiyor: tüm ilerlemen
						burada, çevrimdışı ve kimseyle paylaşılmadan tutuluyor.
					</p>

					<ul className="space-y-3 text-sm">
						<li className="flex gap-3">
							<Smartphone
								aria-hidden
								size={20}
								className="mt-0.5 shrink-0 text-fg-subtle"
							/>
							<span>
								<span className="block font-semibold text-fg">
									Başka bir cihazda devam etmek istersen
								</span>
								<span className="block text-fg-muted">
									Aşağıdaki &ldquo;Verilerin&rdquo; bölümünden dışa aktar, öbür
									cihazda içe aktar. Bugün için çoklu cihaz yolu budur.
								</span>
							</span>
						</li>
						<li className="flex gap-3">
							<Cloud
								aria-hidden
								size={20}
								className="mt-0.5 shrink-0 text-fg-subtle"
							/>
							<span>
								<span className="block font-semibold text-fg">
									Üyelik hazırlanıyor
								</span>
								<span className="block text-fg-muted">
									Geldiğinde bulut yedek, otomatik senkron ve hata
									bildirimlerinin bize ulaşması eklenecek. Bu cihazdaki
									ilerlemen silinmeden hesabına taşınacak.
								</span>
							</span>
						</li>
					</ul>
				</>
			)}
		</Card>
	);
}
