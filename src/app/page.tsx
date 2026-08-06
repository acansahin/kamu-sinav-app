import { BookOpen, ListChecks, ShieldCheck, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardLink, SectionHeading } from "@/components/ui/card";
import { ContinueCard } from "@/features/progress/continue-card";
import { StreakStrip } from "@/features/progress/streak-strip";
import { TodaySummary } from "@/features/progress/today-summary";
import { ReviewReminder } from "@/features/review/review-reminder";
import { getAllTopicRefs } from "@/lib/content/topic-refs";
import { contentRepository } from "@/lib/repositories/content.repository";

/**
 * Kart başındaki ikon rozeti. Çıplak ikon karta ritim vermiyordu; yumuşak
 * marka zeminli daire içindeki ikon kart yığınında hizayı görünür kılıyor.
 * İkonun kendisi `aria-hidden` kalır — anlamı yanındaki başlık taşır.
 */
function IconBadge({ children }: { children: ReactNode }) {
	return (
		<span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
			{children}
		</span>
	);
}

export default async function HomePage() {
	const [manifest, topics] = await Promise.all([
		contentRepository.getManifest(),
		getAllTopicRefs(),
	]);

	return (
		<div className="space-y-8">
			<section className="space-y-4">
				<div>
					<h1 className="mb-1 text-2xl font-bold">Merhaba</h1>
					<p className="text-fg-muted">
						Görevde yükselme ve unvan değişikliği sınavlarına hazırlık.
					</p>
				</div>
				{/* Seri yoksa hiç render edilmez */}
				<StreakStrip />
				<ContinueCard topics={topics} />
			</section>

			{/* Vadesi gelen tekrar yoksa hiç render edilmez */}
			<ReviewReminder />

			<section>
				<SectionHeading>Bugün</SectionHeading>
				<TodaySummary />
			</section>

			<section>
				<SectionHeading>Ne yapmak istersin?</SectionHeading>
				<div className="grid gap-3 sm:grid-cols-2">
					<CardLink href="/konular">
						<IconBadge>
							<BookOpen aria-hidden size={22} />
						</IconBadge>
						<h3 className="mt-3 font-bold">Konu Özetleri</h3>
						<p className="mt-1 text-sm text-fg-muted">
							{manifest.totals.topics} konu, sınav odaklı ve maddeler hâlinde.
						</p>
					</CardLink>
					<CardLink href="/testler">
						<IconBadge>
							<ListChecks aria-hidden size={22} />
						</IconBadge>
						<h3 className="mt-3 font-bold">Testler</h3>
						<p className="mt-1 text-sm text-fg-muted">
							{manifest.totals.publishedQuestions} soru, dört zorluk seviyesi.
						</p>
					</CardLink>
					<CardLink href="/deneme" className="sm:col-span-2">
						<IconBadge>
							<Timer aria-hidden size={22} />
						</IconBadge>
						<h3 className="mt-3 font-bold">Deneme Sınavları</h3>
						<p className="mt-1 text-sm text-fg-muted">
							Gerçek sınav formatında, süreli. Sonunda ders bazlı analiz ve
							öncelikli çalışma önerisi.
						</p>
					</CardLink>
				</div>
			</section>

			{/*
			 * Şeffaflık bölümü. Rakiplerin en büyük güven açığı içeriğin kaynağının
			 * ve güncelliğinin belirsiz olması — bunu ana sayfada söylüyoruz.
			 */}
			<Card className="flex gap-3">
				<ShieldCheck aria-hidden size={20} className="mt-0.5 shrink-0 text-correct" />
				<div>
					<h3 className="font-semibold">Her sorunun dayanağı görünür</h3>
					<p className="mt-1 text-sm text-fg-muted">
						Her soruda hangi kanunun hangi maddesine dayandığı yazar; her konu
						özetinde hangi mevzuat sürümüne göre hazırlandığı ve en son ne zaman
						doğrulandığı belirtilir. Reklam yok. Açtığın sayfalar internet
						olmadan da çalışır; istersen tümünü Ayarlar&apos;dan indirebilirsin.
					</p>
				</div>
			</Card>
		</div>
	);
}
