import { AlertTriangle, ShieldCheck, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { isAccountConfigured } from "@/lib/auth/supabase-client";
import {
	DATA_CONTROLLER,
	PRIVACY_NOTICE_UPDATED_AT,
	isPrivacyNoticePublishable,
} from "@/lib/legal/data-controller";

export const metadata: Metadata = {
	title: "Kişisel Verilerin Korunması",
	description:
		"6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni: hangi veriler işleniyor, neden, kimlere aktarılıyor ve haklarınız neler.",
};

/**
 * KVKK aydınlatma metni — 6698 sayılı Kanun m.10.
 *
 * Yapı, Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve
 * Esaslar Hakkında Tebliğ'in saydığı unsurları sırayla karşılar. Tebliğ
 * "genel nitelikte ve muğlak ifadeler" kullanılmamasını, "anlaşılır, açık ve
 * sade bir dil" tercih edilmesini şart koşuyor; bu yüzden metin önce düz
 * Türkçe bir özetle başlıyor, ayrıntı sonra geliyor.
 *
 * ÖNEMLİ: Aydınlatma AÇIK RIZA DEĞİLDİR ve onunla karıştırılmamalıdır.
 * Bu sayfa yalnızca bilgilendirmedir; hiçbir yerde onay kutusu yoktur.
 */
export default function PrivacyPage() {
	/*
	 * Hesap özelliği bu derlemede var mı? Anahtar yoksa uygulama hiçbir kişisel
	 * veriyi cihaz dışına çıkarmaz; metnin hesaba dair bölümleri o hâlde
	 * bilgilendirme niteliğindedir ve okuyucuya bunu söylemek gerekir.
	 */
	const accountEnabled = isAccountConfigured();
	const complete = isPrivacyNoticePublishable(accountEnabled);

	return (
		<div>
			<h1 className="mb-1 text-2xl font-bold">Kişisel Verilerin Korunması</h1>
			<p className="mb-6 text-fg-muted">
				6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.10 kapsamında
				aydınlatma metni · Son güncelleme:{" "}
				{new Date(PRIVACY_NOTICE_UPDATED_AT).toLocaleDateString("tr-TR")}
			</p>

			{!complete && (
				<div
					role="alert"
					className="mb-6 rounded-xl border-2 border-flag bg-flag-soft p-4"
				>
					<p className="flex items-center gap-2 font-bold text-flag">
						<AlertTriangle aria-hidden size={20} />
						Bu metin henüz yayına hazır değil
					</p>
					<p className="mt-2 text-fg">
						{accountEnabled
							? "Veri sorumlusunun kimlik ve iletişim bilgileri doldurulmamış. Hesap özelliği bu derlemede açık olduğu için e-posta adresiniz işlenmektedir; Kanun bu durumda veri sorumlusunun adının ve tebligata esas adresinin açıkça yazılmasını zorunlu kılar."
							: "İletişim adresi doldurulmamış. Bu derlemede hesap özelliği kapalı olduğu için kişisel veri işlenmiyor, ancak içerik hatası ve telif bildirimleri için ulaşılabilir bir kanal bulunmak zorunda."}
					</p>
					<p className="mt-2 text-sm text-fg-muted">
						Geliştirici notu: <code>src/lib/legal/data-controller.ts</code>{" "}
						dosyasındaki alanları doldurun.
					</p>
				</div>
			)}

			{!accountEnabled && (
				<Card className="mb-6 border-correct/40 bg-correct-soft">
					<p className="flex items-center gap-2 font-bold text-correct">
						<Smartphone aria-hidden size={20} />
						Bu sürümde hesap özelliği kapalı
					</p>
					<p className="mt-2 text-fg">
						Uygulama tamamen cihazınızda çalışır: giriş yoktur, sunucuya hiçbir
						veri gönderilmez, kişisel veriniz işlenmez. Aşağıdaki metnin hesap
						ve eşitlemeye dair bölümleri, özellik ileride açılırsa neyin
						geçerli olacağını anlatır — bugün uygulanmıyor.
					</p>
				</Card>
			)}

			<Card className="mb-6 border-brand/40 bg-brand-soft">
				<p className="flex items-center gap-2 font-bold text-brand">
					<ShieldCheck aria-hidden size={20} />
					Kısaca
				</p>
				<ul className="mt-2 space-y-1.5 text-fg">
					<li>
						Uygulamayı <strong>hesap açmadan</strong> kullanabilirsiniz. Bu
						durumda hiçbir kişisel verinizi almayız.
					</li>
					<li>
						Hesap açarsanız <strong>yalnızca e-posta adresinizi</strong> alırız.
						Ad, soyad, T.C. kimlik numarası, telefon veya kurum bilgisi
						istemiyoruz.
					</li>
					<li>
						Hesap açmazsanız çalışma verileriniz (çözdüğünüz sorular,
						ilerlemeniz) <strong>yalnızca cihazınızda kalır</strong>.
					</li>
					<li>
						Hesap açarsanız bu veriler, cihazlarınız arasında eşitlenebilmesi
						için <strong>hesabınıza bağlı olarak sunucuda da tutulur</strong>.
						Eşitlemeyi istemiyorsanız hesap açmamanız yeterlidir.
					</li>
					<li>
						Reklam göstermiyoruz, veri satmıyoruz, izleme ve analiz aracı
						kullanmıyoruz.
					</li>
					<li>Hesabınızı ve verinizi istediğiniz zaman sildirebilirsiniz.</li>
				</ul>
			</Card>

			<div className="prose-okuma max-w-3xl">
				<h2>1. Veri sorumlusu kim?</h2>
				{!complete ? (
					<p>
						<em>
							Veri sorumlusunun kimlik ve iletişim bilgileri henüz
							yayımlanmamıştır.
						</em>
					</p>
				) : !accountEnabled ? (
					<>
						<p>
							Bu sürümde uygulama hiçbir kişisel veriyi cihazınızdan dışarı
							çıkarmadığı için <strong>veri sorumlusu sıfatı doğmamaktadır</strong>
							. Yine de içerik hatası, telif bildirimi ve her türlü soru için
							aşağıdaki adresten ulaşabilirsiniz; hesap özelliği açıldığında bu
							bölüm künyenin tamamıyla güncellenecektir.
						</p>
						<ul>
							<li>
								<strong>E-posta:</strong> {DATA_CONTROLLER.email}
							</li>
						</ul>
					</>
				) : (
					<>
						<p>
							Kişisel verileriniz, veri sorumlusu sıfatıyla{" "}
							<strong>{DATA_CONTROLLER.name}</strong> tarafından aşağıda
							açıklanan kapsamda işlenmektedir.
						</p>
						<ul>
							<li>
								<strong>E-posta:</strong> {DATA_CONTROLLER.email}
							</li>
							<li>
								<strong>Adres:</strong> {DATA_CONTROLLER.address}
							</li>
							{DATA_CONTROLLER.kep && (
								<li>
									<strong>KEP adresi:</strong> {DATA_CONTROLLER.kep}
								</li>
							)}
							{DATA_CONTROLLER.verbis && (
								<li>
									<strong>VERBİS sicil no:</strong> {DATA_CONTROLLER.verbis}
								</li>
							)}
						</ul>
					</>
				)}

				<h2>2. Hangi kişisel verileriniz işleniyor?</h2>
				<p>
					<strong>Hesap açmadığınızda hiçbir kişisel veriniz işlenmez.</strong>{" "}
					Uygulamanın tamamı — konu özetleri, testler, deneme sınavları,
					ilerleme takibi — hesapsız çalışır ve bu verilerin tamamı yalnızca
					kendi cihazınızın tarayıcı deposunda tutulur.
				</p>
				<p>Hesap açtığınızda işlenen veriler:</p>

				<table>
					<thead>
						<tr>
							<th>Veri</th>
							<th>Neden alınıyor</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>E-posta adresi</td>
							<td>
								Giriş kodunu göndermek ve hesabınızı sizinle eşleştirmek için.
								Kimlik doğrulamanın tek yolu budur; şifre kullanmıyoruz.
							</td>
						</tr>
						<tr>
							<td>Kullanıcı kimliği (rastgele üretilen numara)</td>
							<td>
								Hesabınızı e-posta adresinizden bağımsız olarak tanımlamak için.
							</td>
						</tr>
						<tr>
							<td>Giriş kayıtları (tarih, saat, IP adresi)</td>
							<td>
								Kimlik doğrulama altyapısı tarafından güvenlik amacıyla
								(yetkisiz erişim denemelerinin tespiti) otomatik olarak tutulur.
							</td>
						</tr>
					</tbody>
				</table>

				<p>
					<strong>Alınmayan veriler:</strong> ad, soyad, T.C. kimlik numarası,
					telefon numarası, çalıştığınız kurum, unvanınız, konum bilginiz.
					Uygulama bu bilgileri hiçbir aşamada sormaz.
				</p>

				<h3>Çalışma verileriniz</h3>
				<p>
					Çözdüğünüz sorular, doğru/yanlış sayılarınız, konu ilerlemeniz, deneme
					sınavı sonuçlarınız, tekrar planınız, yer imleriniz, çalışma
					ayarlarınız ve gönderdiğiniz hata bildirimleri &ldquo;çalışma
					verisi&rdquo;dir.
				</p>
				<ul>
					<li>
						<strong>Hesap açmadığınızda</strong> bu veriler yalnızca cihazınızın
						tarayıcı deposunda tutulur, sunucuya hiç gönderilmez.
					</li>
					<li>
						<strong>Hesap açtığınızda</strong> aynı veriler, cihazlarınız
						arasında eşitlenebilmesi ve cihazınızı kaybettiğinizde
						kaybolmaması için hesabınıza bağlı olarak sunucuda da saklanır.
						Eşitleme; giriş yaptığınızda, çıkış yaptığınızda, uygulamayı
						açtığınızda ve &ldquo;Şimdi eşitle&rdquo; düğmesine bastığınızda
						çalışır.
					</li>
				</ul>
				<p>
					Sunucudaki satırlar yalnızca sizin hesabınızla okunabilir; veri
					tabanında her satır kullanıcı kimliğine bağlı erişim kurallarıyla
					korunur. Bu veriler <strong>reklam veya profilleme amacıyla
					kullanılmaz</strong> ve üçüncü kişilerle paylaşılmaz.
				</p>
				<p>
					Eşitleme <strong>hesaba bağlıdır ve isteğe bağlıdır</strong>: hesap
					açmadığınız sürece çalışma verileriniz cihazınızdan çıkmaz. Çıkış
					yaptığınızda veriler cihazınızda kalmaya devam eder.
				</p>

				<h2>3. Verileriniz hangi amaçla işleniyor?</h2>
				<ul>
					<li>Hesabınızı oluşturmak ve giriş yapmanızı sağlamak.</li>
					<li>
						Giriş kodunu göndermek ve doğrulamak (kimlik doğrulama süreçlerinin
						yürütülmesi).
					</li>
					<li>
						Hesap güvenliğini sağlamak; yetkisiz erişim denemelerini tespit
						etmek.
					</li>
					<li>
						Hesap açtıysanız çalışma verilerinizi cihazlarınız arasında
						eşitlemek ve cihaz kaybına karşı yedeklemek.
					</li>
					<li>
						KVKK kapsamındaki başvurularınıza cevap vermek ve yasal
						yükümlülükleri yerine getirmek.
					</li>
				</ul>
				<p>
					Kişisel verileriniz <strong>pazarlama amacıyla kullanılmaz</strong>,
					üçüncü kişilere satılmaz veya reklam amacıyla paylaşılmaz. Uygulamada
					reklam, izleme çerezi veya analiz aracı bulunmaz.
				</p>
				<p>
					Verileriniz üzerinde, aleyhinize bir sonuç doğuracak şekilde{" "}
					<strong>münhasıran otomatik sistemlerle analiz yapılmaz</strong>{" "}
					(profilleme, puanlama vb.).
				</p>

				<h2>4. Toplama yöntemi ve hukuki sebep</h2>
				<p>
					E-posta adresiniz, <strong>doğrudan sizden</strong>, uygulamadaki
					&ldquo;Hesap&rdquo; ekranına yazmanız yoluyla, elektronik ortamda
					toplanır. Bunun dışında hiçbir kaynaktan veri toplanmaz.
				</p>
				<p>Hukuki sebepler (KVKK m.5/2):</p>
				<ul>
					<li>
						<strong>(c) bendi</strong> — bir sözleşmenin kurulması veya ifasıyla
						doğrudan doğruya ilgili olması: hesap açma talebiniz üzerine
						hizmetin sunulabilmesi için e-posta adresinizin işlenmesi
						zorunludur.
					</li>
					<li>
						<strong>(ç) bendi</strong> — veri sorumlusunun hukuki
						yükümlülüğünü yerine getirebilmesi için zorunlu olması: başvurulara
						cevap verme ve kayıt tutma yükümlülükleri.
					</li>
					<li>
						<strong>(f) bendi</strong> — meşru menfaat: hesap güvenliğinin
						sağlanması amacıyla giriş kayıtlarının tutulması.
					</li>
				</ul>

				<h2>5. Verileriniz kimlere aktarılıyor?</h2>
				<p>
					Kişisel verileriniz <strong>hiçbir üçüncü kişiye satılmaz</strong> ve
					pazarlama amacıyla paylaşılmaz. Yalnızca hizmetin teknik olarak
					sunulabilmesi için aşağıdaki altyapı sağlayıcısı kullanılmaktadır:
				</p>
				<ul>
					<li>
						<strong>Supabase</strong> — kimlik doğrulama ve veri tabanı
						hizmeti. Veriler Avrupa Birliği (Almanya, Frankfurt) bölgesindeki
						sunucularda barındırılır. Supabase bu ilişkide{" "}
						<strong>veri işleyen</strong> sıfatıyla hareket eder ve verilerinizi
						yalnızca hizmetin sunulması için kullanır.
					</li>
					<li>
						Giriş kodunu içeren e-postanın iletilmesi için{" "}
						<strong>e-posta gönderim altyapısı</strong> kullanılır.
					</li>
				</ul>
				<p>
					Ayrıca kanunen yetkili kamu kurum ve kuruluşlarına, talep etmeleri
					hâlinde ve mevzuatın öngördüğü sınırlar içinde aktarım yapılabilir.
				</p>
				<p>
					<strong>Yurt dışına aktarım:</strong> Yukarıdaki sağlayıcıların
					sunucuları Türkiye dışında bulunduğundan, kişisel verileriniz KVKK m.9
					kapsamında yurt dışına aktarılmaktadır. Bu aktarım, Kanun&rsquo;un
					aradığı uygun güvencelerin sağlanması koşuluyla gerçekleştirilir.
				</p>

				<h2>6. Verileriniz ne kadar süre saklanıyor?</h2>
				<ul>
					<li>
						<strong>E-posta adresiniz ve kullanıcı kimliğiniz:</strong> hesabınız
						açık kaldığı sürece. Hesabınızı sildirdiğinizde bu veriler silinir.
					</li>
					<li>
						<strong>Giriş kayıtları:</strong> güvenlik amacıyla sınırlı bir süre
						tutulur ve süre sonunda otomatik olarak silinir.
					</li>
					<li>
						<strong>Sunucudaki çalışma verileriniz:</strong> hesabınız açık
						kaldığı sürece. Hesabınızı sildirdiğinizde bu satırlar da silinir.
					</li>
					<li>
						Mevzuatın daha uzun bir saklama süresi öngördüğü hâllerde, o süre
						esas alınır; süre dolduğunda veriler silinir, yok edilir veya
						anonim hâle getirilir.
					</li>
				</ul>
				<p>
					Cihazınızda tutulan çalışma verileriniz, siz silene kadar
					cihazınızda kalır. Ayarlar ekranındaki{" "}
					<strong>&ldquo;Tüm verileri sil&rdquo;</strong> düğmesiyle bunları
					istediğiniz zaman kaldırabilir, <strong>&ldquo;Dışa aktar&rdquo;</strong>{" "}
					ile bir dosyaya indirebilirsiniz.
				</p>

				<h2>7. Haklarınız</h2>
				<p>
					KVKK m.11 uyarınca, veri sorumlusuna başvurarak aşağıdaki haklarınızı
					kullanabilirsiniz:
				</p>
				<ul>
					<li>Kişisel verinizin işlenip işlenmediğini öğrenme.</li>
					<li>İşlenmişse buna ilişkin bilgi talep etme.</li>
					<li>
						İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını
						öğrenme.
					</li>
					<li>
						Yurt içinde veya yurt dışında verilerinizin aktarıldığı üçüncü
						kişileri bilme.
					</li>
					<li>
						Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme.
					</li>
					<li>
						Kanun&rsquo;un öngördüğü şartlar çerçevesinde silinmesini veya yok
						edilmesini isteme.
					</li>
					<li>
						Düzeltme, silme veya yok etme işlemlerinin, verilerin aktarıldığı
						üçüncü kişilere bildirilmesini isteme.
					</li>
					<li>
						Münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize
						bir sonuç ortaya çıkmasına itiraz etme.
					</li>
					<li>
						Kanun&rsquo;a aykırı işlenme sebebiyle zarara uğramanız hâlinde
						zararın giderilmesini talep etme.
					</li>
				</ul>

				<h2>8. Nasıl başvurabilirsiniz?</h2>
				{complete ? (
					<p>
						Başvurunuzu, <strong>{DATA_CONTROLLER.email}</strong> adresine
						(sistemimizde kayıtlı e-posta adresinizi kullanarak) veya{" "}
						<strong>{DATA_CONTROLLER.address}</strong> adresine yazılı olarak
						iletebilirsiniz.
					</p>
				) : (
					<p>
						<em>Başvuru kanalları henüz yayımlanmamıştır.</em>
					</p>
				)}
				<p>
					Başvurunuzda ad-soyadınızı, yazılı başvuruda imzanızı, T.C. kimlik
					numaranızı (yabancılar için uyruk ve pasaport numarasını), tebligata
					esas adresinizi, varsa bildirime esas e-posta adresinizi ve talep
					konusunu belirtmeniz gerekir (Veri Sorumlusuna Başvuru Usul ve
					Esasları Hakkında Tebliğ m.5).
				</p>
				<p>
					Başvurunuz <strong>en geç 30 gün içinde</strong> ücretsiz olarak
					sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi hâlinde
					Kişisel Verileri Koruma Kurulu tarafından belirlenen tarifedeki ücret
					alınabilir.
				</p>
				<p>
					Başvurunuzun reddedilmesi, verilen cevabı yetersiz bulmanız veya
					süresinde cevap verilmemesi hâlinde; cevabı öğrendiğiniz tarihten
					itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde{" "}
					<strong>Kişisel Verileri Koruma Kurulu&rsquo;na</strong> şikâyette
					bulunabilirsiniz (KVKK m.14).
				</p>

				<h2>9. Bu metinde değişiklik olursa</h2>
				<p>
					Uygulamanın işleyişi veya mevzuat değiştiğinde bu metin güncellenir.
					Güncelleme tarihi sayfanın başında yazar. Yeni bir veri işleme
					faaliyeti başlamadan <em>önce</em> bilgilendirme yapılır.
				</p>
				<p>
					<strong>Son değişiklik:</strong> çoklu cihaz eşitlemesi kullanıma
					açıldı. Hesap açan kullanıcıların çalışma verileri, artık cihazlar
					arasında eşitlenmek üzere hesaba bağlı olarak sunucuda da saklanıyor
					(bkz. 2. bölüm). Hesap açmayan kullanıcılar için değişen bir şey yok:
					verileri cihazlarından çıkmıyor.
				</p>
			</div>
		</div>
	);
}
