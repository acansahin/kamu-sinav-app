"use client";

import {
	CircleCheck,
	Clock,
	Info,
	Lock,
	TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	PurchaseCancelledError,
	PurchasePendingError,
} from "@/lib/billing/billing-errors";
import {
	type BillingProduct,
	getBillingProvider,
} from "@/lib/billing/billing.provider";
import { refreshEntitlement, useEntitlement } from "@/lib/stores/entitlement";

/**
 * Tam erişim sayfasının gövdesi.
 *
 * Sayfa satın ALMIŞ kullanıcı için de bir yüzeydir (durum + geri yükleme);
 * bu yüzden adı "satın al" değil "tam erişim".
 *
 * Fiyat KODA GÖMÜLMEZ, her zaman mağazadan okunur (`priceString`). Gömülü bir
 * fiyat para birimi, vergi ve olası indirimlerle uyuşmazlığa düşer ve bu
 * mağaza reddi sebebidir.
 */

type Status =
	| { kind: "idle" }
	| { kind: "working" }
	| { kind: "info"; message: string }
	| { kind: "pending"; message: string }
	| { kind: "success"; message: string }
	| { kind: "error"; message: string };

/** İçerik sayıları — sunucudan gelir, elle yazılmaz. */
export interface CatalogTotals {
	subjects: number;
	topics: number;
	questions: number;
}

function messageOf(error: unknown): string {
	return error instanceof Error
		? error.message
		: "Satın alma tamamlanamadı. Lütfen daha sonra tekrar deneyin.";
}

export function PurchasePanel({ totals }: { totals: CatalogTotals }) {
	const entitlement = useEntitlement();
	const [supported, setSupported] = useState<boolean | undefined>(undefined);
	const [product, setProduct] = useState<BillingProduct | null>(null);
	const [status, setStatus] = useState<Status>({ kind: "idle" });

	/**
	 * Mağaza durumunu okur. Durumu KENDİSİ yazmaz, sonucu döndürür — böylece
	 * hem açılıştaki effect hem "Tekrar dene" butonu aynı işi paylaşır ve
	 * setState her iki durumda da bir promise geri çağrısında olur.
	 */
	const readStore = useCallback(async () => {
		const provider = await getBillingProvider();
		const available = await provider.isSupported();
		if (!available) return { supported: false, product: null };
		return { supported: true, product: await provider.getFullAccessProduct() };
	}, []);

	const apply = useCallback(
		(next: { supported: boolean; product: BillingProduct | null }) => {
			setSupported(next.supported);
			setProduct(next.product);
			if (next.supported && !next.product) {
				setStatus({
					kind: "error",
					message:
						"Fiyat bilgisi alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
				});
			}
		},
		[],
	);

	useEffect(() => {
		// Ürün bilgisi alınamazsa sayfa yine açılır; kullanıcı en azından neyin
		// dahil olduğunu okur ve geri yüklemeyi deneyebilir.
		let cancelled = false;

		readStore()
			.then((next) => {
				if (!cancelled) apply(next);
			})
			.catch(() => {
				if (!cancelled) setSupported(false);
			});

		return () => {
			cancelled = true;
		};
	}, [readStore, apply]);

	const owned = entitlement?.fullAccess === true;

	async function buy(): Promise<void> {
		setStatus({ kind: "working" });
		try {
			const provider = await getBillingProvider();
			await provider.purchaseFullAccess();
			await refreshEntitlement();
			setStatus({
				kind: "success",
				message: "Tam erişim açıldı. İyi çalışmalar!",
			});
		} catch (error) {
			// İptal bir hata değildir: kullanıcı bilinçli olarak vazgeçti ve
			// uyarı tonu görmemeli.
			if (error instanceof PurchaseCancelledError) {
				setStatus({ kind: "info", message: error.message });
				return;
			}
			if (error instanceof PurchasePendingError) {
				setStatus({ kind: "pending", message: error.message });
				return;
			}
			// "Zaten sahip" akışı sağlayıcıda sessizce başarı sayılır; burada
			// yalnızca hakkın gerçekten açıldığını doğrularız.
			await refreshEntitlement().catch(() => {});
			setStatus({ kind: "error", message: messageOf(error) });
		}
	}

	async function restore(): Promise<void> {
		setStatus({ kind: "working" });
		try {
			const provider = await getBillingProvider();
			const found = await provider.restore();
			await refreshEntitlement();
			setStatus(
				found
					? { kind: "success", message: "Tam erişiminiz geri yüklendi." }
					: {
							kind: "info",
							message:
								"Bu Google hesabında tam erişim bulunamadı. Play Store'da doğru hesapla giriş yaptığınızdan emin olun.",
						},
			);
		} catch (error) {
			setStatus({ kind: "error", message: messageOf(error) });
		}
	}

	const working = status.kind === "working";

	return (
		<div className="space-y-6">
			<Card>
				<h2 className="text-xl font-bold">Tam erişim</h2>
				<p className="mt-2 text-fg-muted">
					Uygulamanın bütün içeriği tek seferlik bir ödemeyle kalıcı olarak
					açılır. Abonelik değildir; yenilenmez, iptal edilmesi gerekmez.
				</p>

				<h3 className="mt-5 font-semibold">Neler açılır?</h3>
				<ul className="mt-2 space-y-2 text-fg-muted">
					{[
						`${totals.subjects} dersin ${totals.topics} konu özetinin tamamı`,
						`${totals.questions} sorunun tamamı — hepsinde mevzuat dayanağı ve açıklama`,
						"Süreli deneme sınavları",
						"Aramada soru sonuçları ve dersin tamamını yazdırma",
					].map((line) => (
						<li key={line} className="flex items-start gap-2">
							<CircleCheck
								aria-hidden
								size={18}
								className="mt-0.5 shrink-0 text-correct"
							/>
							{line}
						</li>
					))}
				</ul>
			</Card>

			{/*
			 * Ücretsiz kapsamın açıkça yazılması hem dürüstlüktür hem de kararı
			 * kolaylaştırır: kullanıcı satın almadan önce neyi deneyebileceğini
			 * bilir.
			 */}
			<Card className="bg-surface-sunken">
				<h3 className="font-semibold">Satın almadan da kullanabilirsiniz</h3>
				<p className="mt-2 text-sm text-fg-muted">
					<strong>Her dersin ilk konusu</strong> — özeti ve ilk testi — ücretsiz
					açıktır; {totals.subjects} dersin hepsini satın almadan
					deneyebilirsiniz. İlerleme takibi, istatistikler, tekrar planı ve konu
					arama da her zaman ücretsizdir.
				</p>
			</Card>

			<Card>
				{owned ? (
					<p className="flex items-center gap-2 font-semibold text-correct">
						<CircleCheck aria-hidden size={20} />
						Tam erişiminiz etkin.
					</p>
				) : (
					<>
						{product && (
							<p className="mb-3 text-lg font-bold">{product.priceString}</p>
						)}

						{/*
						 * Satın alma yapılamıyorsa buton DEVRE DIŞI değil, hiç
						 * gösterilmez: devre dışı bir buton neden çalışmadığını
						 * söylemez, açıklama metni söyler.
						 */}
						{supported === true && product && (
							<Button
								onClick={() => void buy()}
								disabled={working}
								aria-busy={working}
								block
							>
								<Lock aria-hidden size={18} />
								{working ? "İşleniyor…" : "Tam erişimi satın al"}
							</Button>
						)}

						{supported === false && (
							<p
								role="status"
								className="flex items-start gap-2 text-sm text-fg-muted"
							>
								<Info aria-hidden size={18} className="mt-0.5 shrink-0" />
								Bu cihazda Google Play üzerinden satın alma kullanılamıyor.
								Uygulamayı Google Play&rsquo;den kurduğunuzdan ve Play
								Store&rsquo;un güncel olduğundan emin olun.
							</p>
						)}
					</>
				)}

				{supported === true && (
					<Button
						variant="secondary"
						onClick={() => void restore()}
						disabled={working}
						aria-busy={working}
						block
						className="mt-3"
					>
						Satın alımları geri yükle
					</Button>
				)}

				{supported === true && !product && status.kind === "error" && (
					<Button
						variant="secondary"
						onClick={() => {
							setStatus({ kind: "idle" });
							readStore()
								.then(apply)
								.catch(() => setSupported(false));
						}}
						block
						className="mt-3"
					>
						Tekrar dene
					</Button>
				)}

				<StatusMessage status={status} />

				<p className="mt-4 text-sm text-fg-subtle">
					Tek seferlik ödeme, abonelik değildir. Ödeme Google Play üzerinden
					alınır; iade koşulları Google Play&rsquo;in kurallarına tabidir.
					Ayrıntılar için{" "}
					<Link
						href="/kullanim-kosullari"
						className="font-medium text-brand underline"
					>
						Kullanım Koşulları
					</Link>
					.
				</p>
			</Card>
		</div>
	);
}

/**
 * Durum bildirimi.
 *
 * Ton ile rol birlikte seçilir: gerçek hatalar `alert` (ekran okuyucu sözü
 * keser), bilgilendirmeler `status`. İptal ve "onay bekliyor" hata DEĞİLDİR ve
 * uyarı rengi kullanmaz.
 */
function StatusMessage({ status }: { status: Status }) {
	if (status.kind === "idle" || status.kind === "working") return null;

	const config = {
		info: { icon: Info, tone: "text-fg-muted", role: "status" as const },
		pending: { icon: Clock, tone: "text-fg-muted", role: "status" as const },
		success: {
			icon: CircleCheck,
			tone: "text-correct",
			role: "status" as const,
		},
		error: { icon: TriangleAlert, tone: "text-flag", role: "alert" as const },
	}[status.kind];

	const Icon = config.icon;

	return (
		<p
			role={config.role}
			aria-live="polite"
			className={`mt-4 flex items-start gap-2 text-sm font-medium ${config.tone}`}
		>
			<Icon aria-hidden size={18} className="mt-0.5 shrink-0" />
			{status.message}
		</p>
	);
}
