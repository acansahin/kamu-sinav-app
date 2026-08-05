"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Entitlement } from "@/lib/billing/entitlement";
import {
	entitlementFromCache,
	readEntitlementCache,
	writeEntitlementCache,
} from "@/lib/billing/entitlement-cache";
import { resolveEntitlement } from "@/lib/billing/entitlement-resolver";
import {
	getBillingProvider,
	isNativeRuntime,
} from "@/lib/billing/billing.provider";

/**
 * Hakkın React'e bağlanması.
 *
 * `lib/billing/**` React görmez; bu dosya yapıştırıcıdır ve
 * `lib/stores/identity.ts` ile `lib/stores/preferences.ts`in kurduğu emsali
 * izler.
 *
 * `undefined` bilinçli bir üçüncü hâldir: "henüz bilinmiyor". Arayüz o hâlde
 * ne içerik ne kilit gösterir — iskelet gösterir. Erken bir `false` varsayımı
 * ödemiş kullanıcıya bir kare boyunca kilit ekranı gösterirdi.
 */

let entitlement: Entitlement | undefined;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) listener();
}

function setEntitlement(next: Entitlement): void {
	if (
		entitlement?.paywallActive === next.paywallActive &&
		entitlement?.fullAccess === next.fullAccess
	) {
		return;
	}
	entitlement = next;
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): Entitlement | undefined {
	return entitlement;
}

/**
 * Statik ön üretimde depo yoktur; sunucu anlık görüntüsü her zaman
 * `undefined`dır. İstemcide gerçek değer okunduğunda React aradaki farkı
 * hidrasyon uyuşmazlığı saymak yerine düzgünce yeniden render eder
 * (`useIdentity` ile aynı gerekçe).
 */
function getServerSnapshot(): Entitlement | undefined {
	return undefined;
}

/**
 * Kilit kararı. `undefined` = henüz çözülmedi.
 *
 * Okuyan her bileşen bu üç hâli de karşılamak zorundadır; `AccessGate` ve
 * `QuizGate` bunu tek yerde yapar, çağrı yerleri genellikle onları kullanır.
 */
export function useEntitlement(): Entitlement | undefined {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Önbellekten gelen ilk (senkron) değer — ilk açılış dışında iskelet göstermez. */
function hydrateFromCache(): void {
	if (entitlement) return;
	const cached = entitlementFromCache(readEntitlementCache());
	if (cached) setEntitlement(cached);
}

/**
 * Play'e sorar, sonucu önbellekle uzlaştırır ve store'a yazar.
 *
 * Sorgunun `null` dönmesi (çevrimdışı) `false` ile karıştırılmaz — uzlaştırma
 * `resolveEntitlement` içinde ve testlidir.
 */
async function refresh(): Promise<void> {
	const native = await isNativeRuntime();
	const provider = await getBillingProvider();
	const playResult = native ? await provider.queryEntitlement() : null;

	const { entitlement: next, cacheUpdate } = resolveEntitlement({
		native,
		cached: readEntitlementCache(),
		playResult,
	});

	if (cacheUpdate) writeEntitlementCache(cacheUpdate);
	setEntitlement(next);
}

/** Satın alma veya geri yükleme sonrası hakkı yeniden okur. */
export async function refreshEntitlement(): Promise<void> {
	await refresh();
}

/**
 * Hak çözümlemesini kurar — kök düzende BİR KEZ çağrılır.
 *
 * `useApplyPreferences` ile aynı sözleşme: ikinci bir çağrı ikinci bir sorgu
 * ve gereksiz Play trafiği doğurur.
 *
 * `resume` dinleyicisi isteğe bağlı değildir: Play satın alması uygulama
 * DIŞINDA tamamlanabilir (nakit ödeme onayı, aile onayı) ve o durumda hak
 * ancak uygulama öne geldiğinde görünür hâle gelir.
 */
export function useResolveEntitlement(): void {
	useEffect(() => {
		hydrateFromCache();

		let cancelled = false;
		const run = (): void => {
			// Hak çözümlemesi arka plan işidir; başarısız olursa önbellek ya da
			// kısıtlı hâl geçerli kalır ve kullanıcıya gösterilecek bir şey yok.
			void refresh().catch(() => {});
		};

		run();

		/*
		 * Onaylanmamış satın almaların süpürülmesi. Play 3 gün içinde
		 * acknowledge edilmeyeni otomatik iade eder; eklentinin otomatik onayı
		 * uygulama satın almadan hemen sonra öldürülürse hiç çalışmaz.
		 */
		void getBillingProvider()
			.then((provider) => provider.sweepAcknowledgements())
			.catch(() => {});

		let remove: (() => void) | undefined;
		void (async () => {
			try {
				const { App } = await import("@capacitor/app");
				const handle = await App.addListener("resume", run);
				if (cancelled) {
					void handle.remove();
					return;
				}
				remove = () => void handle.remove();
			} catch {
				/* tarayıcıda `resume` olayı yok — sorun değil */
			}
		})();

		return () => {
			cancelled = true;
			remove?.();
		};
	}, []);
}
