"use client";

import { useSyncExternalStore } from "react";
import {
	type Identity,
	LOCAL_IDENTITY,
	currentIdentity,
	subscribeIdentity,
} from "@/lib/auth/identity";

/**
 * Aktif kimliği React'e bağlar.
 *
 * `useSyncExternalStore` bilinçli bir seçimdir: kimlik `localStorage`'da durur
 * ve statik export sırasında sunucuda ÖN ÜRETİLİR. Sunucu anlık görüntüsü her
 * zaman anonimdir; istemcide gerçek kimlik okunur ve React aradaki farkı
 * hidrasyon uyuşmazlığı saymak yerine düzgünce yeniden render ederek kapatır.
 */
export function useIdentity(): Identity {
	return useSyncExternalStore(
		subscribeIdentity,
		currentIdentity,
		() => LOCAL_IDENTITY,
	);
}
