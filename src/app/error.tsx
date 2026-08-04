"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Segment hatası sınırı.
 *
 * Kök düzen ayakta olduğu için burada `AppShell` (başlık, gezinme, alt bilgi)
 * çevrede durur — kullanıcı hatanın içinde sıkışmaz, alt çubuktan başka bir
 * bölüme geçebilir. Kök düzenin kendisi çökerse devreye `global-error.tsx`
 * girer.
 *
 * `reset()` yalnızca bu segmenti yeniden render etmeyi dener; hata kalıcıysa
 * (bozuk içerik, kullanılamayan depolama) ikinci tuş kullanıcıyı çalışan bir
 * yere götürür.
 */
export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
			<TriangleAlert
				aria-hidden
				size={48}
				className="mb-4 text-wrong"
				strokeWidth={1.5}
			/>
			<h1 className="mb-3 text-2xl font-bold">Bu sayfa açılamadı</h1>
			<p className="mb-6 text-fg-muted">
				Beklenmedik bir hata oluştu. İlerlemeniz cihazınızda saklı, kaybolmadı.
			</p>

			<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
				<Button type="button" onClick={reset}>
					<RotateCcw aria-hidden size={18} />
					Yeniden dene
				</Button>
				<ButtonLink href="/" variant="secondary">
					Ana sayfaya dön
				</ButtonLink>
			</div>

			{error.digest && (
				<p className="mt-6 rounded-lg bg-surface-sunken px-3 py-2 text-sm text-fg-muted">
					Hata kimliği: <code>{error.digest}</code>
				</p>
			)}
		</div>
	);
}
