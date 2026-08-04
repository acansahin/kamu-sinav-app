# Google Play mağaza dosyaları

Play Console'a yüklenecek metinler ve görseller. Buradaki her şey **üretilebilir
ya da gözden geçirilebilir kaynaktır**; Console'daki alanlara elle yazılan bir
metin bir sonraki sürümde kaybolur.

| Dosya | Ne için |
|---|---|
| [listing-tr.md](listing-tr.md) | Kısa/uzun açıklama, sürüm notları |
| [data-safety.md](data-safety.md) | Veri güvenliği formu cevapları |
| [content-rating.md](content-rating.md) | İçerik derecelendirme anketi cevapları |
| `assets/icon-512.png` | Mağaza kartı ikonu (512×512) |
| `assets/feature-graphic.png` | Öne çıkan görsel (1024×500) |
| `assets/screenshots/` | Telefon ekran görüntüleri (1080×2400) |

## Görselleri yeniden üretme

Görseller depoya ikili dosya olarak elle konmaz; ikonlarla aynı kaynaktan
türetilir, böylece marka rengi değişince mağaza kartı da onunla birlikte
değişir.

```bash
npm run icons:build
```

Ekran görüntüleri gerçek uygulamadan alınır. Sıra bağlayıcıdır — `out/`
yoksa sunulacak bir şey yoktur:

```bash
npm run build && npx serve out -p 4173
```

Sonra ayrı bir kabukta:

```bash
npm run store:screenshots
```

> **Anahtarsız derleyin.** Yayınlanan paket Supabase anahtarı taşımaz, yani
> hesap özelliği kapalıdır ve başlıkta hesap ikonu görünmez. `.env.local`
> dolu bir makinede alınan görüntüler mağazada olmayan bir özelliği gösterir.
> Görüntü almadan önce `NEXT_PUBLIC_SUPABASE_URL=` ve
> `NEXT_PUBLIC_SUPABASE_ANON_KEY=` boş geçilerek derleyin.

## Console'da elle yapılacaklar

Bunlar depoda tutulamaz; Play Console hesabında yapılır:

1. **Gizlilik politikası URL'i** — zorunlu. `pages.yml` iş akışı elle
   tetiklendikten sonra `https://<kullanıcı>.github.io/kamu-sinav-app/gizlilik/`
   adresi kullanılabilir. Yayın kararı bilinçlidir: site yayına alınınca soru
   havuzunun tamamı herkese açık hâle gelir (bkz. AGENTS.md).
2. **Geliştirici iletişim e-postası** — zorunlu ve mağaza sayfasında herkese
   görünür. `src/lib/legal/data-controller.ts` içindeki adresle aynı olmalıdır.
3. **İçerik derecelendirme anketi** — cevaplar `content-rating.md` içinde.
4. **Veri güvenliği formu** — cevaplar `data-safety.md` içinde.
5. **Ülke/bölge seçimi** — içerik Türkiye mevzuatına özgüdür; yalnızca Türkiye
   seçilmesi önerilir.

## Yükleme

`.aab` dosyası `.github/workflows/android-release.yml` iş akışıyla üretilir ve
iş çıktısı olarak indirilir. İlk yüklemenin **iç test** kanalına yapılması
önerilir; üretime çıkmadan önce imzalı paketin gerçek cihazda açıldığı
doğrulanmalıdır.
