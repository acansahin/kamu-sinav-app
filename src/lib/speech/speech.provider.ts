/**
 * Sesli okuma sağlayıcısı — yetenek yoklaması ve motor erişimi.
 *
 * ⚠️ **`window.speechSynthesis` DOĞRUDAN KULLANILAMAZ.** Web Speech API
 * Android WebView'de çalışmaz (Chromium issue 40417848, hâlâ açık); Chrome
 * Android'de çalıştığı için tarayıcıda ve testlerde her şey yolunda görünür,
 * **yalnızca APK'da sessizce ölür**. Eklenti bu yüzden zorunludur: native
 * tarafta Android `TextToSpeech` servisini, webde Web Speech API'yi kullanır.
 * Burayı "sadeleştirip" tarayıcı API'sine indirmeyin.
 *
 * ⚠️ **Eklenti DİNAMİK yüklenir.** Statik içe aktarım paketi web yayınının
 * ortak chunk'ına sokar; aynı kural `lib/auth/supabase-client.ts` ve
 * `lib/billing/native.provider.ts` için de geçerli ve ikisinde de ölçülmüştür.
 *
 * `lib/billing/billing.provider.ts` desenindeki ikinci bir "açık sağlayıcı"
 * sınıfı burada YOK ve bu bilinçli: `OpenBillingProvider` var çünkü Play
 * Billing'in tarayıcı karşılığı yok. Sesli okumanın karşılığı var ve eklenti
 * onu zaten içeriyor; ikinci bir sınıf yazmak o implementasyonu kopyalamak
 * olurdu.
 */

/** Bu ortamda sesli okuma mümkün mü? */
export type SpeechCapability =
	| { durum: "hazir" }
	/** Motor var ama Türkçe ses verisi yok. Android'de kurulum ekranı açılabilir. */
	| { durum: "dil-yok"; kurulumAcilabilir: boolean }
	/** Ne native ne web motoru var — oynatıcı hiç gösterilmez. */
	| { durum: "yok" };

export interface ISpeechProvider {
	/** Konuşma BİTTİĞİNDE resolve olur. */
	speak(o: { text: string; rate: number }): Promise<void>;
	stop(): Promise<void>;
	/** Yalnızca Android; webde çağrılmamalı. */
	openInstall(): Promise<void>;
}

/**
 * Türkçe dil etiketi.
 *
 * Her `speak()` çağrısında AÇIKÇA geçilir. Eklentinin varsayılanı `"en-US"`;
 * unutulursa Türkçe metin İngilizce sesle okunur ve bu bir hata gibi
 * görünmez — yalnızca kulakla fark edilir.
 */
const DIL = "tr-TR";

/** Tarayıcıda ses listesinin dolması için beklenecek en uzun süre. */
const SES_LISTESI_ZAMAN_ASIMI = 1500;

/**
 * Eklentiyi yükler.
 *
 * ⚠️ Eklenti nesnesi bir SARMALAYICI İÇİNDE döndürülür ve bu zorunludur.
 * Capacitor'ın `registerPlugin` çağrısı her özellik erişimini köprüye çeviren
 * bir Proxy üretir; `then` de bir özelliktir. Proxy doğrudan bir `async`
 * fonksiyondan döndürülürse JavaScript onu "thenable" sanıp `.then()` çağırır,
 * Proxy bunu native bir metot çağrısına çevirir ve çağrı
 * `"TextToSpeech.then() is not implemented"` ile patlar. Sarmalayıcı bu
 * çağrının hiç yapılmamasını sağlar.
 */
async function eklenti() {
	const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
	return { tts: TextToSpeech };
}

async function platform(): Promise<string> {
	try {
		const { Capacitor } = await import("@capacitor/core");
		return Capacitor.getPlatform();
	} catch {
		return "web";
	}
}

/**
 * Tarayıcıda ses listesinin dolmasını bekler.
 *
 * Chrome ve Safari `getVoices()` çağrısına ilk seferde boş dizi döndürür ve
 * listeyi asenkron doldurur. Beklemeden yoklanırsa Türkçe ses var olduğu hâlde
 * "yok" denir ve özellik hiç açılmaz.
 */
async function seslerHazir(): Promise<void> {
	const sentez = window.speechSynthesis;
	if (sentez.getVoices().length > 0) return;

	await new Promise<void>((resolve) => {
		const bitir = (): void => {
			sentez.removeEventListener("voiceschanged", bitir);
			resolve();
		};
		sentez.addEventListener("voiceschanged", bitir);
		setTimeout(bitir, SES_LISTESI_ZAMAN_ASIMI);
	});
}

/**
 * Ortamı yoklar.
 *
 * **İlk basışta çağrılır, sayfa yüklenirken değil.** Üç gerekçe: sesli okumayı
 * hiç kullanmayan kullanıcı için eklenti chunk'ı indirilmez bile; oynatıcı
 * sonradan belirip yerleşimi kaydırmaz; webde `speak()` bazı tarayıcılarda
 * kullanıcı jesti ister ve ilk basış bunu doğal olarak sağlar.
 */
export async function yetenegiYokla(): Promise<SpeechCapability> {
	if (typeof window === "undefined") return { durum: "yok" };

	let tts: Awaited<ReturnType<typeof eklenti>>["tts"];
	try {
		({ tts } = await eklenti());
	} catch {
		return { durum: "yok" };
	}

	const ortam = await platform();

	if (ortam === "web") {
		// Eklentinin web implementasyonu Web Speech API'ye dayanır; API hiç
		// yoksa eklentiye girmeden burada kesilir.
		if (typeof window.speechSynthesis === "undefined") return { durum: "yok" };
		try {
			await seslerHazir();
		} catch {
			/* bekleme başarısız olursa yine de yoklamayı dene */
		}
	}

	try {
		const { supported } = await tts.isLanguageSupported({ lang: DIL });
		if (supported) return { durum: "hazir" };

		/*
		 * Bazı motorlar etiketi `tr_TR` ya da düz `tr` olarak bildiriyor;
		 * birebir eşleşme aramak Türkçe sesi olan cihazlarda bile "yok"
		 * dedirtiyordu.
		 */
		const { languages } = await tts.getSupportedLanguages();
		if (languages.some((etiket) => /^tr\b/i.test(etiket) || etiket === "tr")) {
			return { durum: "hazir" };
		}
	} catch {
		return { durum: "yok" };
	}

	return { durum: "dil-yok", kurulumAcilabilir: ortam === "android" };
}

class PluginSpeechProvider implements ISpeechProvider {
	async speak({ text, rate }: { text: string; rate: number }): Promise<void> {
		const { tts } = await eklenti();
		await tts.speak({ text, lang: DIL, rate });
	}

	async stop(): Promise<void> {
		const { tts } = await eklenti();
		await tts.stop();
	}

	async openInstall(): Promise<void> {
		const { tts } = await eklenti();
		await tts.openInstall();
	}
}

let saglayici: ISpeechProvider | null = null;

/** Tek örnek; eklenti modülü zaten önbelleklenir. */
export function getSpeechProvider(): ISpeechProvider {
	saglayici ??= new PluginSpeechProvider();
	return saglayici;
}
