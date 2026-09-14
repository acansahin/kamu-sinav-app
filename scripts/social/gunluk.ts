import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { kartUret } from "./card";
import {
	altMetinCevap,
	altMetinSoru,
	cevapMetni,
	secenekHarfi,
	soruMetni,
	xUzunluk,
} from "./compose";
import { CIKTI_DIR } from "./config";
import { ledgerOku, ledgereEkle } from "./ledger";
import { havuzuOku, type PaylasilabilirSoru } from "./pool";
import { gunlukSoruSec } from "./select";

/**
 * Elle paylaşım için günün soru + cevap paketi.
 *
 * `.github/workflows/social.yml` hattı otomatik paylaşım içindir; bu betik
 * onun **elle** karşılığıdır: kartları üretir, üç platformun metnini basar ve
 * ağa çıkmaz.
 *
 * ⚠️ **Her gün FARKLI soru.** Üretilen soru `social/ledger.json`e yazılır ve
 * bir daha seçilmez — otomatik hat da aynı kaydı okur. İlk sürüm ledger'a
 * bilinçli olarak yazmıyordu ("otomatik hattın kaydını kirletmesin") ve bu
 * yanlıştı: hafızası olmayan araç 2. gün için aynı soruyu iki kez üretti.
 * Elle ya da otomatik, paylaşılmış soru paylaşılmıştır.
 *
 * ```
 * npm run social:gunluk                         # bugünün sorusu
 * npm run social:gunluk -- --tarih 2026-09-15   # yarın için hazırla
 * npm run social:gunluk -- --yeni               # bugünkünü beğenmedim, başka
 * npm run social:gunluk -- --soru 657-hak-004   # belirli bir soru
 * ```
 *
 * Aynı gün yeniden çalıştırmak YENİ soru harcamaz: o tarihe kayıtlı soru
 * varsa kartları onun için yeniden üretir. Daha önce başka bir gün paylaşılmış
 * bir soruyu `--soru` ile istemek hata verir; bilerek tekrar etmek için
 * `--tekrar` gerekir.
 *
 * Ledger değiştiği için çalıştırdıktan sonra `social/ledger.json` commit'lenmeli.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");

function argOku(ad: string): string | undefined {
	const i = process.argv.indexOf(`--${ad}`);

	return i >= 0 ? process.argv[i + 1] : undefined;
}

function bayrak(ad: string): boolean {
	return process.argv.includes(`--${ad}`);
}

/**
 * Türkiye saatine göre bugünün tarihi. UTC kullanılsaydı gece 00.00–03.00
 * arasında çalıştırılan komut "dünün" sorusunu yeniden üretirdi.
 */
function bugun(): string {
	return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

/** Kartta ve akışta iyi duran soru: kısa gövde, kısa şıklar. */
function uygunMu(soru: PaylasilabilirSoru): boolean {
	return soru.stem.length < 115 && soru.options.every((o) => o.length < 48);
}

function basliklariYaz(baslik: string): void {
	console.log(`\n${"═".repeat(72)}\n  ${baslik}\n${"═".repeat(72)}`);
}

function metinYaz(platform: string, metin: string, sinir?: number): void {
	const olcu = sinir
		? `${xUzunluk(metin)}/${sinir} karakter`
		: `${metin.length} karakter`;

	console.log(`\n── ${platform} · ${olcu} ${"─".repeat(40)}\n`);
	console.log(metin);
}

async function main(): Promise<void> {
	const tarih = argOku("tarih") ?? bugun();

	if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
		throw new Error(`Tarih YYYY-AA-GG biçiminde olmalı: ${tarih}`);
	}

	const [havuz, ledger] = await Promise.all([havuzuOku(), ledgerOku()]);
	const istenen = argOku("soru");
	const secim = gunlukSoruSec(havuz, ledger, tarih, {
		soruId: istenen,
		yeni: bayrak("yeni"),
		uygunMu,
	});

	if (!secim) {
		throw new Error(
			istenen
				? `Havuzda "${istenen}" kimlikli yayımlanmış soru yok.`
				: "Havuzda uygun soru bulunamadı.",
		);
	}

	const { soru } = secim;

	if (secim.kayitli && secim.kayitTarihi !== tarih && !bayrak("tekrar")) {
		throw new Error(
			`"${soru.id}" ${secim.kayitTarihi} tarihinde zaten paylaşıldı. ` +
				"Farklı bir soru için --soru vermeden çalıştırın; bilerek tekrar " +
				"etmek için --tekrar ekleyin.",
		);
	}

	if (!uygunMu(soru)) {
		console.warn(
			"\n  ! Bu soru uzun; kartta kırpılabilir. Çıktıyı gözle kontrol edin.",
		);
	}

	if (!secim.kayitli) {
		// Cevap da hemen yazılır: otomatik hat "cevabı bekleyen soru" arıyor ve
		// elle paylaşılmış bir sorunun cevabını ikinci kez paylaşmamalı.
		await ledgereEkle({
			anahtar: `soru:${soru.id}`,
			tur: "soru",
			refId: soru.id,
			tarih,
			gorsel: `gunluk/${tarih}/01-soru.jpg`,
			sonuclar: [],
		});
		await ledgereEkle({
			anahtar: `cevap:${soru.id}`,
			tur: "cevap",
			refId: soru.id,
			tarih,
			gorsel: `gunluk/${tarih}/02-cevap.jpg`,
			sonuclar: [],
		});
	}

	// Her gün kendi klasöründe: bir sonraki günün kartı öncekinin üstüne
	// yazılmasın, hangi kartın hangi güne ait olduğu dosya yolundan okunsun.
	const cikti = path.join(ROOT, CIKTI_DIR, "gunluk", tarih);

	await mkdir(cikti, { recursive: true });

	const dogru = `${secenekHarfi(soru.correctIndex)}) ${soru.options[soru.correctIndex]}`;
	const soruKart = path.join(cikti, "01-soru.jpg");
	const cevapKart = path.join(cikti, "02-cevap.jpg");

	await kartUret(
		{
			tur: "soru",
			rozet: "GÜNÜN SORUSU",
			ustBilgi: `${soru.subjectAdi} · ${soru.konuAdi}`,
			baslik: soru.stem,
			satirlar: soru.options,
		},
		soruKart,
	);

	await kartUret(
		{
			tur: "cevap",
			rozet: "CEVAP",
			ustBilgi: `${soru.subjectAdi} · ${soru.konuAdi}`,
			baslik: soru.explanation,
			vurgu: dogru,
			dayanak: soru.dayanak,
		},
		cevapKart,
	);

	const kullanilan = (await ledgerOku()).filter((s) => s.tur === "soru").length;

	console.log(`\n  Tarih: ${tarih}`);
	console.log(`  Soru : ${soru.id} · ${soru.subjectAdi} — ${soru.konuAdi}`);
	console.log(`  Doğru: ${dogru}`);
	console.log(
		secim.kayitli
			? "  Kayıt: bu tarih için kayıtlı soru yeniden üretildi (yeni soru harcanmadı)"
			: `  Kayıt: ledger'a yazıldı · paylaşılan soru sayısı: ${kullanilan}`,
	);
	console.log(`  Kart : ${path.relative(ROOT, soruKart)}`);
	console.log(`         ${path.relative(ROOT, cevapKart)}`);

	basliklariYaz("SABAH — GÜNÜN SORUSU");
	metinYaz("X", soruMetni(soru, "x"), 280);
	metinYaz("Instagram", soruMetni(soru, "instagram"));
	metinYaz("Facebook", soruMetni(soru, "facebook"));
	console.log(`\n── Görsel alt metni ${"─".repeat(46)}\n`);
	console.log(altMetinSoru(soru));

	basliklariYaz("AKŞAM — CEVAP");
	metinYaz("X", cevapMetni(soru, "x"), 280);
	metinYaz("Instagram", cevapMetni(soru, "instagram"));
	metinYaz("Facebook", cevapMetni(soru, "facebook"));
	console.log(`\n── Görsel alt metni ${"─".repeat(46)}\n`);
	console.log(altMetinCevap(soru));
	console.log("");
}

main().catch((hata: unknown) => {
	console.error(hata instanceof Error ? hata.message : hata);
	process.exit(1);
});
