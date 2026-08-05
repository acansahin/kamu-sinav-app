"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { LockedNotice } from "@/features/billing/locked-notice";
import type { Entitlement } from "@/lib/billing/entitlement";
import {
	isExamUnlocked,
	isSubjectPrintUnlocked,
	isTopicUnlocked,
} from "@/lib/billing/entitlement";
import { useEntitlement } from "@/lib/stores/entitlement";

/**
 * Kilitli olabilecek bir yüzeyin sarmalayıcısı.
 *
 * Kilit çocuk bileşenin İÇİNE değil, ETRAFINA konur: kilitliyken çocuk hiç
 * mount edilmez, dolayısıyla ilerleme kaydı yazan bir effect'i varsa hiç
 * çalışmaz. Kilidi içeriden uygulamak, "önce oturum aç, sonra kilit ekranı
 * göster" gibi yan etkilere yol açardı.
 *
 * ⚠️ Bu bir GÖRÜNÜRLÜK kapısıdır, güvenlik sınırı değil. İçerik statik
 * export'ta sayfaya gömülüdür ve kilitliyken de HTML'de durur.
 */

type GateRule =
	| { kind: "topic"; subjectId: string; topicSlug: string }
	| { kind: "print" }
	| { kind: "exam" };

const COPY: Record<GateRule["kind"], { title: string; description: string }> = {
	topic: {
		title: "Bu konu özeti tam erişime dahil",
		description:
			"Mevzuat dayanaklı konu özetlerinin tamamı, tek seferlik satın alma ile kalıcı olarak açılır.",
	},
	print: {
		title: "Yazdırma tam erişime dahil",
		description:
			"Bir dersin bütün konu özetlerini tek belgede yazdırmak tam erişim gerektirir.",
	},
	exam: {
		title: "Deneme sınavları tam erişime dahil",
		description:
			"Süreli deneme sınavları soru havuzunun tamamından çekilir; tek seferlik satın alma ile kalıcı olarak açılır.",
	},
};

function unlocked(rule: GateRule, entitlement: Entitlement): boolean {
	switch (rule.kind) {
		case "topic":
			return isTopicUnlocked(rule.subjectId, rule.topicSlug, entitlement);
		case "print":
			return isSubjectPrintUnlocked(entitlement);
		case "exam":
			return isExamUnlocked(entitlement);
	}
}

export function AccessGate({
	rule,
	children,
}: {
	rule: GateRule;
	children: ReactNode;
}) {
	const entitlement = useEntitlement();

	/*
	 * Hak henüz çözülmedi. Erken bir "kilitli" varsayımı ödemiş kullanıcıya bir
	 * kare boyunca satın alma ekranı gösterirdi; erken bir "açık" varsayımı ise
	 * kilitli içeriği bir kare boyunca yüzeye çıkarırdı. İkisi de kabul edilemez,
	 * bu yüzden üçüncü bir hâl var.
	 */
	if (entitlement === undefined) {
		return (
			<Card role="status" aria-live="polite" className="text-center">
				<p className="text-fg-muted">Yükleniyor…</p>
			</Card>
		);
	}

	if (unlocked(rule, entitlement)) return <>{children}</>;

	return <LockedNotice {...COPY[rule.kind]} />;
}
