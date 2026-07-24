"use client";

import { ArrowLeft, Cloud, LogOut, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthUnavailableError, authProvider } from "@/lib/auth/auth.provider";
import { signInWithCode, signOut } from "@/lib/auth/session";
import { isAccountConfigured } from "@/lib/auth/supabase-client";
import { useIdentity } from "@/lib/stores/identity";
import { SyncStatusCard } from "./sync-status-card";

type Step = "email" | "code";

/**
 * Kod uzunluğu SUNUCU AYARIDIR, sabit değildir.
 *
 * Supabase'de 6–10 arası yapılandırılabilir (Authentication → Providers →
 * Email → Email OTP Length) ve projeden projeye farklı olabilir. Arayüz tek bir
 * uzunluğa kilitlenirse ayar değiştiğinde giriş imkânsız hâle gelir: kutu
 * fazla haneleri kırpar, düğme de hiç etkinleşmez. Gerçek bir kurulumda
 * yaşandı — 8 haneli kod üreten bir projede kimse giriş yapamıyordu.
 *
 * Bu yüzden arayüz bir aralık kabul eder ve doğrulamayı sunucuya bırakır;
 * yanlış uzunluktaki kodu zaten Supabase reddediyor.
 */
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

/** Alan etiketi + girdi; ekran okuyucu ve klavye desteği tarayıcıdan gelir. */
function Field({
	label,
	hint,
	...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
	const id = useId();
	const hintId = `${id}-aciklama`;

	return (
		<div>
			<label htmlFor={id} className="block font-semibold">
				{label}
			</label>
			{hint && (
				<p id={hintId} className="mt-1 text-sm text-fg-muted">
					{hint}
				</p>
			)}
			<input
				id={id}
				aria-describedby={hint ? hintId : undefined}
				className="mt-2 block min-h-11 w-full max-w-sm rounded-lg border-2 border-line bg-surface-raised px-3 text-base"
				{...props}
			/>
		</div>
	);
}

export function AccountPanel() {
	const identity = useIdentity();
	const configured = isAccountConfigured();

	const [step, setStep] = useState<Step>("email");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	async function requestCode(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		setNotice(null);

		try {
			await authProvider.requestCode(email.trim());
			setStep("code");
			setNotice(`Kod ${email.trim()} adresine gönderildi.`);
		} catch (caught) {
			setError(messageFor(caught));
		} finally {
			setBusy(false);
		}
	}

	async function submitCode(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);

		try {
			const result = await signInWithCode(email.trim(), code.trim());
			setCode("");
			setStep("email");
			// Senkron en iyi çabadır; tamamlanmadıysa dürüstçe söyle — veri
			// kaybolmadı, yalnızca çevrimiçi olunca eşitlenecek.
			const base = result.claimedLocalData
				? "Giriş yapıldı. Bu cihazdaki ilerlemen hesabına taşındı."
				: "Giriş yapıldı.";
			setNotice(
				result.synced
					? base
					: `${base} Değişikliklerin çevrimiçi olduğunda eşitlenecek.`,
			);
		} catch (caught) {
			setError(messageFor(caught));
		} finally {
			setBusy(false);
		}
	}

	async function leave() {
		setBusy(true);
		setError(null);
		try {
			await signOut();
			setNotice("Çıkış yapıldı. İlerlemen bu cihazda kaldı.");
		} catch (caught) {
			// Yerel çıkış `signOut` içinde zaten tamamlandı; buraya ancak
			// sunucuya haber verilemediğinde düşülür.
			setError(messageFor(caught));
		} finally {
			setBusy(false);
		}
	}

	// --- Hesap özelliği bu derlemede yok --------------------------------------
	if (!configured) {
		return (
			<Card>
				<h2 className="mb-1 text-lg font-bold">Hesap henüz açık değil</h2>
				<p className="text-fg-muted">
					Bu sürümde giriş yapılamıyor. İhtiyacın da yok: uygulamanın tamamı
					hesapsız çalışıyor ve ilerlemen bu cihazda tutuluyor.
				</p>
				<p className="mt-3 text-fg-muted">
					Başka bir cihaza geçmek istersen Ayarlar&rsquo;daki{" "}
					<strong className="font-semibold text-fg">Verilerin</strong>{" "}
					bölümünden dışa aktarıp öbür cihazda içe aktarabilirsin.
				</p>
			</Card>
		);
	}

	// --- Girişli -------------------------------------------------------------
	if (identity.kind === "account") {
		return (
			<div className="space-y-4">
				<Card>
					<h2 className="mb-1 text-lg font-bold">Giriş yapıldı</h2>
					<p className="mb-5 text-fg-muted">
						<span className="font-medium text-fg">{identity.email}</span>
					</p>

					<Button variant="secondary" onClick={() => void leave()} disabled={busy}>
						<LogOut aria-hidden size={18} />
						Çıkış yap
					</Button>

					<p className="mt-3 text-sm text-fg-muted">
						Çıkış yaptığında ilerlemen silinmez; bu cihazda kalmaya devam eder.
					</p>

					{notice && (
						<p role="status" className="mt-4 text-sm font-medium text-fg">
							{notice}
						</p>
					)}
				</Card>

				<SyncStatusCard />
			</div>
		);
	}

	// --- Girişsiz ------------------------------------------------------------
	return (
		<div className="space-y-4">
			<Card>
				{step === "email" ? (
					<form onSubmit={(e) => void requestCode(e)} className="space-y-4">
						<div>
							<h2 className="mb-1 text-lg font-bold">Giriş yap</h2>
							<p className="text-fg-muted">
								E-posta adresini yaz, sana bir giriş kodu gönderelim.
								Şifre yok, hatırlaman gereken bir şey yok.
							</p>
						</div>

						<Field
							label="E-posta adresin"
							type="email"
							name="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							inputMode="email"
							required
							disabled={busy}
						/>

						<Button type="submit" disabled={busy || email.trim().length === 0}>
							<Mail aria-hidden size={18} />
							{busy ? "Gönderiliyor…" : "Kod gönder"}
						</Button>

						{/*
						 * Aydınlatma, verinin alındığı YERDE ve işleme başlamadan ÖNCE
						 * görünmek zorunda (KVKK m.10; Aydınlatma Tebliği m.5). Bu bir
						 * onay kutusu değildir — aydınlatma açık rıza ile karıştırılmaz.
						 */}
						<p className="text-sm text-fg-muted">
							E-posta adresin yalnızca giriş için kullanılır. Ayrıntı:{" "}
							<Link href="/gizlilik" className="font-medium text-brand">
								Kişisel Verilerin Korunması
							</Link>
							.
						</p>
					</form>
				) : (
					<form onSubmit={(e) => void submitCode(e)} className="space-y-4">
						<div>
							<h2 className="mb-1 text-lg font-bold">Kodu gir</h2>
							<p className="text-fg-muted">
								<span className="font-medium text-fg">{email}</span> adresine
								gönderdiğimiz kodu yaz. E-posta birkaç dakika gecikebilir;
								gelmediyse istenmeyen klasörüne de bak.
							</p>
						</div>

						<Field
							label="Giriş kodu"
							type="text"
							name="code"
							value={code}
							onChange={(e) =>
								setCode(
									e.target.value.replace(/\D/g, "").slice(0, MAX_CODE_LENGTH),
								)
							}
							// `one-time-code` mobil klavyelerde kodu otomatik doldurur.
							autoComplete="one-time-code"
							inputMode="numeric"
							pattern="[0-9]*"
							required
							disabled={busy}
						/>

						<div className="flex flex-wrap gap-3">
							<Button
								type="submit"
								disabled={busy || code.length < MIN_CODE_LENGTH}
							>
								<ShieldCheck aria-hidden size={18} />
								{busy ? "Doğrulanıyor…" : "Giriş yap"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								disabled={busy}
								onClick={() => {
									setStep("email");
									setCode("");
									setError(null);
									setNotice(null);
								}}
							>
								<ArrowLeft aria-hidden size={18} />
								Adresi değiştir
							</Button>
						</div>
					</form>
				)}

				{/* Renk tek başına anlam taşımaz: hata da bilgi de metinle anlatılır. */}
				{error && (
					<p
						role="alert"
						className="mt-4 rounded-lg border border-wrong bg-wrong-soft p-3 text-sm font-medium text-wrong"
					>
						{error}
					</p>
				)}
				{notice && !error && (
					<p role="status" className="mt-4 text-sm font-medium text-fg">
						{notice}
					</p>
				)}
			</Card>

			<Card>
				<h2 className="mb-1 flex items-center gap-2 text-base font-bold">
					<Cloud aria-hidden size={18} className="text-fg-subtle" />
					Hesap ne işe yarar, hangi veriyi alırız
				</h2>
				<ul className="mt-2 space-y-2 text-sm text-fg-muted">
					<li>
						Yalnızca <strong className="text-fg">e-posta adresini</strong>{" "}
						saklarız. Ad, telefon veya kurum bilgisi istemiyoruz.
					</li>
					<li>
						Giriş yaptığında bu cihazdaki ilerlemen hesabına taşınır; çıkış
						yaptığında cihazda kalır.
					</li>
					<li>
						Hesap zorunlu değildir — uygulamanın tamamı hesapsız ve çevrimdışı
						çalışmaya devam eder.
					</li>
				</ul>
				<p className="mt-3 text-sm">
					<Link href="/gizlilik" className="font-medium text-brand">
						Kişisel Verilerin Korunması aydınlatma metni
					</Link>
				</p>
			</Card>
		</div>
	);
}

function messageFor(caught: unknown): string {
	if (caught instanceof AuthUnavailableError) return caught.message;
	if (caught instanceof Error && caught.message) return caught.message;
	return "Bir sorun oluştu. Yeniden dener misin?";
}
