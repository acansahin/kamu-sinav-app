/*
 * Service worker — çevrimdışı desteği.
 *
 * Strateji bilinçli olarak iki katmanlı:
 *
 * 1. Otomatik: ziyaret edilen her sayfa ve varlık önbelleğe alınır. Kullanıcı
 *    metroda veya kurum binasında bağlantısını kaybettiğinde daha önce açtığı
 *    konular çalışmaya devam eder. Bedeli yok, çünkü zaten indirilmiş veriyi
 *    saklıyoruz.
 *
 * 2. İsteğe bağlı: kullanıcı Ayarlar'dan "tümünü indir" derse tüm site
 *    önden önbelleğe alınır. Çıktı ~10 MB olduğu için bu ASLA kendiliğinden
 *    yapılmaz — hedef kitlede kısıtlı veri kullanan kullanıcılar var.
 *
 * Elle yazıldı; Workbox gibi bir bağımlılık eklemek bu kadar basit bir
 * strateji için gereksiz ağırlık olurdu.
 */

const VERSION = "v1";
const CACHE = `kamu-sinav-${VERSION}`;

/** Kabuk: uygulamanın açılması için gereken en küçük küme. */
const SHELL = ["./", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

/**
 * Yalnızca kendi kaynağımızdaki GET istekleri önbelleklenir.
 * Farklı kaynaklara giden istekler olduğu gibi ağa bırakılır.
 */
function isCacheable(request) {
	if (request.method !== "GET") return false;
	const url = new URL(request.url);
	return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
	if (!isCacheable(event.request)) return;

	/*
	 * Gezinme istekleri için önce ağ denenir: içerik güncellenmişse kullanıcı
	 * bayat sayfa görmemeli. Ağ yoksa önbellekten servis edilir; o da yoksa
	 * daha önce ziyaret edilmiş bir sayfa olmadığı için ana sayfaya düşülür.
	 */
	if (event.request.mode === "navigate") {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, copy));
					return response;
				})
				.catch(() =>
					caches
						.match(event.request)
						.then((cached) => cached ?? caches.match("./")),
				),
		);
		return;
	}

	/*
	 * Varlıklar (JS, CSS, ikon, RSC yükü) içerik adresli olduğu için önce
	 * önbellekten verilir; ağ yalnızca ilk seferde kullanılır.
	 */
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request).then((response) => {
				if (response.ok) {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, copy));
				}
				return response;
			});
		}),
	);
});

/**
 * Sayfadan gelen komutlar.
 *
 * PRECACHE_ALL: derleme zamanında üretilen listeyi indirir ve ilerlemeyi
 * sayfaya bildirir. Parça parça yapılır; tek seferde yüzlerce istek açmak
 * zayıf bağlantıda başarısız olur.
 */
self.addEventListener("message", (event) => {
	if (event.data?.type !== "PRECACHE_ALL") return;

	event.waitUntil(
		(async () => {
			const source = event.source;
			const notify = (payload) => source?.postMessage(payload);

			try {
				const listUrl = new URL("./precache-manifest.json", self.registration.scope);
				const urls = await fetch(listUrl).then((r) => r.json());
				const cache = await caches.open(CACHE);

				let done = 0;
				const BATCH = 12;

				for (let i = 0; i < urls.length; i += BATCH) {
					const batch = urls.slice(i, i + BATCH);
					await Promise.all(
						batch.map(async (url) => {
							try {
								const absolute = new URL(url, self.registration.scope);
								const response = await fetch(absolute);
								if (response.ok) await cache.put(absolute, response);
							} catch {
								// Tek bir dosyanın düşmesi tüm indirmeyi iptal etmemeli.
							}
						}),
					);
					done += batch.length;
					notify({ type: "PRECACHE_PROGRESS", done, total: urls.length });
				}

				notify({ type: "PRECACHE_DONE", total: urls.length });
			} catch (error) {
				notify({ type: "PRECACHE_FAILED", message: String(error) });
			}
		})(),
	);
});
