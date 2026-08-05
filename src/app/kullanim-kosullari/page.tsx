import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getContactEmail } from "@/lib/legal/data-controller";

export const metadata: Metadata = {
	title: "Kullanım Koşulları",
	description:
		"Kamu Sınav Akademi uygulamasının kullanım koşulları: hizmetin kapsamı, içeriğin niteliği, sorumluluk sınırları ve fikri mülkiyet.",
};

/** Metnin en son ne zaman gözden geçirildiği. */
const TERMS_UPDATED_AT = "2026-08-04";

/**
 * Kullanım koşulları.
 *
 * Sınav hazırlık + mevzuat içeriği taşıyan bir üründe en kritik madde,
 * uygulamanın **resmî olmadığının** ve içeriğin bağlayıcı metnin yerine
 * geçmediğinin açıkça yazılmasıdır: kullanıcı yanlış hatırlanan bir hükme
 * dayanıp zarar gördüğünde başvurulacak metin budur. Bu yüzden sorumluluk
 * reddi sayfanın en başında, gövdeye gömülü değil.
 *
 * Ücretlendirme, üyelik ve ödeme Faz 6 kapsamındadır; bugün ürün tamamen
 * ücretsiz ve reklamsızdır. O bölümler bilinçli olarak yazılmadı — var olmayan
 * bir hizmete koşul yazmak metni belirsizleştirir.
 */
export default function TermsPage() {
	const contact = getContactEmail();

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Kullanım Koşulları</h1>
			<p className="mb-6 text-fg-muted">
				Son güncelleme:{" "}
				{new Date(TERMS_UPDATED_AT).toLocaleDateString("tr-TR")}
			</p>

			<Card className="mb-6 border-flag/40 bg-flag-soft">
				<p className="flex items-center gap-2 font-bold text-flag">
					<AlertTriangle aria-hidden size={20} />
					Bu uygulama resmî değildir
				</p>
				<ul className="mt-2 space-y-1.5 text-fg">
					<li>
						Kamu Sınav Akademi <strong>bağımsız bir hazırlık aracıdır</strong>;
						hiçbir bakanlık, kurum, kuruluş veya sınav merkeziyle bağlantılı
						değildir, onlar tarafından onaylanmamıştır.
					</li>
					<li>
						İçerik <strong>bilgi amaçlıdır</strong>, hukuki tavsiye değildir ve
						hiçbir işlemde dayanak olarak kullanılamaz.
					</li>
					<li>
						Bağlayıcı olan tek metin, <strong>Resmî Gazete</strong>&rsquo;de
						yayımlanan mevzuatın yürürlükteki hâlidir.
					</li>
					<li>
						Uygulamayı kullanmak sınavda başarıyı garanti etmez; soruların
						çıkmış ya da çıkacak sınav sorularıyla örtüşeceği taahhüt edilmez.
					</li>
				</ul>
			</Card>

			<div className="prose-okuma max-w-3xl">
				<h2>1. Kapsam</h2>
				<p>
					Bu koşullar, Kamu Sınav Akademi uygulamasının (&ldquo;Uygulama&rdquo;)
					kullanımını düzenler. Uygulamayı indirerek, açarak veya kullanarak bu
					koşulları kabul etmiş sayılırsınız. Kabul etmiyorsanız Uygulamayı
					kullanmamanız gerekir.
				</p>

				<h2>2. Hizmetin niteliği</h2>
				<p>
					Uygulama; Görevde Yükselme ve Unvan Değişikliği sınavlarına hazırlanan
					kamu görevlilerine yönelik konu özetleri, konu testleri ve deneme
					sınavları sunar. Hizmet <strong>ücretsizdir</strong>, reklam
					içermez, izleme ve analiz aracı kullanmaz.
				</p>
				<p>
					Uygulama <strong>çevrimdışı</strong> çalışacak biçimde tasarlanmıştır.
					Çalışma verileriniz (çözdüğünüz sorular, ilerlemeniz, ayarlarınız)
					cihazınızın yerel deposunda tutulur. Verinizin nasıl işlendiği{" "}
					<Link href="/gizlilik">Kişisel Verilerin Korunması</Link> sayfasında
					açıklanmıştır.
				</p>

				<h2>3. İçeriğin doğruluğu ve sorumluluk reddi</h2>
				<p>
					İçerik, mevzuat metinlerinden özenle hazırlanır; her konu özetinde
					dayanılan mevzuat sürümü ve son doğrulama tarihi kullanıcıya
					gösterilir. Buna rağmen:
				</p>
				<ul>
					<li>
						Mevzuat sık değişir. Bir hüküm, özetin doğrulandığı tarihten sonra
						değişmiş, yürürlükten kalkmış veya iptal edilmiş olabilir.
					</li>
					<li>
						İçerikte maddi hata, eksiklik veya güncelliğini yitirmiş bilgi
						bulunabilir.
					</li>
					<li>
						Uygulama <strong>&ldquo;olduğu gibi&rdquo;</strong> sunulur.
						Kesintisizlik, hatasızlık, belirli bir amaca uygunluk ve içeriğin
						güncelliği dâhil olmak üzere açık veya zımni hiçbir garanti
						verilmez.
					</li>
				</ul>
				<p>
					Uygulamada yer alan bilgilere dayanılarak alınan kararlardan ve
					yapılan işlemlerden doğabilecek sonuçlardan kullanıcı kendisi
					sorumludur. Yürürlükteki hukukun izin verdiği azami ölçüde, Uygulamanın
					kullanımından doğan doğrudan veya dolaylı zararlardan sorumluluk kabul
					edilmez. Bu sınırlama, kasıt ve ağır ihmal hâllerini kapsamaz.
				</p>
				<p>
					Bir hatayı fark ederseniz uygulama içindeki soru bildirim tuşunu
					kullanabilir{contact ? " veya bize yazabilirsiniz" : "siniz"}. Bildirimler
					içeriğin düzeltilmesinde kullanılır.
				</p>

				<h2>4. Fikri mülkiyet</h2>
				<p>
					Uygulamadaki konu özetleri ve sorular özgün olarak üretilmiştir ve
					fikri hakları saklıdır. Mevzuat metinleri kamuya açık kaynaklardan
					(mevzuat.gov.tr, Resmî Gazete) alınmıştır ve fikir ve sanat eseri
					korumasının dışındadır.
				</p>
				<p>
					İçeriği <strong>kişisel çalışma amacıyla</strong> kullanabilir,
					yazdırabilirsiniz. İçeriğin tamamının veya önemli bir bölümünün
					kopyalanması, çoğaltılması, yeniden yayımlanması, satılması veya başka
					bir ürüne aktarılması izne bağlıdır. Uygulamanın soru havuzunun
					otomatik araçlarla toplu olarak çekilmesi (kazıma) yasaktır.
				</p>
				<p>
					Bir içeriğin hak sahibi olduğunuzu düşünüyorsanız{" "}
					{contact ? (
						<>
							<a href={`mailto:${contact}`}>{contact}</a> adresinden
						</>
					) : (
						"bize"
					)}{" "}
					bildirin; kaynağı doğrulanamayan içerik yayından kaldırılır. Ayrıntı
					için <Link href="/hakkinda">Hakkında</Link> sayfasındaki telif
					bildirimine bakabilirsiniz.
				</p>

				<h2>5. Kullanıcının yükümlülükleri</h2>
				<ul>
					<li>
						Uygulamayı yürürlükteki mevzuata aykırı biçimde kullanmamak.
					</li>
					<li>
						Uygulamanın çalışmasını engellemeye, tersine mühendislikle içeriği
						toplu olarak çıkarmaya veya güvenlik önlemlerini aşmaya
						çalışmamak.
					</li>
					<li>
						Hata bildirimlerinde gerçeğe aykırı veya rahatsız edici içerik
						göndermemek.
					</li>
				</ul>

				<h2>6. Hizmetin sürekliliği ve değişiklikler</h2>
				<p>
					Uygulamanın içeriği, özellikleri ve bu koşullar önceden bildirimde
					bulunulmaksızın değiştirilebilir; hizmet askıya alınabilir veya
					sonlandırılabilir. Güncel metin her zaman bu sayfada yayımlanır ve
					sayfanın başındaki tarih güncellenir. Değişiklikten sonra Uygulamayı
					kullanmaya devam etmeniz, yeni koşulları kabul ettiğiniz anlamına
					gelir.
				</p>
				<p>
					Uygulama çevrimdışı çalıştığı için cihazınızdaki sürüm, yayımlanan en
					güncel içerikten eski olabilir. Güncel içerik için uygulamayı
					güncellemeniz gerekir.
				</p>

				<h2>7. Uygulanacak hukuk</h2>
				<p>
					Bu koşullar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda
					Türkiye Cumhuriyeti mahkemeleri ve icra daireleri yetkilidir.
					Tüketici sıfatıyla sahip olduğunuz haklar saklıdır.
				</p>

				<h2>8. İletişim</h2>
				{contact ? (
					<p>
						Sorularınız ve bildirimleriniz için:{" "}
						<a href={`mailto:${contact}`}>{contact}</a>
					</p>
				) : (
					<p>
						<em>İletişim adresi henüz yayımlanmamıştır.</em>
					</p>
				)}
			</div>
		</div>
	);
}
