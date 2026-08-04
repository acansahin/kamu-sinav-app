"use client";

import { ArrowLeft } from "lucide-react";

/**
 * Başlıktaki geri tuşu.
 *
 * Yalnızca görünümdür; kararı `useBackNavigation` verir. Mantık bilinçli olarak
 * dışarıda: aynı `goBack` Android'in donanım geri tuşuna da bağlanıyor ve
 * geçmiş derinliği sayacının **tek** bir örneği olmak zorunda. Sayaç burada
 * yaşasaydı donanım tuşu kendi ayrı sayacıyla farklı davranırdı.
 */
export function BackButton({ onBack }: { onBack: () => void }) {
	return (
		<button
			type="button"
			onClick={onBack}
			aria-label="Geri"
			className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
		>
			<ArrowLeft aria-hidden size={20} />
		</button>
	);
}
