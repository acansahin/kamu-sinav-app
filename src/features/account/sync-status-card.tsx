"use client";

import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSyncStatus } from "@/lib/stores/sync-status";
import { formatLastSynced } from "@/lib/sync/sync-status";
import { fullSync } from "@/lib/sync/sync";

/**
 * Eşitleme durumu + elle "şimdi eşitle".
 *
 * Yalnızca girişliyken gösterilir (senkron zaten yalnızca hesap kimliğinde
 * çalışır). Durum tek yerden — `useSyncStatus` — okunur; düğme `fullSync`'i
 * çağırır ve o da aynı depoyu günceller, dolayısıyla gösterge kendiliğinden
 * tazelenir. Hata `fullSync` içinde depoya işlendiği için burada yutmak
 * yeterli; ayrı bir hata durumu tutmaya gerek yok.
 */
export function SyncStatusCard() {
	const status = useSyncStatus();
	const syncing = status.phase === "syncing";
	const failed = status.phase === "error";

	async function syncNow() {
		try {
			await fullSync();
		} catch {
			// Durum `fullSync` içinde "error" olarak işaretlendi; gösterge onu yansıtır.
		}
	}

	return (
		<Card>
			<h2 className="mb-1 flex items-center gap-2 text-base font-bold">
				{failed ? (
					<CloudOff aria-hidden size={18} className="text-wrong" />
				) : (
					<Cloud aria-hidden size={18} className="text-fg-subtle" />
				)}
				Eşitleme
			</h2>

			{/* Renk tek başına anlam taşımaz: durum her zaman metinle anlatılır. */}
			<p className="text-sm text-fg-muted">
				{failed
					? "Şu an eşitlenemedi. İnternet bağlantını kontrol edip yeniden dene."
					: `${formatLastSynced(status.lastSyncedAt)}.`}
			</p>
			{failed && status.lastSyncedAt && (
				<p className="mt-1 text-sm text-fg-subtle">
					{formatLastSynced(status.lastSyncedAt)}.
				</p>
			)}

			<Button
				variant="secondary"
				onClick={() => void syncNow()}
				disabled={syncing}
				className="mt-4"
			>
				<RefreshCw aria-hidden size={18} className={syncing ? "animate-spin" : ""} />
				{syncing ? "Eşitleniyor…" : "Şimdi eşitle"}
			</Button>
		</Card>
	);
}
