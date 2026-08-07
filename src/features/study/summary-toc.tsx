"use client";

import { List } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Konu özetinin içindekiler listesi.
 *
 * Yalnızca `##` (h2) başlıkları alınır. h3 30 dosyanın 13'ünde var ve listeyi
 * iki katına çıkarıp taranabilirliğini bitiriyordu.
 *
 * Kapsam `[data-tts="body"]` ile sınırlı: `SummaryDocument`ın en üstteki
 * "Bir bakışta" kartının başlığı da bir h2'dir ama gövdenin parçası değildir,
 * içindekilerde görünmemelidir.
 *
 * ⚠️ Bu bileşen ve `<details>` sarmalayıcısı `data-print="hide"` VE
 * `data-tts="skip"` taşımak zorunda: `lib/speech/extract.ts` render edilmiş
 * DOM'u geziyor ve atlamayı nitelikle yapıyor — nitelik olmazsa bölüm başlıkları
 * sesli okumaya ikinci kez metin olarak sızar.
 */

export interface Bolum {
	id: string;
	baslik: string;
}

/**
 * Yapışkan başlığın altında kalmasın diye bırakılan üst pay (px).
 *
 * Başlığın GERÇEK yüksekliğinden okunur, sabit değer verilmez: başlık rem
 * tabanlı ve yazı boyutu tercihiyle birlikte büyüyor (`cok-buyuk`ta ~85px).
 * Sabit bir sayı, büyük yazıda hedef başlığı başlığın arkasına iterdi.
 *
 * Hem bölüme atlarken hem "aktif bölüm" eşiğinde aynı değer kullanılır;
 * ayrışırlarsa tıklanan bölüm aktif görünmezdi.
 */
function ustPay(): number {
	const baslik = document.querySelector("header");
	return (baslik?.getBoundingClientRect().height ?? 68) + 16;
}

/**
 * Başlıkları bulur, id'lerini yazar ve o an görünen bölümü izler.
 *
 * id'ler İSTEMCİDE ve KONUM TABANLI üretilir (`bolum-1`, `bolum-2`…);
 * `rehype-slug` eklenmedi. Gerekçe: `github-slugger` `toLowerCase()` kullanır ve
 * bu depoda Türkçe için yasaktır ("I" → "i", olması gereken "ı"), Türkçe
 * başlıklardan bozuk slug üretirdi. Ayrıca id ile listeyi aynı DOM gezintisi
 * ürettiği için ikisinin ayrışması imkânsız.
 */
export function useSummarySections(kokRef: RefObject<HTMLElement | null>): {
	bolumler: Bolum[];
	aktifId: string | null;
} {
	const [bolumler, setBolumler] = useState<Bolum[]>([]);
	const [aktifId, setAktifId] = useState<string | null>(null);

	useEffect(() => {
		const kok = kokRef.current;
		if (!kok) return;

		const basliklar = Array.from(
			kok.querySelectorAll<HTMLHeadingElement>('[data-tts="body"] h2'),
		);

		const bulunan = basliklar.map((el, i) => {
			el.id ||= `bolum-${i + 1}`;
			return { id: el.id, baslik: (el.textContent ?? "").trim() };
		});
		setBolumler(bulunan);
		if (bulunan.length === 0) return;

		/*
		 * Aktif bölüm: başlık ekranın üst şeridini geçtiğinde etkinleşir.
		 * `rootMargin`in alt değeri büyük negatif — böylece "aktif" olan, ekranda
		 * en son görünen değil, ÜSTTE en yakın olan başlık olur; aksi hâlde uzun
		 * bir bölümün ortasındayken bir sonraki başlık aktif görünüyordu.
		 */
		const gozlemci = new IntersectionObserver(
			() => {
				const esik = ustPay();
				let sonGecen: string | null = null;
				for (const el of basliklar) {
					if (el.getBoundingClientRect().top <= esik) sonGecen = el.id;
				}
				setAktifId(sonGecen ?? basliklar[0].id);
			},
			{ rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
		);

		for (const el of basliklar) gozlemci.observe(el);
		return () => gozlemci.disconnect();
	}, [kokRef]);

	return { bolumler, aktifId };
}

function bolumeGit(id: string): void {
	const hedef = document.getElementById(id);
	if (!hedef) return;

	/*
	 * `scroll-margin-top` KULLANILMIYOR. Sesli okuma aynı başlıkları
	 * `scrollIntoView({ block: "center" })` ile ortalıyor ve scroll-margin o
	 * kutuyu da kaydırıp elemanı gerçek merkezin altına itiyor
	 * (globals.css'teki uyarı). Pay bu yüzden yalnızca burada, tıklama anında
	 * uygulanır.
	 *
	 * `matchMedia` kontrolü zorunlu: CSS'teki `scroll-behavior: auto !important`
	 * JS'in `behavior: "smooth"` seçeneğini etkilemez.
	 */
	const azalt =
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
	const ust = hedef.getBoundingClientRect().top + window.scrollY - ustPay();

	try {
		window.scrollTo({ top: ust, behavior: azalt ? "auto" : "smooth" });
	} catch {
		window.scrollTo(0, ust);
	}

	// Adres çubuğundaki konum güncellenir ama tarayıcının kendi sıçraması
	// tetiklenmez — `location.hash` yazmak payı görmezden gelirdi.
	history.replaceState(null, "", `#${id}`);
}

function TocListesi({
	bolumler,
	aktifId,
}: {
	bolumler: Bolum[];
	aktifId: string | null;
}) {
	return (
		<ol className="space-y-0.5 text-sm">
			{bolumler.map((bolum, i) => {
				const aktif = bolum.id === aktifId;
				return (
					<li key={bolum.id}>
						<a
							href={`#${bolum.id}`}
							// Aktiflik renkle DEĞİL, önce semantikle bildirilir.
							aria-current={aktif ? "location" : undefined}
							onClick={(e) => {
								e.preventDefault();
								bolumeGit(bolum.id);
							}}
							className={cn(
								"flex min-h-11 items-center gap-2 rounded-lg px-3 transition-colors duration-150 ease-[var(--ease-cikis)]",
								aktif
									? "bg-brand-soft font-semibold text-brand"
									: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
							)}
						>
							{/*
							 * Sıra numarası bağlantının rengini MİRAS ALIR. Daha
							 * soluk göstermek için `opacity` kullanmak yasak:
							 * ölçüldü, `--fg-muted` %60 opaklıkta 3.56:1'e düşüyor
							 * ve AA eşiğinin altına iniyor (axe bunu yakaladı).
							 * Renk her zaman token'dan gelir, opaklıkla türetilmez.
							 */}
							<span className="tabular-nums">{i + 1}.</span>
							<span className="min-w-0">{bolum.baslik}</span>
						</a>
					</li>
				);
			})}
		</ol>
	);
}

/** Masaüstünde okuma sütununun yanında duran yapışkan liste. */
export function SummaryTocSidebar({
	bolumler,
	aktifId,
}: {
	bolumler: Bolum[];
	aktifId: string | null;
}) {
	if (bolumler.length === 0) return null;

	return (
		<nav
			data-print="hide"
			data-tts="skip"
			aria-label="İçindekiler"
			className="sticky top-24 hidden w-60 shrink-0 lg:block"
		>
			<p className="mb-2 flex items-center gap-2 px-3 text-sm font-bold">
				<List aria-hidden size={16} />
				İçindekiler
			</p>
			<TocListesi bolumler={bolumler} aktifId={aktifId} />
		</nav>
	);
}

/**
 * Dar ekranda metnin üstünde duran katlanır liste.
 *
 * Gerçek `<details>/<summary>` kullanılıyor; açma/kapama semantiği, klavye
 * desteği ve ekran okuyucu duyurusu tarayıcıdan geliyor (erişilebilirlik
 * sözleşmesi: kontroller yeniden yazılmaz).
 */
export function SummaryTocDetails({
	bolumler,
	aktifId,
}: {
	bolumler: Bolum[];
	aktifId: string | null;
}) {
	if (bolumler.length === 0) return null;

	return (
		<details
			data-print="hide"
			data-tts="skip"
			className="mb-6 rounded-kart border border-line bg-surface-raised lg:hidden"
		>
			<summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 font-semibold">
				<List aria-hidden size={18} />
				İçindekiler
				<span className="font-normal tabular-nums text-fg-subtle">
					({bolumler.length} bölüm)
				</span>
			</summary>
			<div className="px-2 pb-3">
				<TocListesi bolumler={bolumler} aktifId={aktifId} />
			</div>
		</details>
	);
}
