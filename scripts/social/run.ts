import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { kartUret } from "./card";
import { CIKTI_DIR } from "./config";
import { ledgerOku, ledgereEkle } from "./ledger";
import { planOlustur } from "./plan";
import { havuzuOku } from "./pool";
import { YAYINCILAR } from "./publish";
import {
	postPlaniSchema,
	postTuruSchema,
	type PostPlani,
	type PostTuru,
	type YayinSonucu,
} from "./types";

/**
 * Sosyal medya hattının komut satırı arayüzü.
 *
 * ```
 * tsx scripts/social/run.ts --tur soru --asama plan
 * tsx scripts/social/run.ts --asama yayin
 * tsx scripts/social/run.ts --tur bilgi --kuru      # hiçbir şey paylaşmaz
 * ```
 *
 * **İki aşama neden ayrı:** Instagram görseli ikili kabul etmez, herkese açık
 * bir adresten çeker. Yani görsel paylaşımdan ÖNCE yayımlanmış olmalıdır ve
 * ikisinin arasında iş akışının bir `git push` adımı vardır. Tek aşamalı bir
 * betik bu adımı içeremezdi.
 *
 * Aşamalar arasındaki tek bağ `social-out/plan.json`dur ve şemayla
 * doğrulanarak okunur.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const PLAN_DOSYA = "plan.json";

type Argumanlar = {
	tur: PostTuru;
	asama: "plan" | "yayin";
	kuru: boolean;
	metin?: string;
};

function argumanlariOku(argv: string[]): Argumanlar {
	const oku = (ad: string): string | undefined => {
		const i = argv.indexOf(`--${ad}`);

		return i >= 0 ? argv[i + 1] : undefined;
	};

	const turHam = oku("tur") ?? "soru";
	const tur = postTuruSchema.safeParse(turHam);

	if (!tur.success) {
		throw new Error(
			`Bilinmeyen tür: ${turHam} (soru | cevap | bilgi | duyuru)`,
		);
	}

	const asamaHam = oku("asama") ?? "plan";

	if (asamaHam !== "plan" && asamaHam !== "yayin") {
		throw new Error(`Bilinmeyen aşama: ${asamaHam} (plan | yayin)`);
	}

	return {
		tur: tur.data,
		asama: asamaHam,
		kuru: argv.includes("--kuru"),
		metin: oku("metin") ?? process.env.SOCIAL_DUYURU,
	};
}

async function planAsamasi(arg: Argumanlar): Promise<void> {
	const cikti = path.join(ROOT, CIKTI_DIR);

	await mkdir(cikti, { recursive: true });

	const [havuz, ledger] = await Promise.all([havuzuOku(), ledgerOku()]);
	const bugun = new Date().toISOString().slice(0, 10);
	const sonuc = planOlustur(arg.tur, havuz, ledger, bugun, arg.metin);

	if (!sonuc) {
		// Paylaşılacak içerik yoksa bu bir HATA DEĞİLDİR: "cevap" türü,
		// cevabı bekleyen bir soru paylaşımı olmadığında boş döner ve iş
		// akışının kırmızıya dönmesi yanlış alarm olurdu.
		console.log(`  Paylaşılacak "${arg.tur}" içeriği yok — atlanıyor.`);

		return;
	}

	const { plan, kart } = sonuc;
	const gorselYolu = path.join(cikti, plan.gorsel);
	const bayt = await kartUret(kart, gorselYolu);

	await writeFile(
		path.join(cikti, PLAN_DOSYA),
		`${JSON.stringify(plan, null, "\t")}\n`,
	);

	console.log(`  Tür     : ${plan.tur}`);
	console.log(`  İçerik  : ${plan.refId}`);
	console.log(`  Görsel  : ${plan.gorsel} (${Math.round(bayt / 1024)} KB)`);
	console.log(`  Adres   : ${plan.gorselUrl}`);
	console.log(`  X metni : ${plan.metinler.x.length} karakter`);

	if (arg.kuru) {
		console.log("\n  --kuru: paylaşım yapılmadı, ledger'a yazılmadı.\n");
		console.log(plan.metinler.instagram);
	}
}

async function planiOku(): Promise<PostPlani | null> {
	try {
		const ham = JSON.parse(
			await readFile(path.join(ROOT, CIKTI_DIR, PLAN_DOSYA), "utf8"),
		) as unknown;

		return postPlaniSchema.parse(ham);
	} catch (hata) {
		if (
			typeof hata === "object" &&
			hata !== null &&
			"code" in hata &&
			(hata as { code?: string }).code === "ENOENT"
		) {
			return null;
		}

		throw hata;
	}
}

async function yayinAsamasi(): Promise<void> {
	const plan = await planiOku();

	if (!plan) {
		console.log("  Plan dosyası yok — plan aşaması içerik bulamamış.");

		return;
	}

	const gorselYolu = path.join(ROOT, CIKTI_DIR, plan.gorsel);
	const etkin = YAYINCILAR.filter((y) => y.yapilandirildiMi());

	for (const yayinci of YAYINCILAR) {
		if (!yayinci.yapilandirildiMi()) {
			console.log(
				`  ○ ${yayinci.platform}: atlandı (eksik: ${yayinci
					.eksikAnahtarlar()
					.join(", ")})`,
			);
		}
	}

	if (etkin.length === 0) {
		throw new Error(
			"Hiçbir platform yapılandırılmamış — sırlar tanımlı mı? " +
				"Kurulum: store/social-kurulum.md",
		);
	}

	const sonuclar: YayinSonucu[] = [];

	// Platformlar SIRAYLA denenir ve biri düşerse diğerleri sürer: paralel
	// çalıştırmak, bir platformun hız sınırı hatasında diğerlerinin de
	// yeniden denenmesine yol açardı.
	for (const yayinci of etkin) {
		try {
			const postId = await yayinci.paylas(plan, gorselYolu);

			sonuclar.push({ platform: yayinci.platform, basarili: true, postId });
			console.log(`  ✔ ${yayinci.platform}: ${postId}`);
		} catch (hata) {
			const mesaj = hata instanceof Error ? hata.message : String(hata);

			sonuclar.push({
				platform: yayinci.platform,
				basarili: false,
				hata: mesaj,
			});
			console.error(`  ✘ ${yayinci.platform}: ${mesaj}`);
		}
	}

	// Ledger her hâlükârda yazılır. Yalnızca başarılıları yazmak, sürekli
	// başarısız olan bir platformun aynı soruyu her gün yeniden denemesine
	// yol açardı; hangi içeriğin kullanıldığı paylaşımın sonucundan bağımsız.
	await ledgereEkle({
		anahtar: plan.anahtar,
		tur: plan.tur,
		refId: plan.refId,
		tarih: plan.tarih,
		gorsel: plan.gorsel,
		sonuclar,
	});

	if (sonuclar.every((s) => !s.basarili)) {
		throw new Error("Hiçbir platforma paylaşılamadı.");
	}
}

async function main(): Promise<void> {
	const arg = argumanlariOku(process.argv.slice(2));

	console.log(`\n  Sosyal medya · ${arg.asama} · ${arg.tur}\n`);

	if (arg.asama === "plan") {
		await planAsamasi(arg);
	} else if (arg.kuru) {
		console.log("  --kuru: yayın aşaması çalıştırılmadı.");
	} else {
		await yayinAsamasi();
	}

	console.log("");
}

main().catch((hata: unknown) => {
	console.error(hata instanceof Error ? hata.message : hata);
	process.exit(1);
});
