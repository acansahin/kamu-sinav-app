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
6. **Ödeme profili (merchant account)** — uygulama içi ürün oluşturmanın
   önkoşuludur.
7. **Uygulama içi ürün** — Monetize → Products → In-app products:
   - Ürün kimliği: **`tam_erisim`** (`src/lib/billing/products.ts` ile birebir
     aynı olmalı). **Oluşturulduktan sonra değiştirilemez, silinirse yeniden
     kullanılamaz.**
   - Tür: tek seferlik (managed product). Abonelik değildir.
   - Fiyat: TRY. Google Play Türkiye'de **kayıtlı satıcıdır**; girilen fiyat
     kullanıcıya vergi dâhil görünür (Console'daki vergi ayarından doğrulayın).
   - Durum: **Aktif**. Yayılması birkaç saat sürebilir; ürün pasifken
     `getProduct()` null döner ve bu bir kod hatası sanılır.
8. **Lisans testi** — Setup → License testing'e test Gmail adresleri eklenir.

## Yükleme

`.aab` dosyası `.github/workflows/android-release.yml` iş akışıyla üretilir ve
iş çıktısı olarak indirilir. İlk yüklemenin **iç test** kanalına yapılması
önerilir; üretime çıkmadan önce imzalı paketin gerçek cihazda açıldığı
doğrulanmalıdır.

### Satın alma nasıl test edilir

⚠️ **Uygulama içi satın alma, `android.yml` iş akışının ürettiği debug APK ile
test EDİLEMEZ.** Play Billing yalnızca Play tarafından dağıtılan bir pakette
çalışır; debug APK'da `getProduct()` boş döner. Test için AAB'yi **iç test**
kanalına yükleyip cihaza Play üzerinden kurun.

Kabul kriteri olan senaryolar:

1. Satın al → uygulamayı kapat/aç → erişim kalıcı.
2. Uygulama verisini sil → "Satın alımları geri yükle" → erişim geri gelir.
3. Uçak moduna al → erişim korunur (önbellek).
4. **Console'dan iade et → uygulamayı aç → kilit geri gelir.** En çok atlanan
   senaryodur ve iade akışının tek doğrulaması budur.

### Manifest ve boyut kontrolü

- `com.android.vending.BILLING` izni depodaki manifestte yazılı değildir;
  Billing AAR'ından manifest merge ile gelir. **Merger raporuna bakmayın** —
  `android/app/build/outputs/logs/` runner'da kalır, artifact olarak
  yüklenmez. İzinler indirilen AAB'den okunur:

  ```bash
  unzip -q app-release.aab -d x && grep -a -o "android.permission.[A-Z_]*\|com.android.vending.[A-Z_]*" x/base/manifest/AndroidManifest.xml | sort -u
  ```

  Çıkan liste `data-safety.md`'deki izin tablosuyla birebir tutmalıdır;
  tutmuyorsa önce o tablo güncellenir, sonra Console formu doldurulur.
- İmzanın gerçekten atıldığı da AAB'den doğrulanır. Gradle, keystore yoksa
  imzasız paketi **sessizce** üretir ve bu ancak Play yüklemeyi reddedince
  fark edilir:

  ```bash
  jarsigner -verify -verbose:summary app-release.aab
  ```

  `jar verified.` görmeniz gerekir; çıktının sonundaki sertifika bitiş tarihi
  de Google'ın eşiği olan 2033'ün ötesinde olmalıdır.
- `minifyEnabled false` olduğu için `billing:8.3.0` + `guava` budanmadan girer.
  AAB boyutunu satın alma öncesi/sonrası karşılaştırın. Ölçüm: ilk imzalı
  AAB **16,2 MB** (8 Ağustos 2026, run 31273321559).
