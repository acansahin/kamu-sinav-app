import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { LEDGER_DOSYA } from "./config";
import { ledgerSchema, type LedgerSatiri } from "./types";

/**
 * Paylaşım günlüğü.
 *
 * **Append-only** — `attempts` tablosuyla aynı gerekçe: hangi sorunun
 * paylaşıldığı tekrar önlemenin TEK kaynağıdır ve satırlar güncellenirse o
 * bilgi kaybolur. Başarısız paylaşımlar da yazılır; "denendi ama olmadı" ile
 * "hiç denenmedi" ayırt edilemezse hata sessizce tekrarlanır.
 *
 * Dosya git'te durur ve iş akışı her koşudan sonra geri commit'ler. Depo
 * dışında bir yerde tutmak (artifact, cache) bu hattı kalıcı bir duruma
 * bağımlı kılardı; artifact'lerin ömrü sınırlıdır ve süresi dolduğunda hat
 * havuzun başına dönüp aynı soruları yeniden paylaşırdı.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "..");

export function ledgerYolu(): string {
	return path.join(ROOT, LEDGER_DOSYA);
}

export async function ledgerOku(): Promise<LedgerSatiri[]> {
	try {
		const ham = JSON.parse(await readFile(ledgerYolu(), "utf8")) as unknown;

		return ledgerSchema.parse(ham);
	} catch (hata) {
		if (
			typeof hata === "object" &&
			hata !== null &&
			"code" in hata &&
			(hata as { code?: string }).code === "ENOENT"
		) {
			return [];
		}

		// Bozuk ledger SESSİZCE boş kabul EDİLMEZ: boş dönmek, havuzun başına
		// sarıp yayımlanmış soruları yeniden paylaşmak demekti.
		throw hata;
	}
}

/** Satırı sona ekler ve dosyayı yazar. Var olan satırlara dokunulmaz. */
export async function ledgereEkle(satir: LedgerSatiri): Promise<void> {
	const mevcut = await ledgerOku();
	const yol = ledgerYolu();

	await mkdir(path.dirname(yol), { recursive: true });
	await writeFile(yol, `${JSON.stringify([...mevcut, satir], null, "\t")}\n`);
}
