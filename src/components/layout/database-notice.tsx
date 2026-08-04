"use client";

import { DatabaseZap } from "lucide-react";
import { useEffect, useState } from "react";
import {
	type DatabaseUnavailableReason,
	checkDatabase,
} from "@/lib/db/database";

/**
 * Her nedene ayrı bir açıklama: "bir hata oluştu" kullanıcıya hiçbir şey
 * söylemez, oysa bu hataların çoğunun kullanıcı tarafında bir karşılığı var
 * (sekmeyi normal pencerede açmak, yer boşaltmak, diğer sekmeyi kapatmak).
 */
const MESAJ: Record<DatabaseUnavailableReason, string> = {
	yok: "Tarayıcınız çalışma verisi saklamayı desteklemiyor. Konuları okuyabilir ve test çözebilirsiniz, ancak ilerlemeniz kaydedilmez.",
	"gizli-mod":
		"Gizli sekmede olabilirsiniz ya da site verisi engellenmiş. Konuları okuyabilir ve test çözebilirsiniz, ancak ilerlemeniz kaydedilmez. Normal bir pencerede açarsanız kayıt çalışır.",
	kota: "Cihazınızda yer kalmadığı için ilerlemeniz kaydedilemiyor. Biraz yer açtıktan sonra uygulamayı yeniden başlatın.",
	surum: "Uygulama başka bir sekmede daha yeni bir sürümle açık. Diğer sekmeleri kapatıp bu sayfayı yenileyin.",
	bilinmeyen:
		"Çalışma verisi deposu açılamadı. Konuları okuyabilir ve test çözebilirsiniz, ancak ilerlemeniz kaydedilmez.",
};

/**
 * IndexedDB açılamadığında görünen uyarı şeridi.
 *
 * Uygulamayı KİLİTLEMEZ ve bu bilinçli: konu özetleri, testler ve deneme
 * sınavları içerik dosyalarından okunur, Dexie'ye ihtiyaç duymaz. Çalışmaya
 * devam edilebilir; kaybolan yalnızca ilerleme kaydıdır. Kullanıcıyı boş bir
 * hata ekranına kilitlemek, hâlâ işe yarayan bir uygulamayı elinden almak
 * olurdu.
 *
 * Şerit kök düzende yaşar, çünkü sorunun görünür sonucu (sonsuza kadar dönen
 * iskeletler) ilerleme ve istatistik ekranlarının tamamına yayılıyor.
 */
export function DatabaseNotice() {
	const [reason, setReason] = useState<DatabaseUnavailableReason | null>(null);

	useEffect(() => {
		let cancelled = false;

		void checkDatabase().then((status) => {
			if (cancelled || status.available) return;
			setReason(status.reason ?? "bilinmeyen");
		});

		return () => {
			cancelled = true;
		};
	}, []);

	if (reason === null) return null;

	return (
		<div
			role="status"
			data-print="hide"
			className="border-b border-flag/40 bg-flag-soft"
		>
			<p className="mx-auto flex w-full max-w-5xl items-start gap-2 py-2 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] text-sm text-fg">
				<DatabaseZap
					aria-hidden
					size={18}
					className="mt-0.5 shrink-0 text-flag"
				/>
				<span>
					<strong className="font-semibold">İlerlemeniz kaydedilemiyor.</strong>{" "}
					{MESAJ[reason]}
				</span>
			</p>
		</div>
	);
}
