"use client";

import { useSyncExternalStore } from "react";
import {
	IDLE_STATUS,
	type SyncStatus,
	getSyncStatus,
	subscribeSyncStatus,
} from "@/lib/sync/sync-status";

/**
 * Senkron durumunu React'e bağlar.
 *
 * `useIdentity` ile aynı gerekçe: durum `localStorage`'da durur ve statik
 * export sırasında sunucuda ÖN ÜRETİLİR. Sunucu anlık görüntüsü her zaman
 * nötrdür (`IDLE_STATUS`); istemcide gerçek değer okunur ve React aradaki farkı
 * hidrasyon uyuşmazlığı saymadan yeniden render ederek kapatır.
 */
export function useSyncStatus(): SyncStatus {
	return useSyncExternalStore(
		subscribeSyncStatus,
		getSyncStatus,
		() => IDLE_STATUS,
	);
}
