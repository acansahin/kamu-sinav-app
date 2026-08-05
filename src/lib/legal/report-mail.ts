import type { QuestionReport, ReportReason } from "@/types/progress";

/**
 * Hata bildirimlerini e-posta taslağına çevirir.
 *
 * Statik export'ta sunucu yoktur; bildirimi kullanıcının cihazından bize
 * ulaştırabilecek tek sunucusuz kanal `mailto:` bağlantısıdır. Faz 3'te
 * senkron açıldığında bildirimler zaten `reports` tablosuyla sunucuya
 * gidecek (`lib/sync/sync-tables.ts`); bu yol o zaman yedek kanal olarak
 * kalır.
 *
 * `lib/` React içe aktarmaz: burada yalnızca metin üretimi var, bu yüzden
 * saf ve testlenebilir.
 */

/**
 * Gövdenin karakter üst sınırı.
 *
 * `mailto:` bağlantısının uzunluğu standartla değil, işletim sistemi ve
 * e-posta istemcisiyle sınırlıdır; uzun bağlantılar bazı istemcilerde
 * sessizce KIRPILIR ya da hiç açılmaz. Bu yüzden sınır burada bilinçli ve
 * muhafazakâr tutulur: sığmayan bildirimler atılmaz, kullanıcıya tam listenin
 * yedek dosyasında olduğu söylenir.
 */
export const REPORT_MAIL_MAX_BODY = 1500;

export interface ReportMailInput {
	email: string;
	reports: QuestionReport[];
	/** Neden kodunu okunabilir etikete çevirir. */
	labelFor: (reason: ReportReason) => string;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("tr-TR");
}

function formatReport(
	report: QuestionReport,
	index: number,
	labelFor: (reason: ReportReason) => string,
): string {
	const lines = [
		`${index + 1}) ${report.questionId}`,
		`   Sorun: ${labelFor(report.reason)}`,
	];
	if (report.note) lines.push(`   Not: ${report.note}`);
	lines.push(`   Tarih: ${formatDate(report.createdAt)}`);
	return lines.join("\n");
}

/** Gövdeye sığan bildirimlerden metin üretir; sığmayanları sayar. */
export function buildReportMailBody({
	reports,
	labelFor,
}: Omit<ReportMailInput, "email">): string {
	const intro =
		"Merhaba,\n\nUygulamada işaretlediğim sorunlar aşağıdadır.\n\n";

	const blocks: string[] = [];
	let used = intro.length;
	let omitted = 0;

	reports.forEach((report, index) => {
		const block = formatReport(report, index, labelFor);
		// Sığmayan ilk bildirimden sonrakiler de sayılır: sıra korunur, araya
		// atlama girmez — kullanıcı listenin nerede kesildiğini bilir.
		if (omitted > 0 || used + block.length + 2 > REPORT_MAIL_MAX_BODY) {
			omitted += 1;
			return;
		}
		blocks.push(block);
		used += block.length + 2;
	});

	let body = intro + blocks.join("\n\n");

	if (omitted > 0) {
		body += `\n\n(Bu e-postaya ${omitted} bildirim daha sığmadı. Tamamı, Ayarlar > Verilerin > dışa aktar ile inen yedek dosyasındaki "reports" bölümündedir.)`;
	}

	return body;
}

/**
 * `mailto:` bağlantısı üretir. Bildirim yoksa `null` döner — boş bir taslak
 * açmak kullanıcıyı yanıltır.
 */
export function buildReportMailto({
	email,
	reports,
	labelFor,
}: ReportMailInput): string | null {
	if (reports.length === 0) return null;

	const subject =
		reports.length === 1
			? "Kamu Sınav Akademi — soru hata bildirimi"
			: `Kamu Sınav Akademi — ${reports.length} soru hata bildirimi`;

	const body = buildReportMailBody({ reports, labelFor });

	return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
