import {
	AlertTriangle,
	BookOpenCheck,
	FileCheck2,
	Scale,
	Map as MapIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
	LICENSE_LABELS,
	SOURCE_KIND_LABELS,
	countByLicense,
	countBySourceKind,
	countWithLegalRef,
	summarizeSubjectTrust,
} from "@/lib/content/about-stats";
import { contentRepository } from "@/lib/repositories/content.repository";
import type { SummaryDoc } from "@/types/content";

export const metadata: Metadata = {
	title: "Hakkında",
	description:
		"İçerik sürümü, mevzuat güncellik tarihleri, soruların kaynağı ve telif bildirimi. Uygulamanın neyi nasıl iddia ettiğini denetleyebileceğiniz sayfa.",
};

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("tr-TR", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

/**
 * Şeffaflık sayfası — PROJECT_PLAN.md §11, ekran 16.
 *
 * Ürünün farklılaşma tezi "hacimde değil güvende yarışmak" (§4). Bu sayfa o
 * iddiayı denetlenebilir kılar: içerik ne zaman derlendi, hangi konu en son ne
 * zaman doğrulandı, sorular nereden geldi ve hangi lisansla duruyor.
 *
 * Tüm sayılar derleme zamanında içerikten TÜRETİLİR, elle yazılmaz — böylece
 * içerik büyüdüğünde sayfa kendiliğinden doğru kalır ve bir daha bakımı
 * unutulmuş bir "hakkında" metni oluşmaz.
 */
export default async function AboutPage() {
	const manifest = await contentRepository.getManifest();
	const subjects = manifest.subjects;

	// Özetler ders/konu başına ayrı dosyalarda; hepsi derleme anında okunur.
	const summaries = (
		await Promise.all(
			subjects.flatMap((subject) =>
				subject.topics
					.filter((topic) => topic.hasSummary)
					.map((topic) => contentRepository.getSummary(subject.id, topic.slug)),
			),
		)
	).filter((doc): doc is SummaryDoc => doc !== null);

	const questions = await contentRepository.getAllQuestions();

	const trust = summarizeSubjectTrust(subjects, summaries);
	const sources = countBySourceKind(questions);
	const licenses = countByLicense(questions);
	const withLegalRef = countWithLegalRef(questions);

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Hakkında</h1>
			<p className="mb-6 text-fg-muted">
				Bu sayfa uygulamanın iddialarını denetlenebilir kılar: içerik ne zaman
				derlendi, hangi konu en son ne zaman doğrulandı, sorular nereden geldi.
			</p>

			{/*
			 * Sorumluluk reddi denetlenebilirlik iddiasının önüne konulur: sayfanın
			 * geri kalanı içeriğin ne kadar sağlam olduğunu anlatıyor ve bu, tek
			 * başına okunduğunda resmîlik izlenimi doğurabilir.
			 */}
			<Card className="mb-6 border-flag/40 bg-flag-soft">
				<p className="flex items-center gap-2 font-bold text-flag">
					<AlertTriangle aria-hidden size={20} />
					Bu uygulama resmî değildir
				</p>
				<div className="mt-2 space-y-2 text-fg">
					<p>
						Kamu Sınav Akademi bağımsız bir hazırlık aracıdır; hiçbir bakanlık,
						kurum, kuruluş veya sınav merkeziyle bağlantılı değildir ve onlar
						tarafından onaylanmamıştır. Sorular bu uygulama için hazırlanmıştır;
						girdiğiniz sınavda çıkacak soruları göstermez.
					</p>
					<p>
						İçerik bilgi amaçlıdır ve hukuki tavsiye değildir. Bağlayıcı olan
						tek metin, Resmî Gazete&rsquo;de yayımlanan mevzuatın yürürlükteki
						hâlidir — aşağıdaki doğrulama tarihleri de bunu ölçmek içindir.{" "}
						<Link href="/kullanim-kosullari">Kullanım Koşulları</Link>
					</p>
				</div>
			</Card>

			{/* --- İçerik sürümü ------------------------------------------------- */}
			<Card className="mb-6 border-brand/40 bg-brand-soft">
				<p className="flex items-center gap-2 font-bold text-brand">
					<FileCheck2 aria-hidden size={20} />
					İçerik sürümü
				</p>
				<ul className="mt-2 space-y-1.5 text-fg">
					<li>
						<strong>{manifest.totals.subjects} ders</strong> ·{" "}
						<strong>{manifest.totals.topics} konu</strong> ·{" "}
						<strong>{manifest.totals.publishedQuestions} yayımlanmış soru</strong>
					</li>
					<li>
						Bu sürüm{" "}
						<strong>{formatDate(manifest.generatedAt)}</strong> tarihinde
						derlendi.
					</li>
					<li>
						Her sorunun mevzuat dayanağı var:{" "}
						<strong>
							{withLegalRef} / {questions.length}
						</strong>{" "}
						soruda kanun ve madde bilgisi yazılı.
					</li>
				</ul>
			</Card>

			{/* --- Kapsam ve güncellik ------------------------------------------- */}
			<h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
				<BookOpenCheck aria-hidden size={20} className="text-fg-subtle" />
				Kapsam ve mevzuat güncelliği
			</h2>
			<p className="mb-3 text-fg-muted">
				Doğrulama tarihi olarak dersin <strong>en eski</strong> konusu yazılır —
				güven en zayıf halkadan okunur.
			</p>

			{/*
			 * Dar ekranda tablo yatayda taşar ve bu kutu kaydırılabilir hâle gelir.
			 * Kaydırılabilir bir bölge klavyeyle odaklanamazsa, fare/dokunma
			 * kullanamayan biri tablonun sağ tarafını hiç göremez (WCAG 2.1.1).
			 * `tabIndex` odaklanmayı, `role`+`aria-label` ise ekran okuyucuda
			 * bölgenin ne olduğunu söyler.
			 */}
			<div
				role="region"
				aria-label="Ders başına kapsam ve mevzuat güncelliği tablosu"
				tabIndex={0}
				className="mb-6 overflow-x-auto"
			>
				<table className="w-full min-w-md border-collapse text-left">
					<thead>
						<tr className="border-b-2 border-line">
							<th className="py-2 pr-3 font-semibold">Ders</th>
							<th className="py-2 pr-3 font-semibold">Konu</th>
							<th className="py-2 pr-3 font-semibold">Özet</th>
							<th className="py-2 pr-3 font-semibold">Soru</th>
							<th className="py-2 font-semibold">En eski doğrulama</th>
						</tr>
					</thead>
					<tbody>
						{trust.map((row) => (
							<tr key={row.subjectId} className="border-b border-line">
								<td className="py-2 pr-3 font-medium">{row.name}</td>
								<td className="py-2 pr-3">{row.topics}</td>
								<td className="py-2 pr-3">
									{row.summaries} / {row.topics}
								</td>
								<td className="py-2 pr-3">{row.questions}</td>
								<td className="py-2">
									{row.oldestVerifiedAt
										? formatDate(row.oldestVerifiedAt)
										: "—"}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<Card className="mb-6">
				<h3 className="mb-2 font-bold">Dayanılan mevzuat sürümleri</h3>
				<ul className="space-y-1.5 text-sm text-fg-muted">
					{trust.map((row) => (
						<li key={row.subjectId}>
							<strong className="text-fg">{row.name}:</strong>{" "}
							{row.legislationVersions.length > 0
								? row.legislationVersions.join(", ")
								: "—"}
						</li>
					))}
				</ul>
			</Card>

			{/* --- Kaynak ve telif ----------------------------------------------- */}
			<h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
				<Scale aria-hidden size={20} className="text-fg-subtle" />
				Sorular nereden geliyor?
			</h2>
			<p className="mb-3 text-fg-muted">
				Her sorunun kökeni ve lisansı içerikte kayıtlıdır; aşağıdaki sayılar o
				kayıtlardan üretilir.
			</p>

			<div className="mb-6 grid gap-4 sm:grid-cols-2">
				<Card>
					<h3 className="mb-2 font-bold">Köken</h3>
					<ul className="space-y-1.5 text-sm">
						{sources.map(({ key, count }) => (
							<li key={key} className="flex justify-between gap-3">
								<span className="text-fg-muted">{SOURCE_KIND_LABELS[key]}</span>
								<strong className="shrink-0">{count}</strong>
							</li>
						))}
					</ul>
				</Card>

				<Card>
					<h3 className="mb-2 font-bold">Lisans</h3>
					<ul className="space-y-1.5 text-sm">
						{licenses.map(({ key, count }) => (
							<li key={key} className="flex justify-between gap-3">
								<span className="text-fg-muted">{LICENSE_LABELS[key]}</span>
								<strong className="shrink-0">{count}</strong>
							</li>
						))}
					</ul>
				</Card>
			</div>

			<Card className="mb-6">
				<h3 className="mb-2 font-bold">Telif bildirimi</h3>
				<div className="space-y-2 text-fg-muted">
					<p>
						Soru havuzuna yalnızca iki kaynaktan içerik girebilir:{" "}
						<strong className="text-fg">
							kamu kurumlarının kendi sitelerinde yayımladığı
						</strong>{" "}
						çıkmış sınav soruları ve cevap anahtarları (kaynak gösterilerek), ve{" "}
						<strong className="text-fg">
							mevzuat metninden üretilen özgün sorular
						</strong>
						. Mevzuat metinleri mevzuat.gov.tr ve Resmî Gazete&rsquo;dendir.
						Yukarıdaki köken tablosu, havuzun bugünkü dağılımını gösterir.
					</p>
					<p>
						Özel yayınevlerinin ve ücretli platformların soru bankaları{" "}
						<strong className="text-fg">kopyalanmaz ve kazınmaz</strong>. Kaynağı
						doğrulanamayan bir soru yayımlanamaz — bu bir tercih değil, derleme
						kuralıdır: lisansı bilinmeyen soru derlemeyi kırar.
					</p>
					<p>
						Bir içeriğin hak sahibi olduğunuzu düşünüyorsanız bize bildirin;
						kaynağı doğrulanamayan içerik yayından kaldırılır.
					</p>
				</div>
			</Card>

			{/* --- Yol haritası --------------------------------------------------- */}
			<h2 className="mb-1 flex items-center gap-2 text-xl font-bold">
				<MapIcon aria-hidden size={20} className="text-fg-subtle" />
				Yol haritası
			</h2>
			<p className="mb-3 text-fg-muted">
				Neyin hazır, neyin yolda olduğunu olduğu gibi yazıyoruz.
			</p>

			<Card className="mb-6">
				<ul className="space-y-3">
					<li>
						<strong>Hazır:</strong> ortak konuların özetleri, konu testleri,
						deneme sınavları, aralıklı tekrar, ilerleme takibi, çevrimdışı
						çalışma ve veri dışa aktarma.
					</li>
					<li>
						<strong>Hazır:</strong> isteğe bağlı hesap ve çoklu cihaz eşitleme.
						Hesap zorunlu değildir; uygulamanın tamamı hesapsız çalışır.
					</li>
					<li>
						<strong>Sırada:</strong> kurum ve kadro seçimi, alan bilgisi
						konuları, kuruma özgü sınav şablonları.
					</li>
					<li>
						<strong>Sonra:</strong>{" "}
						mevzuat metninden taslak soru üretimi (insan onayı zorunlu kalacak)
						ve &ldquo;neden yanlış?&rdquo; açıklama koçu.
					</li>
				</ul>
			</Card>

			<p className="text-sm text-fg-muted">
				Kişisel verilerin nasıl işlendiğini{" "}
				<Link href="/gizlilik" className="font-medium text-brand">
					Kişisel Verilerin Korunması
				</Link>{" "}
				sayfasında bulabilirsin.
			</p>
		</div>
	);
}
