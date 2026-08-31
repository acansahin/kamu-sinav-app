"use client";

import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { REDEEM_CODE_LENGTH } from "@/lib/billing/redeem";
import { redeemAccessCode, useEntitlement } from "@/lib/stores/entitlement";

/**
 * Erişim kodu kutusu.
 *
 * Yalnızca kilit UYGULANAN ve HENÜZ AÇILMAMIŞ hâlde görünür:
 *
 *  - Tarayıcıda (`paywallActive === false`) hiç kilit yoktur; orada bir kod
 *    kutusu, olmayan bir kilidin çaresini sunmak olurdu (`PurchasePanel`in
 *    satın alma butonunu gizlemesiyle aynı gerekçe).
 *  - Hak zaten açıksa kutu gereksizdir ve kullanıcıyı "bir şey mi eksik?"
 *    diye düşündürür.
 *
 * Doğrulama tamamen yereldir ve ağ istemez — kod çevrimdışı da çalışır.
 */

type Durum =
	| { kind: "idle" }
	| { kind: "working" }
	| { kind: "info"; message: string }
	| { kind: "success"; message: string }
	| { kind: "error"; message: string };

export function RedeemPanel() {
	const entitlement = useEntitlement();
	const inputId = useId();
	const hintId = `${inputId}-aciklama`;

	const [code, setCode] = useState("");
	const [durum, setDurum] = useState<Durum>({ kind: "idle" });

	// `undefined` = hak henüz çözülmedi; bir kare kutu gösterip kaldırmak yerine
	// hiç gösterme.
	if (!entitlement?.paywallActive) return null;
	if (entitlement.fullAccess) return null;

	async function gonder(event: FormEvent): Promise<void> {
		event.preventDefault();
		setDurum({ kind: "working" });

		const sonuc = await redeemAccessCode(code);

		if (sonuc.ok) {
			setCode("");
			setDurum({
				kind: "success",
				message: "Kod kabul edildi. Tam erişim açıldı, iyi çalışmalar!",
			});
			return;
		}

		if (sonuc.reason === "bicim") {
			setDurum({
				kind: "info",
				message: `Kod ${REDEEM_CODE_LENGTH} karakterdir (örn. ABCD-1234-EFGH). Yazdığınızı kontrol edin.`,
			});
			return;
		}

		if (sonuc.reason === "depo") {
			setDurum({
				kind: "error",
				message:
					"Kod kabul edildi ama cihaza kaydedilemedi; erişim uygulamayı kapatınca kaybolur. Gizli sekmeyi kapatıp ya da cihaz depolama alanını boşaltıp tekrar deneyin.",
			});
			return;
		}

		setDurum({
			kind: "error",
			message:
				"Bu kod geçerli değil. Kodun size verilen biçimde olduğundan emin olun; kodlar tek seferlik değildir ama iptal edilmiş olabilir.",
		});
	}

	const working = durum.kind === "working";

	return (
		<Card>
			<h3 className="font-semibold">Erişim kodunuz var mı?</h3>
			<p id={hintId} className="mt-2 text-sm text-fg-muted">
				Kurum, kurs veya tanıtım kapsamında verilen kodu buraya yazın. Kod
				doğrulanınca tam erişim ödeme olmadan açılır. İnternet bağlantısı
				gerekmez.
			</p>

			<form onSubmit={(event) => void gonder(event)} className="mt-4">
				<label htmlFor={inputId} className="block font-semibold">
					Erişim kodu
				</label>
				{/*
				 * Kod büyük harf ve rakamdır; klavyenin sözlüğü, otomatik
				 * düzeltmesi ve büyütmesi kapatılır. Kanonik biçime indirgeme
				 * yine de `normalizeRedeemCode` içindedir — klavye ipuçları
				 * tavsiyedir, garanti değil.
				 */}
				<input
					id={inputId}
					value={code}
					onChange={(event) => {
						setCode(event.target.value);
						if (durum.kind !== "idle") setDurum({ kind: "idle" });
					}}
					aria-describedby={hintId}
					autoCapitalize="characters"
					autoCorrect="off"
					autoComplete="off"
					spellCheck={false}
					inputMode="text"
					placeholder="ABCD-1234-EFGH"
					className="mt-2 block min-h-11 w-full max-w-sm rounded-lg border-2 border-line bg-surface-raised px-3 font-mono text-base tracking-widest"
				/>

				<Button
					type="submit"
					variant="secondary"
					disabled={working || code.trim() === ""}
					aria-busy={working}
					block
					className="mt-3"
				>
					{working ? "Kontrol ediliyor…" : "Kodu kullan"}
				</Button>
			</form>

			<DurumMesaji durum={durum} />
		</Card>
	);
}

/**
 * Ton ile rol birlikte seçilir (`PurchasePanel` ile aynı sözleşme): gerçek
 * hatalar `alert`, biçim uyarısı ve başarı `status`. Yanlış yazılmış bir kod
 * hata DEĞİLDİR ve uyarı rengi kullanmaz.
 */
function DurumMesaji({ durum }: { durum: Durum }) {
	if (durum.kind === "idle" || durum.kind === "working") return null;

	const config = {
		info: { icon: Info, tone: "text-fg-muted", role: "status" as const },
		success: {
			icon: CircleCheck,
			tone: "text-correct",
			role: "status" as const,
		},
		error: { icon: TriangleAlert, tone: "text-flag", role: "alert" as const },
	}[durum.kind];

	const Icon = config.icon;

	return (
		<p
			role={config.role}
			aria-live="polite"
			className={`mt-4 flex items-start gap-2 text-sm font-medium ${config.tone}`}
		>
			<Icon aria-hidden size={18} className="mt-0.5 shrink-0" />
			{durum.message}
		</p>
	);
}
