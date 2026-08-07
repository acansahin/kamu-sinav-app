"use client";

/**
 * Okuma ilerleme şeridi.
 *
 * `ui/progress-bar.tsx` YENİDEN KULLANILMIYOR: o `h-2` yüksekliğinde, akış
 * içinde duran, yuvarlatılmış bir blok. Buradaki öğe yapışkan, kenardan kenara
 * ve 3px — ikisini tek soyutlamada birleştirmek her ikisini de bozardı.
 *
 * `aria-live` YOK ve olmamalı: değer her kaydırmada değişiyor, duyurulsaydı
 * ekran okuyucu sürekli konuşurdu (`speech-player.tsx`'teki aynı gerekçe).
 * Değer yine de `aria-valuenow` ile sorulduğunda okunabilir.
 *
 * `data-print="hide"` VE `data-tts="skip"`: ikincisi olmadan sesli okuma
 * çıkarımı bu düğümü de gezer (`lib/speech/extract.ts`).
 */
export function ReadingProgress({ oran }: { oran: number }) {
	const yuzde = Math.round(oran * 100);

	return (
		<div
			data-print="hide"
			data-tts="skip"
			role="progressbar"
			aria-label="Konu özetinde okuma ilerlemesi"
			aria-valuenow={yuzde}
			aria-valuemin={0}
			aria-valuemax={100}
			/*
			 * Şerit başlığın hemen ALTINA yapışır. `--baslik-yuksekligi` zorunlu:
			 * sabit piksel verildiğinde büyük yazı boyutunda başlık uzuyor ve
			 * şerit tamamen arkasında kalıyordu (ölçüldü: 64px şerit, 68.8px
			 * başlık). `speech-player.tsx` de aynı token'dan 3px aşağı yapışır.
			 */
			className="sticky top-[var(--baslik-yuksekligi)] z-20 -mx-4 h-[3px] bg-surface-sunken"
		>
			<div
				className="h-full bg-brand transition-[width] duration-150 ease-[var(--ease-cikis)]"
				style={{ width: `${yuzde}%` }}
			/>
		</div>
	);
}
