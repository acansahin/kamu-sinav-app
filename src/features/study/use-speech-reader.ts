"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { cikar } from "@/lib/speech/extract";
import {
	type SpeechCapability,
	getSpeechProvider,
	yetenegiYokla,
} from "@/lib/speech/speech.provider";
import { HIZ_DEGERLERI, type SpeechChunk } from "@/lib/speech/types";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { usePreferences } from "@/lib/stores/preferences";

/**
 * Sesli okuma durum makinesi.
 *
 *   bosta ──Oku──> hazirlaniyor ──> okuyor ──Duraklat──> duraklatildi
 *                       │             │  ▲                     │
 *                       ▼             │  └──── Devam ──────────┘
 *                     hata     doğal bitiş → "okundu" + bosta
 *
 * Eklentide `pause()`/`resume()` YOKTUR, yalnızca `stop()` vardır. Duraklatma
 * bu yüzden "durdur + parça indeksini sakla", devam ise "o parçayı BAŞTAN oku"
 * biçiminde çalışır. Ses anında kesilir; bedeli bir cümlenin tekrar edilmesidir
 * ve dinleyerek çalışan biri için bu kayıp değil, kazançtır.
 */

export type SpeechDurum =
	| "bosta"
	| "hazirlaniyor"
	| "okuyor"
	| "duraklatildi"
	| "hata";

export interface SpeechReader {
	durum: SpeechDurum;
	yetenek: SpeechCapability | null;
	/** O an okunan parçanın indeksi; hiçbiri okunmuyorsa `null`. */
	aktif: number | null;
	baslat: () => void;
	duraklat: () => void;
	durdur: () => void;
	kurulumuAc: () => void;
	/** Okuma tamamlandığında bir kez dolar; ekran okuyucuya duyurulur. */
	bitisDuyurusu: string | null;
}

export function useSpeechReader({
	kokRef,
	subjectId,
	topicId,
}: {
	kokRef: RefObject<HTMLElement | null>;
	subjectId: string;
	topicId: string;
}): SpeechReader {
	const [durum, setDurum] = useState<SpeechDurum>("bosta");
	const [yetenek, setYetenek] = useState<SpeechCapability | null>(null);
	const [aktif, setAktif] = useState<number | null>(null);
	const [bitisDuyurusu, setBitisDuyurusu] = useState<string | null>(null);

	const speechRate = usePreferences((s) => s.speechRate);

	/**
	 * Koşu jetonu — TÜM yarış koşullarının tek çözümü.
	 *
	 * Her kullanıcı eylemi (oku/duraklat/durdur/hız değişimi) ve unmount bunu
	 * artırır. Çalışan döngü her `await` dönüşünde jetonu karşılaştırır ve
	 * değişmişse sessizce çıkar. Böylece "eski" bir döngünün yeni durumu
	 * bozması imkânsız hâle gelir.
	 */
	const kosuRef = useRef(0);
	const parcalarRef = useRef<SpeechChunk[] | null>(null);
	const aktifRef = useRef(0);

	/**
	 * Güncel hız ve "okuyor mu" bilgisi, çalışan döngünün ve olay
	 * dinleyicilerinin görebilmesi için ref'te tutulur; ikisi de render
	 * sırasında DEĞİL, effect içinde tazelenir (React kuralı).
	 */
	const hizRef = useRef(HIZ_DEGERLERI[speechRate]);
	const okuyorRef = useRef(false);

	useEffect(() => {
		okuyorRef.current = durum === "okuyor";
	}, [durum]);

	const vurgula = useCallback((parcalar: SpeechChunk[], indeks: number) => {
		parcalar.forEach((p) => p.el.removeAttribute("data-tts-active"));
		const parca = parcalar[indeks];
		if (!parca) return;
		parca.el.setAttribute("data-tts-active", "");

		/*
		 * `matchMedia` kontrolü ZORUNLU: `globals.css` içindeki
		 * `scroll-behavior: auto !important` kuralı JS'in `behavior: "smooth"`
		 * seçeneğini ETKİLEMEZ — CSS özelliğine yalnızca `behavior: "auto"`
		 * geçildiğinde danışılır. Bu koruma silinirse hareket duyarlılığı olan
		 * kullanıcı yumuşak kaydırma görmeye devam eder.
		 */
		const azalt =
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

		/*
		 * Kaydırma kozmetiktir; okumanın kendisi ondan bağımsız sürmeli.
		 * Korumasız bırakıldığında `scrollIntoView` yokluğu (eski WebView,
		 * test ortamı) döngüyü fırlatarak sesi tamamen susturuyordu.
		 */
		/*
		 * `block: "center"` — okunan blok EKRANIN ORTASINDA durmalı. Önceki
		 * `"nearest"` görünen elemanı hiç kaydırmadığı için okuma ilerledikçe
		 * satır ekranın en altına yapışıyordu.
		 *
		 * Kabul edilen sınır: belgenin en başındaki ve en sonundaki bloklar
		 * merkeze GETİRİLEMEZ (kaydırma sınırı). Elle `window.scrollTo`
		 * matematiği yapışkan krom + safe-area ile birleşince kırılgan olur.
		 *
		 * Parça = blok olduğundan aynı elemanın ikinci kez ortalanması ancak
		 * 400 karakteri aşan bloklarda olur; zaten ortalanmış eleman yeniden
		 * ortalandığında görsel olarak hiçbir şey kımıldamaz.
		 */
		try {
			parca.el.scrollIntoView({
				behavior: azalt ? "auto" : "smooth",
				block: "center",
				inline: "nearest",
			});
		} catch {
			/* kaydırma desteklenmiyor — vurgu yine de duruyor */
		}
	}, []);

	const vurguyuTemizle = useCallback(() => {
		for (const parca of parcalarRef.current ?? []) {
			parca.el.removeAttribute("data-tts-active");
		}
	}, []);

	const bitti = useCallback(async () => {
		setAktif(null);
		setDurum("bosta");
		vurguyuTemizle();
		aktifRef.current = 0;

		/*
		 * Buraya YALNIZCA doğal bitişte gelinir: duraklat, durdur ve unmount
		 * jetonu artırdığı için döngü daha önce çıkar. Ayrı bir "kullanıcı
		 * durdurdu" bayrağı gerekmiyor — jetonun kendisi o bayrak.
		 */
		try {
			await progressRepository.markSummaryRead(subjectId, topicId);
			setBitisDuyurusu("Okuma tamamlandı. Konu okundu olarak işaretlendi.");
		} catch {
			// Depolama yoksa okuma yine tamamlanmıştır; uygulama kilitlenmez
			// (AGENTS.md). Yalnızca işaretleme cümlesi düşer.
			setBitisDuyurusu("Okuma tamamlandı.");
		}
	}, [subjectId, topicId, vurguyuTemizle]);

	const calistir = useCallback(
		async (baslangic: number) => {
			const jeton = ++kosuRef.current;
			const parcalar = parcalarRef.current ?? [];
			const saglayici = getSpeechProvider();

			setDurum("okuyor");

			for (let i = baslangic; i < parcalar.length; i += 1) {
				if (jeton !== kosuRef.current) return;

				aktifRef.current = i;
				setAktif(i);
				vurgula(parcalar, i);

				try {
					await saglayici.speak({
						text: parcalar[i].text,
						rate: hizRef.current,
					});
				} catch {
					/*
					 * `stop()` sonrası bu promise'in ne yaptığı eklenti belgesinde
					 * TANIMLI DEĞİL: Android resolve edebilir, web `cancel()`de
					 * "interrupted" ile reject edebilir, ya da hiç settle olmaz.
					 * Bu yüzden sonucu hiçbir karara girmiyor — jeton hepsini
					 * kapatıyor. Jeton değiştiyse bu bir iptaldir, hata değil.
					 */
					if (jeton !== kosuRef.current) return;
					setDurum("hata");
					return;
				}

				if (jeton !== kosuRef.current) return;
			}

			await bitti();
		},
		[bitti, vurgula],
	);

	const baslat = useCallback(() => {
		setBitisDuyurusu(null);

		// Devam: parçalar zaten çıkarılmış, kaldığı yerden sürer.
		if (durum === "duraklatildi" && parcalarRef.current !== null) {
			void calistir(aktifRef.current);
			return;
		}

		setDurum("hazirlaniyor");

		void (async () => {
			// Yoklama sayfa yüklenirken değil, İLK BASIŞTA yapılır: kullanmayan
			// kullanıcı eklenti chunk'ını hiç indirmez ve webde gereken kullanıcı
			// jesti doğal olarak sağlanmış olur.
			const sonuc = await yetenegiYokla();
			setYetenek(sonuc);

			if (sonuc.durum !== "hazir") {
				setDurum("bosta");
				return;
			}

			const kok = kokRef.current;
			if (!kok) {
				setDurum("bosta");
				return;
			}

			parcalarRef.current = cikar(kok);
			if (parcalarRef.current.length === 0) {
				setDurum("bosta");
				return;
			}

			await calistir(0);
		})();
	}, [calistir, durum, kokRef]);

	const duraklat = useCallback(() => {
		kosuRef.current += 1;
		setDurum("duraklatildi");
		// Vurgu KALIR: kullanıcı nerede kaldığını görmeye devam etmeli.
		void getSpeechProvider().stop().catch(() => {});
	}, []);

	const durdur = useCallback(() => {
		kosuRef.current += 1;
		aktifRef.current = 0;
		setAktif(null);
		setDurum("bosta");
		vurguyuTemizle();
		void getSpeechProvider().stop().catch(() => {});
	}, [vurguyuTemizle]);

	const kurulumuAc = useCallback(() => {
		void getSpeechProvider().openInstall().catch(() => {});
	}, []);

	/*
	 * Hız değişimi okuma sırasında mevcut parçayı yeniden başlatır. İki gerekçe:
	 * kullanıcı değişikliği ANINDA duyar, ve bazı Android motorlarında
	 * `setSpeechRate` kuyruk ortasında etkisiz kalır.
	 */
	useEffect(() => {
		hizRef.current = HIZ_DEGERLERI[speechRate];
		if (!okuyorRef.current) return;
		const indeks = aktifRef.current;
		kosuRef.current += 1;
		void getSpeechProvider()
			.stop()
			.catch(() => {})
			.finally(() => {
				void calistir(indeks);
			});
		// `calistir` bilinçli olarak bağımlılık dışında: onu da dinlemek her
		// render'da yeniden başlatma riski doğurur.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [speechRate]);

	/*
	 * Uygulama arka plana alınınca DURAKLAT.
	 *
	 * Android arka plandaki WebView'in JS zamanlayıcılarını kısar ya da
	 * öldürür; parça zinciri ortada takılır ve metnin yarısı SESSİZCE okunmadan
	 * kalır. Duraklatmak bu sessiz bozulmayı imkânsız kılıyor — kullanıcı geri
	 * döndüğünde "Devam et"e basar.
	 */
	useEffect(() => {
		function gizlendi(): void {
			if (document.visibilityState === "hidden" && okuyorRef.current) {
				duraklat();
			}
		}
		document.addEventListener("visibilitychange", gizlendi);
		return () => document.removeEventListener("visibilitychange", gizlendi);
	}, [duraklat]);

	/*
	 * Temizlik — sesin kesinlikle susması.
	 *
	 * Capacitor'da native TTS bir İŞLETİM SİSTEMİ servisidir: WebView rota
	 * değiştirse de konuşmaya devam eder. Kullanıcı özetten çıkıp ana sayfaya
	 * gittiğinde ses susmazsa uygulama bozuk görünür.
	 */
	useEffect(() => {
		return () => {
			kosuRef.current += 1;
			void getSpeechProvider().stop().catch(() => {});
		};
	}, []);

	return {
		durum,
		yetenek,
		aktif,
		baslat,
		duraklat,
		durdur,
		kurulumuAc,
		bitisDuyurusu,
	};
}
