"use client";

import { Info, Pause, Play, Square, TriangleAlert } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import type { SpeechReader } from "@/features/study/use-speech-reader";
import {
	SPEECH_RATE_LABELS,
	usePreferences,
} from "@/lib/stores/preferences";
import type { SpeechRate } from "@/types/progress";
import { cn } from "@/lib/utils/cn";

/**
 * Sesli okuma oynatıcısı.
 *
 * Durum, ayrı bir ilerleme metniyle DEĞİL, birincil düğmenin etiketiyle
 * anlatılır ("Sesli oku" ↔ "Duraklat" ↔ "Devam et"). Bunun sebebi ekran
 * okuyucu çakışmasıdır: TalkBack açıkken kullanıcı sayfayı zaten dinliyor ve
 * bir `aria-live` bölgesi her cümlede araya girip okumayı keserdi. Odaklanmış
 * bir düğmenin adı değiştiğinde ekran okuyucu bunu zaten tek seferlik duyurur.
 *
 * Aynı gerekçeyle `aria-pressed` de yok: etiket durumu söylüyor, "basılı
 * düğme" semantiği yalnızca kafa karıştırırdı.
 */
export function SpeechPlayer({ reader }: { reader: SpeechReader }) {
	const speechRate = usePreferences((s) => s.speechRate);
	const setSpeechRate = usePreferences((s) => s.setSpeechRate);
	const ipucuId = useId();

	const { durum, yetenek } = reader;
	const okuyor = durum === "okuyor";
	const duraklatildi = durum === "duraklatildi";
	const calisiyor = okuyor || duraklatildi;

	// Motor hiç yoksa oynatıcı GÖSTERİLMEZ: kalıcı olarak ölü bir kontrol,
	// yokluğundan daha çok gürültüdür ve kullanıcının yapabileceği bir şey yok.
	if (yetenek?.durum === "yok") return null;

	const birincilEtiket = okuyor
		? "Duraklat"
		: duraklatildi
			? "Devam et"
			: durum === "hazirlaniyor"
				? "Hazırlanıyor…"
				: "Sesli oku";

	return (
		<div
			data-print="hide"
			data-tts="skip"
			className={cn(
				"mb-6 rounded-xl border border-line bg-surface-raised p-4",
				// Yapışkanlık YALNIZCA okurken: boştayken normal akışta durur,
				// okuma başlayınca "Duraklat" her zaman elin altında kalır.
				// Yerleşim değişmiyor, yalnızca konumlandırma — reflow olmaz.
				calisiyor &&
					"sticky top-16 z-20 bg-surface-raised/95 backdrop-blur",
			)}
		>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					onClick={okuyor ? reader.duraklat : reader.baslat}
					disabled={durum === "hazirlaniyor"}
					aria-describedby={ipucuId}
					className="flex-1"
				>
					{okuyor ? (
						<Pause aria-hidden size={18} />
					) : (
						<Play aria-hidden size={18} />
					)}
					{birincilEtiket}
				</Button>

				{calisiyor && (
					<Button variant="secondary" onClick={reader.durdur} className="flex-1">
						<Square aria-hidden size={18} />
						Durdur
					</Button>
				)}
			</div>

			{/*
			 * Yalnızca ekran okuyucu kullanıcısı duyar; görsel gürültü sıfır.
			 * İki sesin üst üste bineceğini önceden söylemek, kullanıcının
			 * kendi ekran okuyucusunu duraklatmasına imkân verir.
			 */}
			<span id={ipucuId} className="sr-only">
				Bu özellik ekran okuyucunuzla aynı anda konuşur.
			</span>

			<div className="mt-4">
				<ChoiceGroup<SpeechRate>
					legend="Okuma hızı"
					value={speechRate}
					options={(Object.keys(SPEECH_RATE_LABELS) as SpeechRate[]).map(
						(value) => ({ value, label: SPEECH_RATE_LABELS[value] }),
					)}
					onChange={setSpeechRate}
				/>
			</div>

			{yetenek?.durum === "dil-yok" && (
				<div
					role="status"
					className="mt-4 flex flex-wrap items-start gap-2 text-sm text-fg-muted"
				>
					<Info aria-hidden size={18} className="mt-0.5 shrink-0" />
					<p className="flex-1">
						Bu cihazda Türkçe ses verisi bulunamadı. Sesli okuma için cihazınıza
						Türkçe metin okuma verisi yüklemeniz gerekiyor.
					</p>
					{/*
					 * Metin "Sorunu düzelt" DEĞİL: bazı üretici ROM'larında bu düğme
					 * doğrudan dil indirmeye değil, genel bir ayar ekranına götürür.
					 * Vaat, düğmenin gerçekten yaptığı kadar olmalı.
					 */}
					{yetenek.kurulumAcilabilir && (
						<Button variant="secondary" size="sm" onClick={reader.kurulumuAc}>
							Türkçe ses verisini yükle
						</Button>
					)}
				</div>
			)}

			{durum === "hata" && (
				<p
					role="alert"
					className="mt-4 flex items-start gap-2 text-sm font-medium text-flag"
				>
					<TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
					Sesli okuma kesildi. Tekrar başlatabilirsiniz.
				</p>
			)}

			{/*
			 * Bitiş duyurusu nadir ve önemlidir; ilerleme metninin aksine
			 * duyurulmalı. `role="status"` kibar bir kesintidir, okumayı bölmez.
			 */}
			{reader.bitisDuyurusu && (
				<p role="status" className="mt-4 text-sm font-medium text-correct">
					{reader.bitisDuyurusu}
				</p>
			)}
		</div>
	);
}
