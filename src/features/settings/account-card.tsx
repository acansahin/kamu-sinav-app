"use client";

import { Cloud, Smartphone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isAccountConfigured } from "@/lib/auth/supabase-client";
import { useIdentity } from "@/lib/stores/identity";

/**
 * Ayarlar'daki hesap özeti.
 *
 * Giriş formunun kendisi `/hesap` rotasındadır; burada yalnızca durum ve o
 * ekrana bir kapı var. Hesap yapılandırılmamışsa (Supabase anahtarı verilmemiş)
 * çalışmayan bir bağlantı gösterilmez — uygulama, olmayan özelliği varmış gibi
 * göstermeme ilkesini izliyor (PROJECT_PLAN.md §3.2, rakiplerin 4 numaralı
 * zayıf yönü: "vaat edilen özellik teslim edilmiyor").
 */
export function AccountCard() {
	const identity = useIdentity();
	const configured = isAccountConfigured();

	if (identity.kind === "account") {
		return (
			<Card>
				<h2 className="mb-1 text-lg font-bold">Hesap</h2>
				<p className="mb-4 text-fg-muted">
					<span className="font-medium text-fg">{identity.email}</span> ile giriş
					yaptın. İlerlemen bu hesaba kayıtlı.
				</p>
				<ButtonLink href="/hesap" variant="secondary">
					Hesabı yönet
				</ButtonLink>
			</Card>
		);
	}

	return (
		<Card>
			<h2 className="mb-1 text-lg font-bold">Hesap</h2>
			<p className="mb-4 text-fg-muted">
				Bu cihazda anonim çalışıyorsun. Hesap gerekmiyor: tüm ilerlemen burada,
				çevrimdışı ve kimseyle paylaşılmadan tutuluyor.
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
							cihazda içe aktar.
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
							{configured ? "Giriş yaparsan" : "Üyelik hazırlanıyor"}
						</span>
						<span className="block text-fg-muted">
							{configured
								? "Bu cihazdaki ilerlemen hesabına taşınır; çıkış yaparsan cihazda kalır."
								: "Geldiğinde bulut yedek, otomatik senkron ve hata bildirimlerinin bize ulaşması eklenecek. Bu cihazdaki ilerlemen silinmeden hesabına taşınacak."}
						</span>
					</span>
				</li>
			</ul>

			{configured && (
				<ButtonLink href="/hesap" variant="secondary" className="mt-4">
					Giriş yap
				</ButtonLink>
			)}
		</Card>
	);
}
