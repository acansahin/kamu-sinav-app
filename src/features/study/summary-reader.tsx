"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { SpeechPlayer } from "@/features/study/speech-player";
import { useSpeechReader } from "@/features/study/use-speech-reader";

/**
 * Konu özetini sesli okunabilir hâle getiren istemci sarmalayıcısı.
 *
 * `SummaryDocument`a bir `toolbar` prop'u eklemek yerine sarmalama tercih
 * edildi. İki gerekçe:
 *
 *  1. `konular/[subject]/yazdir/page.tsx` de aynı `SummaryDocument`ı kullanıyor
 *     (ders paketi, 6-8 konu). Prop eklemek varsayılanı kapalı tutmayı
 *     unutulabilir bir sorumluluğa çevirirdi; sarmalayıcı ise ders paketine
 *     hiç dokunmuyor.
 *  2. Okuma kökü için gerçek bir `ref` gerekiyor ve `SummaryDocument` bir
 *     sunucu bileşeni — `ref` veremez.
 *
 * Sunucu bileşenini istemci bileşenine `children` olarak geçirmek App
 * Router'ın standart desenidir ve statik export'ta sorunsuz çalışır; derlenmiş
 * MDX sunucuda üretilip buraya olduğu gibi iniyor.
 */
export function SummaryReader({
	subjectId,
	topicId,
	children,
}: {
	subjectId: string;
	topicId: string;
	children: ReactNode;
}) {
	const kokRef = useRef<HTMLDivElement>(null);
	const reader = useSpeechReader({ kokRef, subjectId, topicId });

	return (
		<>
			<SpeechPlayer reader={reader} />
			<div ref={kokRef}>{children}</div>
		</>
	);
}
