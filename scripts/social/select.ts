import type { Havuz, PaylasilabilirBilgi, PaylasilabilirSoru } from "./pool";
import type { LedgerSatiri } from "./types";

/**
 * İçerik seçimi. **Saf fonksiyonlar** — dosya sistemi, ağ ve tarih okumazlar;
 * her şey parametreden gelir. `lib/` kuralının aynısı: seçim mantığı testin
 * ucuz olduğu yerde durur (`tests/unit/social-select.test.ts`).
 *
 * İki kısıt seçimi yönlendirir:
 *
 * 1. **Tekrar yok.** Havuz 1300+ soruluk; günde bir paylaşımla üç yıldan uzun
 *    sürer. Tekrar önleme ledger üzerinden yapılır, rastgeleliğe güvenilmez.
 * 2. **Ders dönüşümü.** Ard arda aynı dersten paylaşım akışı monotonlaştırır;
 *    seçim son iki paylaşımın dersinden kaçınır.
 *
 * Rastgelelik `Math.random()` DEĞİL tarihten türetilen bir hash'tir: aynı gün
 * iki kez çalıştırılan iş akışı (yeniden deneme) aynı içeriği seçmeli, yoksa
 * ilk denemede üretilip yayımlanamamış kart ikinci denemede farklı bir soruya
 * ait olurdu.
 */

/** FNV-1a — kısa, bağımlılıksız ve platformlar arası aynı sonucu verir. */
export function hash(metin: string): number {
	let h = 0x811c9dc5;

	for (let i = 0; i < metin.length; i += 1) {
		h ^= metin.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}

	return h >>> 0;
}

/** Ledger'daki tüm anahtarlar — tekrar önlemenin tek kaynağı. */
function kullanilanAnahtarlar(ledger: LedgerSatiri[]): Set<string> {
	return new Set(ledger.map((satir) => satir.anahtar));
}

/**
 * Son `adet` `soru` paylaşımının ders kimlikleri (en yeniden eskiye).
 * Ledger ders bilgisini taşımaz; havuz üzerinden geri eşlenir.
 */
function sonDersler(
	ledger: LedgerSatiri[],
	sorular: PaylasilabilirSoru[],
	adet: number,
): string[] {
	const derse = new Map(sorular.map((s) => [s.id, s.subjectId]));

	return ledger
		.filter((satir) => satir.tur === "soru")
		.slice(-adet)
		.reverse()
		.map((satir) => derse.get(satir.refId))
		.filter((id): id is string => Boolean(id));
}

/**
 * Adaylar arasından kararlı biçimde birini seçer.
 *
 * `tohum` tarihtir; aynı gün aynı tür için hep aynı aday çıkar. Aday listesi
 * kimliğe göre sıralanır, çünkü havuzun dosya okuma sırası platformlar arası
 * garanti değil ve sıralamasız bir listede hash aynı indeksi farklı adaya
 * denk getirirdi.
 */
function tohumlaSec<T extends { id?: string; refId?: string }>(
	adaylar: T[],
	tohum: string,
): T | null {
	if (adaylar.length === 0) return null;

	const sirali = [...adaylar].sort((a, b) =>
		(a.id ?? a.refId ?? "").localeCompare(b.id ?? b.refId ?? "", "tr"),
	);

	return sirali[hash(tohum) % sirali.length];
}

/**
 * Günün sorusunu seçer.
 *
 * Havuz tükendiğinde `null` DÖNMEZ, baştan başlar: yıllar sonra ikinci turda
 * paylaşım akışının durması, sessiz bir arıza olurdu. İkinci turda da ledger
 * sırası korunur — en eski paylaşılan önce döner.
 */
export function soruSec(
	havuz: Havuz,
	ledger: LedgerSatiri[],
	tarih: string,
): PaylasilabilirSoru | null {
	if (havuz.sorular.length === 0) return null;

	const kullanilan = kullanilanAnahtarlar(ledger);
	let adaylar = havuz.sorular.filter(
		(soru) => !kullanilan.has(`soru:${soru.id}`),
	);

	if (adaylar.length === 0) {
		// Tur tamamlandı: en eski paylaşılanı öne al.
		const sira = new Map(
			ledger
				.filter((satir) => satir.tur === "soru")
				.map((satir, index) => [satir.refId, index]),
		);

		adaylar = [...havuz.sorular].sort(
			(a, b) =>
				(sira.get(a.id) ?? -1) - (sira.get(b.id) ?? -1),
		);

		return adaylar[0] ?? null;
	}

	const kacinilacak = new Set(sonDersler(ledger, havuz.sorular, 2));
	const farkliDers = adaylar.filter(
		(soru) => !kacinilacak.has(soru.subjectId),
	);

	// Ders çeşitliliği bir tercihtir, kural değil: tek dersten aday kalmışsa
	// paylaşımı atlamak yerine o dersten devam edilir.
	return tohumlaSec(farkliDers.length > 0 ? farkliDers : adaylar, tarih);
}

/**
 * Cevabı henüz paylaşılmamış EN SON soruyu bulur.
 *
 * Ledger'a değil havuza göre çözülür: soru havuzdan çıkarılmışsa (mükerrer
 * temizliği) cevabı da paylaşılamaz, o satır atlanır ve bir öncekine bakılır.
 */
export function cevapSec(
	havuz: Havuz,
	ledger: LedgerSatiri[],
): PaylasilabilirSoru | null {
	const kullanilan = kullanilanAnahtarlar(ledger);
	const sorular = new Map(havuz.sorular.map((soru) => [soru.id, soru]));

	for (let i = ledger.length - 1; i >= 0; i -= 1) {
		const satir = ledger[i];

		if (satir.tur !== "soru") continue;
		if (kullanilan.has(`cevap:${satir.refId}`)) continue;

		const soru = sorular.get(satir.refId);

		if (soru) return soru;
	}

	return null;
}

/** Bilgi kartı seçimi; soru seçimiyle aynı kurallar, farklı havuz. */
export function bilgiSec(
	havuz: Havuz,
	ledger: LedgerSatiri[],
	tarih: string,
): PaylasilabilirBilgi | null {
	if (havuz.bilgiler.length === 0) return null;

	const kullanilan = kullanilanAnahtarlar(ledger);
	const adaylar = havuz.bilgiler.filter(
		(bilgi) => !kullanilan.has(`bilgi:${bilgi.refId}`),
	);

	if (adaylar.length === 0) {
		const sira = new Map(
			ledger
				.filter((satir) => satir.tur === "bilgi")
				.map((satir, index) => [satir.refId, index]),
		);

		return (
			[...havuz.bilgiler].sort(
				(a, b) =>
					(sira.get(a.refId) ?? -1) - (sira.get(b.refId) ?? -1),
			)[0] ?? null
		);
	}

	const kacinilacak = new Set(sonDersler(ledger, havuz.sorular, 2));
	const farkliDers = adaylar.filter(
		(bilgi) => !kacinilacak.has(bilgi.subjectId),
	);

	return tohumlaSec(farkliDers.length > 0 ? farkliDers : adaylar, tarih);
}
