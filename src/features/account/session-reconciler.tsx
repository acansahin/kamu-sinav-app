"use client";

import { useEffect } from "react";
import { reconcileSession } from "@/lib/auth/session";

/**
 * Açılışta yerel kimliği sunucudaki oturumla uzlaştırır.
 *
 * Kimlik `localStorage`'dan senkron okunur, yani uygulama ağı beklemeden
 * doğru kullanıcının verisini gösterir. Ama sunucudaki oturum iptal edilmiş
 * veya süresi dolmuş olabilir; bu bileşen o kontrolü arka planda yapar.
 *
 * Çevrimdışıyken hiçbir şey yapmaz — bkz. `reconcileSession`.
 */
export function SessionReconciler() {
	useEffect(() => {
		void reconcileSession();
	}, []);

	return null;
}
