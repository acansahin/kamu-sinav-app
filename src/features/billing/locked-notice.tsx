import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Kilitli bir yüzeyin yerine geçen panel.
 *
 * Üç şeyi birden söyler ve sırası önemlidir: neyin kilitli olduğu, satın
 * almanın ne açacağı, ve NELERİN ZATEN ÜCRETSİZ olduğu. Üçüncüsü olmadan
 * kullanıcı uygulamanın tamamını duvar sanır; ücretsiz ön gösterimi
 * hatırlatmak hem dürüsttür hem de kullanıcıyı deneyebileceği bir yere
 * yönlendirir.
 */
export function LockedNotice({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card className="text-center">
			{/* Renk tek başına anlam taşımaz: ikonun yanında her zaman metin var. */}
			<Lock aria-hidden size={32} className="mx-auto mb-3 text-brand" />

			<h2 className="text-xl font-bold">{title}</h2>
			<p className="mx-auto mt-2 max-w-prose text-fg-muted">{description}</p>

			<div className="mt-5 flex flex-wrap justify-center gap-3">
				<ButtonLink href="/tam-erisim">Tam erişimi incele</ButtonLink>
			</div>

			<p className="mt-4 text-sm text-fg-subtle">
				Her dersin ilk konusu — özeti ve ilk testi — satın alma olmadan
				açıktır.
			</p>
		</Card>
	);
}
