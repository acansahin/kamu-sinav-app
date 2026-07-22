"use client";

import { CloudDownload, Check, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

type Status =
	| { phase: "idle" }
	| { phase: "unsupported" }
	| { phase: "running"; done: number; total: number }
	| { phase: "done"; total: number }
	| { phase: "failed" };

/**
 * Tüm içeriği çevrimdışı kullanım için indirme.
 *
 * Bilinçli olarak isteğe bağlıdır. Çıktı ~10 MB; hedef kitlede mesai
 * aralarında kısıtlı veriyle çalışan kullanıcılar var ve onlara sormadan
 * bu kadar veri indirtmek doğru olmaz. Ziyaret edilen sayfalar zaten
 * kendiliğinden önbelleğe alınır; bu düğme "her şey hazır olsun" diyenler
 * için.
 */
export function OfflineDownload() {
	const [status, setStatus] = useState<Status>({ phase: "idle" });

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		function onMessage(event: MessageEvent) {
			const data = event.data as
				| { type: "PRECACHE_PROGRESS"; done: number; total: number }
				| { type: "PRECACHE_DONE"; total: number }
				| { type: "PRECACHE_FAILED" }
				| undefined;

			if (data?.type === "PRECACHE_PROGRESS") {
				setStatus({ phase: "running", done: data.done, total: data.total });
			} else if (data?.type === "PRECACHE_DONE") {
				setStatus({ phase: "done", total: data.total });
			} else if (data?.type === "PRECACHE_FAILED") {
				setStatus({ phase: "failed" });
			}
		}

		navigator.serviceWorker.addEventListener("message", onMessage);
		return () =>
			navigator.serviceWorker.removeEventListener("message", onMessage);
	}, []);

	/*
	 * Destek kontrolü tıklama anında yapılır, effect içinde değil.
	 * Sunucuda `navigator` yoktur; render sırasında bakmak hidratasyon
	 * uyuşmazlığı, effect içinde setState çağırmak ise zincirleme render
	 * doğurur. Olay anında bakmak ikisinden de kaçınır.
	 */
	async function start() {
		if (!("serviceWorker" in navigator)) {
			setStatus({ phase: "unsupported" });
			return;
		}
		const registration = await navigator.serviceWorker.ready;
		if (!registration.active) {
			setStatus({ phase: "failed" });
			return;
		}
		setStatus({ phase: "running", done: 0, total: 0 });
		registration.active.postMessage({ type: "PRECACHE_ALL" });
	}

	return (
		<Card>
			<h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
				<WifiOff aria-hidden size={20} />
				Çevrimdışı kullanım
			</h2>
			<p className="mb-4 text-sm text-fg-muted">
				Açtığın sayfalar kendiliğinden cihazına kaydedilir ve internet olmadan
				da çalışır. Her şeyin hazır olmasını istiyorsan tümünü baştan
				indirebilirsin — yaklaşık 10 MB yer kaplar.
			</p>

			{status.phase === "unsupported" && (
				<p role="status" className="text-sm text-fg-subtle">
					Bu tarayıcı çevrimdışı kullanımı desteklemiyor.
				</p>
			)}

			{status.phase === "idle" && (
				<Button variant="secondary" onClick={() => void start()}>
					<CloudDownload aria-hidden size={18} />
					Tümünü çevrimdışı için indir
				</Button>
			)}

			{status.phase === "running" && (
				<div>
					<ProgressBar
						value={status.done}
						max={Math.max(status.total, 1)}
						label="Çevrimdışı indirme ilerlemesi"
					/>
					<p role="status" className="mt-2 text-sm text-fg-muted">
						{status.total > 0
							? `${status.done} / ${status.total} dosya indirildi`
							: "İndirme hazırlanıyor…"}
					</p>
				</div>
			)}

			{status.phase === "done" && (
				<p
					role="status"
					className="flex items-center gap-2 font-medium text-correct"
				>
					<Check aria-hidden size={18} />
					Tamamlandı. {status.total} dosya çevrimdışı kullanıma hazır.
				</p>
			)}

			{status.phase === "failed" && (
				<div>
					<p role="status" className="mb-3 text-sm text-wrong">
						İndirme tamamlanamadı. Bağlantını kontrol edip tekrar
						deneyebilirsin.
					</p>
					<Button variant="secondary" onClick={() => void start()}>
						Tekrar dene
					</Button>
				</div>
			)}
		</Card>
	);
}
