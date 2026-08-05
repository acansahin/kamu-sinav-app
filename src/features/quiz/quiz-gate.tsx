"use client";

import type { Route } from "next";
import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "@/components/layout/breadcrumb";
import { Card } from "@/components/ui/card";
import { LockedNotice } from "@/features/billing/locked-notice";
import { isTestSetUnlocked } from "@/lib/billing/entitlement";
import { routes } from "@/lib/routes";
import { useEntitlement } from "@/lib/stores/entitlement";

/**
 * Test sayfasının kilit kapısı.
 *
 * `QuizRunner`ın İÇİNE konmamasının sebebi yan etkidir: koşucu monte edilir
 * edilmez `progressRepository.createTestSession` ile bir oturum satırı yazar.
 * Kilidi içeriden uygulamak, kilitli bir test için oturum kaydı üretirdi —
 * istatistikte görünen ama hiç çözülmemiş testler. Sarmalayıcı kilitliyken
 * koşucuyu HİÇ mount etmez.
 *
 * Kilit ekranı da konum çubuğunu korur: kullanıcı buraya derin bağlantıyla
 * gelmiş olabilir ve geri dönebilecek bir yol görmelidir.
 *
 * Bu, kilidin TEK kapısıdır — liste satırı da doğrudan yazılan URL de buradan
 * geçer. Kilit yalnızca listede olsaydı derin bağlantı ve Android geri yığını
 * paywall'ı atlardı.
 */
export function QuizGate({
	subjectId,
	subjectName,
	topicSlug,
	topicName,
	setNumber,
	setSlug,
	setCount,
	children,
}: {
	subjectId: string;
	subjectName: string;
	topicSlug: string;
	topicName: string;
	setNumber: number;
	setSlug: string;
	setCount: number;
	children: ReactNode;
}) {
	const entitlement = useEntitlement();

	// Konum çubuğu `QuizRunner`daki ile aynı biçimde kurulur: konu adı dersin
	// adıyla aynı olabiliyor ve iki kez basılmamalı.
	const breadcrumb =
		subjectName === topicName ? topicName : `${subjectName} · ${topicName}`;
	const crumbs: Crumb[] = [
		{ href: "/testler" as Route, label: "Testler" },
		{ href: routes.topicTest(subjectId, topicSlug), label: breadcrumb },
	];

	function frame(body: ReactNode) {
		return (
			<div>
				<Breadcrumb items={crumbs} />
				<h1 className="mb-4 text-xl font-bold">
					Test {setNumber} <span className="text-fg-subtle">/ {setCount}</span>
				</h1>
				{body}
			</div>
		);
	}

	// Hak henüz çözülmedi. Görsel dil `QuizRunner`ın "Test hazırlanıyor…"
	// durumuyla aynı; kullanıcı iki farklı bekleme ekranı görmez.
	if (entitlement === undefined) {
		return frame(
			<Card>
				<p role="status" className="text-fg-muted">
					Test hazırlanıyor…
				</p>
			</Card>,
		);
	}

	if (isTestSetUnlocked(subjectId, topicSlug, setSlug, entitlement)) {
		return <>{children}</>;
	}

	return frame(
		<LockedNotice
			title={`Test ${setNumber} tam erişime dahil`}
			description="Beş dersin bütün konu testleri, tek seferlik satın alma ile kalıcı olarak açılır."
		/>,
	);
}
