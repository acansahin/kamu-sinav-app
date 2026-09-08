import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { kartUret } from "./card";
import { CIKTI_DIR } from "./config";
import { planOlustur } from "./plan";
import { havuzuOku } from "./pool";
import type { LedgerSatiri } from "./types";

/**
 * Kart ve metinleri hiçbir şey paylaşmadan üretir — `npm run social:preview`.
 *
 * Cron'a güvenmeden önce çıktının gözle görülmesi gerekir: metin sarma
 * yaklaşık ölçümle yapılıyor (bkz. `card.ts`) ve uzun bir soru gövdesinde
 * kırpma devreye girebiliyor. Bu betik ledger'a DOKUNMAZ ve ağa çıkmaz.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");

async function main(): Promise<void> {
	const cikti = path.join(ROOT, CIKTI_DIR);

	await mkdir(cikti, { recursive: true });

	const havuz = await havuzuOku();

	console.log(
		`\n  Havuz: ${havuz.sorular.length} yayımlanmış soru · ${havuz.bilgiler.length} bilgi maddesi\n`,
	);

	const bugun = new Date().toISOString().slice(0, 10);
	// "cevap" bir önceki soru paylaşımına dayanır; önizlemede o satır uydurulur.
	const sahteLedger: LedgerSatiri[] = [];
	const soruPlani = planOlustur("soru", havuz, sahteLedger, bugun);

	if (soruPlani) {
		sahteLedger.push({
			anahtar: soruPlani.plan.anahtar,
			tur: "soru",
			refId: soruPlani.plan.refId,
			tarih: bugun,
			gorsel: soruPlani.plan.gorsel,
			sonuclar: [],
		});
	}

	const planlar = [
		soruPlani,
		planOlustur("cevap", havuz, sahteLedger, bugun),
		planOlustur("bilgi", havuz, sahteLedger, bugun),
		planOlustur(
			"duyuru",
			havuz,
			sahteLedger,
			bugun,
			"Soru havuzu 1400 soruya ulaştı. Beş ders, otuz konu; hepsi mevzuat dayanaklı.",
		),
	];

	for (const sonuc of planlar) {
		if (!sonuc) continue;

		const dosya = path.join(cikti, `onizleme-${sonuc.plan.tur}.jpg`);
		const bayt = await kartUret(sonuc.kart, dosya);

		console.log(`  ── ${sonuc.plan.tur.toUpperCase()} ${"─".repeat(60)}`);
		console.log(`  görsel: ${path.relative(ROOT, dosya)}  (${Math.round(bayt / 1024)} KB)`);
		console.log(`\n  [X · ${sonuc.plan.metinler.x.length} kr]\n`);
		console.log(girintile(sonuc.plan.metinler.x));
		console.log(`\n  [Instagram · ${sonuc.plan.metinler.instagram.length} kr]\n`);
		console.log(girintile(sonuc.plan.metinler.instagram));
		console.log("");
	}
}

function girintile(metin: string): string {
	return metin
		.split("\n")
		.map((satir) => `    ${satir}`)
		.join("\n");
}

main().catch((hata: unknown) => {
	console.error(hata);
	process.exit(1);
});
