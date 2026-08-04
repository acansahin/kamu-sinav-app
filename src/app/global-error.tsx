"use client";

/**
 * Son savunma hattı: kök düzenin KENDİSİ çökerse burası devreye girer.
 *
 * Bu yüzden kendi `<html>`/`<body>`'sini render eder ve **Tailwind sınıfı
 * kullanmaz**. `globals.css` kök düzen üzerinden yüklendiği için, düzenin
 * çöktüğü senaryoda stil sayfasının uygulanmış olduğu varsayılamaz — o hâlde
 * bu ekran da okunmaz bir metin yığınına dönerdi. Bütün stil satır içidir.
 *
 * APK'da bunun karşılığı doğrudan kurtarılabilirliktir: WebView'de adres çubuğu
 * yoktur, kullanıcı sayfayı yenileyemez. Bir "Yeniden dene" tuşu olmadan
 * uygulamayı kapatıp açmaktan başka çıkış kalmaz.
 *
 * Font yığını sistemdendir: `next/font/google` build sırasında ağ isteği yapar
 * ve statik export'ta yasaktır (AGENTS.md).
 */

const FONT_STACK =
	'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<html lang="tr">
			<body
				style={{
					margin: 0,
					minHeight: "100dvh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "1.5rem",
					fontFamily: FONT_STACK,
					fontSize: "16px",
					lineHeight: 1.6,
					background: "#ffffff",
					color: "#18181b",
				}}
			>
				{/*
				 * Koyu tema burada CİHAZIN tercihinden okunur, uygulamanınkinden
				 * değil: uygulama tercihini localStorage'dan okuyan betik kök
				 * düzende yaşıyor ve bu ekranın var olduğu durumda çalışmamış
				 * olabilir.
				 */}
				<style>{`
					@media (prefers-color-scheme: dark) {
						body { background: #18181b !important; color: #fafafa !important; }
						.gerekce { background: #27272a !important; color: #a1a1aa !important; }
						.ikincil { border-color: #3f3f46 !important; color: #fafafa !important; }
					}
					button:focus-visible, a:focus-visible {
						outline: 3px solid #2563eb;
						outline-offset: 2px;
					}
				`}</style>

				<main style={{ maxWidth: "32rem", width: "100%", textAlign: "center" }}>
					<p style={{ fontSize: "3rem", margin: "0 0 0.5rem" }} aria-hidden>
						⚠️
					</p>
					<h1
						style={{
							fontSize: "1.5rem",
							fontWeight: 700,
							margin: "0 0 0.75rem",
						}}
					>
						Uygulama beklenmedik bir hatayla karşılaştı
					</h1>
					<p style={{ margin: "0 0 1.5rem" }}>
						Çalışmanız kaybolmadı: çözdüğünüz testler ve ilerlemeniz cihazınızda
						saklı. Aşağıdaki tuşla uygulamayı yeniden başlatabilirsiniz.
					</p>

					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "0.75rem",
							alignItems: "stretch",
						}}
					>
						<button
							type="button"
							onClick={reset}
							style={{
								minHeight: "44px",
								padding: "0.5rem 1.5rem",
								borderRadius: "0.5rem",
								border: "none",
								background: "#2563eb",
								color: "#ffffff",
								fontSize: "1rem",
								fontWeight: 600,
								fontFamily: "inherit",
								cursor: "pointer",
							}}
						>
							Yeniden dene
						</button>
						{/*
						 * Bilinçli olarak `next/link` DEĞİL: buraya düşülmüşse kök düzen
						 * çökmüştür ve yönlendiriciye güvenilemez. Ham `<a>` tam sayfa
						 * yüklemesi yapar, yani uygulamayı gerçekten sıfırdan başlatır.
						 */}
						{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
						<a
							href="/"
							className="ikincil"
							style={{
								minHeight: "44px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "0.5rem 1.5rem",
								borderRadius: "0.5rem",
								border: "1px solid #d4d4d8",
								color: "#18181b",
								fontSize: "1rem",
								fontWeight: 600,
								textDecoration: "none",
							}}
						>
							Ana sayfaya dön
						</a>
					</div>

					{/*
					 * Hata kimliği yalnızca varsa gösterilir. Kullanıcı bunu bildirime
					 * ekleyebilsin diye duruyor; hata mesajının kendisi teknik ve
					 * çoğunlukla İngilizce olduğu için gösterilmez.
					 */}
					{error.digest && (
						<p
							className="gerekce"
							style={{
								marginTop: "1.5rem",
								padding: "0.5rem 0.75rem",
								borderRadius: "0.5rem",
								background: "#f4f4f5",
								color: "#52525b",
								fontSize: "0.875rem",
							}}
						>
							Hata kimliği: <code>{error.digest}</code>
						</p>
					)}
				</main>
			</body>
		</html>
	);
}
