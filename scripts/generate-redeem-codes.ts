/**
 * Erişim kodu üretici.
 *
 *   npm run codes:generate -- 20 --etiket "ogretmen-grubu"
 *
 * Rastgele kod üretir, ÖZETİNİ `src/lib/billing/redeem-codes.ts` dosyasına
 * EKLER (üzerine yazmaz) ve kodların KENDİSİNİ yalnızca ekrana basar.
 *
 * ⚠️ **Kodlar hiçbir dosyaya yazılmaz ve geri getirilemez.** Özet tek yönlüdür;
 * ekrandaki listeyi kaybederseniz o kodlar sonsuza kadar kayıptır (ama listeden
 * silinmedikleri için kullanılmaya devam ederler). Çıktıyı çalıştırır çalıştırmaz
 * git'e girmeyen bir yere kaydedin.
 *
 * Bir kodu İPTAL etmek: özet satırını bu dosyadan silin ve yeni bir sürüm
 * yayımlayın. Uygulama kayıtlı kodu her açılışta listeye karşı yeniden
 * doğrular (`isRedemptionValid`), yani kod kullanılmış cihazlarda da hükümsüz
 * kalır.
 */

import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
	REDEEM_CODE_LENGTH,
	formatRedeemCode,
	redeemCodeHash,
} from "../src/lib/billing/redeem";

const ALFABE = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const HEDEF = path.join(process.cwd(), "src/lib/billing/redeem-codes.ts");

/** Mevcut özetler — sıra ve yorumlarıyla birlikte korunur. */
interface Kayit {
	hash: string;
	not: string;
}

function mevcutlariOku(): Kayit[] {
	let kaynak: string;
	try {
		kaynak = readFileSync(HEDEF, "utf8");
	} catch {
		return [];
	}

	const kayitlar: Kayit[] = [];
	// Satır biçimi: `\t"<64 hex>", // <not>`
	const desen = /"([0-9a-f]{64})",(?:\s*\/\/\s*(.*))?/g;
	for (const eslesme of kaynak.matchAll(desen)) {
		kayitlar.push({ hash: eslesme[1], not: (eslesme[2] ?? "").trim() });
	}
	return kayitlar;
}

/**
 * Tek kod.
 *
 * `randomInt` kriptografik ve REDDETME ÖRNEKLEMESİ yapar; `randomBytes % 32`
 * de burada eşit dağılırdı (32, 256'yı böler) ama alfabe uzunluğu bir gün
 * değişirse sessizce yanlı hâle gelirdi.
 */
function kodUret(): string {
	let kod = "";
	for (let i = 0; i < REDEEM_CODE_LENGTH; i++) {
		kod += ALFABE[randomInt(ALFABE.length)];
	}
	return kod;
}

function dosyaYaz(kayitlar: Kayit[]): void {
	const satirlar = kayitlar
		.map(({ hash, not }) => `\t"${hash}",${not ? ` // ${not}` : ""}`)
		.join("\n");

	const icerik = `/**
 * Geçerli erişim kodlarının SHA-256 özetleri — ÜRETİLMİŞ DOSYA.
 *
 * Elle düzenlenecek tek şey SİLME'dir: bir satırı çıkarmak o kodu iptal eder.
 * Yeni kod eklemek için \`npm run codes:generate\` çalıştırın; kodun kendisi
 * yalnızca o komutun çıktısında görünür, buraya asla yazılmaz.
 *
 * Özetler \`redeemCodeHash()\` ile üretilir (alan ayraçlı, bkz. \`redeem.ts\`).
 * Liste açık bir depoda durabilir: özetten kod geri üretilemez.
 */
export const REDEEM_CODE_HASHES: readonly string[] = [
${satirlar}
];
`;

	writeFileSync(HEDEF, icerik, "utf8");
}

function main(): void {
	const args = process.argv.slice(2);
	const etiketIndex = args.indexOf("--etiket");
	const etiket = etiketIndex >= 0 ? (args[etiketIndex + 1] ?? "") : "";
	const sayiArg = args.find((a) => /^\d+$/.test(a));
	const adet = sayiArg ? Number(sayiArg) : 10;

	if (adet < 1 || adet > 1000) {
		console.error("Adet 1 ile 1000 arasında olmalı.");
		process.exit(1);
	}

	const mevcut = mevcutlariOku();
	const bilinen = new Set(mevcut.map((k) => k.hash));
	const bugun = new Date().toISOString().slice(0, 10);
	const not = etiket ? `${bugun} ${etiket}` : bugun;

	const yeniKodlar: string[] = [];
	while (yeniKodlar.length < adet) {
		const kod = kodUret();
		const hash = redeemCodeHash(kod);
		// 60 bitte çakışma pratikte imkânsız; yine de sessiz bir kopya
		// üretmektense döngüyü tekrarlamak bedavadır.
		if (bilinen.has(hash)) continue;
		bilinen.add(hash);
		yeniKodlar.push(kod);
		mevcut.push({ hash, not });
	}

	dosyaYaz(mevcut);

	console.log(`\n${adet} kod üretildi (${not}).`);
	console.log("Bu liste BİR KEZ gösterilir — şimdi kaydedin:\n");
	for (const kod of yeniKodlar) console.log(`  ${formatRedeemCode(kod)}`);
	console.log(
		`\nÖzetler eklendi: src/lib/billing/redeem-codes.ts (toplam ${mevcut.length})`,
	);
	console.log("Kodlar ancak bu dosya bir sürümle yayımlandıktan sonra çalışır.\n");
}

main();
