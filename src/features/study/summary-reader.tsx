"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { ReadingProgress } from "@/features/study/reading-progress";
import { SpeechPlayer } from "@/features/study/speech-player";
import {
	SummaryTocDetails,
	SummaryTocSidebar,
	useSummarySections,
} from "@/features/study/summary-toc";
import {
	useReachedEnd,
	useReadingProgress,
} from "@/features/study/use-reading-progress";
import { useSpeechReader } from "@/features/study/use-speech-reader";
import { progressRepository } from "@/lib/repositories/progress.repository";

/**
 * Konu özetinin okuma kabuğu: sesli okuma, içindekiler, ilerleme şeridi ve
 * sona varınca otomatik "okundu" işareti.
 *
 * `SummaryDocument`a prop eklemek yerine SARMALAMA tercih edildi ve bu tercih
 * yeni eklenen her şey için de geçerli. İki gerekçe:
 *
 *  1. `konular/[subject]/yazdir/page.tsx` de aynı `SummaryDocument`ı kullanıyor
 *     (ders paketi, 6-8 konu). Prop eklemek varsayılanı kapalı tutmayı
 *     unutulabilir bir sorumluluğa çevirirdi; sarmalayıcı ise ders paketine
 *     hiç dokunmuyor — içindekiler ve şerit orada görünmez.
 *  2. Okuma kökü için gerçek bir `ref` gerekiyor ve `SummaryDocument` bir
 *     sunucu bileşeni — `ref` veremez.
 *
 * Sunucu bileşenini istemci bileşenine `children` olarak geçirmek App
 * Router'ın standart desenidir ve statik export'ta sorunsuz çalışır; derlenmiş
 * MDX sunucuda üretilip buraya olduğu gibi iniyor.
 *
 * ⚠️ Buraya eklenen HER krom öğesi `data-tts="skip"` VE `data-print="hide"`
 * taşımak zorunda — `lib/speech/extract.ts` render edilmiş DOM'u geziyor ve
 * atlamayı nitelikle yapıyor.
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
	const nirengiRef = useRef<HTMLDivElement>(null);
	const reader = useSpeechReader({ kokRef, subjectId, topicId });

	const { bolumler, aktifId } = useSummarySections(kokRef);
	const oran = useReadingProgress(kokRef);
	const [duyuru, setDuyuru] = useState<string | null>(null);

	/*
	 * Okundu durumu BURADA okunuyor, prop olarak GELMİYOR: konu sayfası bir
	 * sunucu bileşeni ve Dexie'ye erişemez. `TopicReadActions` da aynı sorguyu
	 * yapıyor; `useLiveQuery` ucuz ve iki bileşeni birbirine bağlamak, alt
	 * çubuğu yalnızca bu bilgiyi taşımak için yukarı taşımayı gerektirirdi.
	 *
	 * `undefined` "henüz bilinmiyor" demektir (yükleniyor ya da IndexedDB
	 * açılamadı) ve gözlemci o hâlde de kurulmaz — veri gelmeden yazmak,
	 * okunmuş bir konunun `summaryReadAt`ini yeniden damgalama riskidir.
	 */
	const progress = useLiveQuery(
		() => progressRepository.getTopicProgress(topicId),
		[topicId],
		undefined,
	);
	const okundu = progress === undefined ? undefined : progress?.summaryRead === true;

	const isaretle = useCallback(async () => {
		await progressRepository.markSummaryRead(subjectId, topicId);
		// Sessizce veri yazmak, kullanıcının fark etmediği bir durum değişimi
		// olurdu. Alt çubuk zaten "Bu konuyu okudun"a döner; bu duyuru onu
		// ekran okuyucuya da bildirir.
		setDuyuru("Bu konu okundu olarak işaretlendi.");
	}, [subjectId, topicId]);

	useReachedEnd(nirengiRef, okundu === false, isaretle);

	return (
		<>
			<ReadingProgress oran={oran} />

			<SummaryTocDetails bolumler={bolumler} aktifId={aktifId} />

			<div className="lg:flex lg:items-start lg:gap-8">
				<div className="min-w-0 flex-1">
					<SpeechPlayer reader={reader} />
					<div ref={kokRef}>{children}</div>
					{/*
					 * Sona varış nirengisi. Görünmez ve ekran okuyucudan gizli;
					 * tek işlevi gözlemciye bir hedef vermek.
					 */}
					<div ref={nirengiRef} aria-hidden data-tts="skip" className="h-px" />
				</div>

				<SummaryTocSidebar bolumler={bolumler} aktifId={aktifId} />
			</div>

			{duyuru && (
				<p
					role="status"
					data-print="hide"
					data-tts="skip"
					className="mt-4 text-sm font-medium text-correct"
				>
					{duyuru}
				</p>
			)}
		</>
	);
}
