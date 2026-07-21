# Kamu Sınav Akademi

Türkiye'deki kamu kurumlarında yapılan **Görevde Yükselme** ve **Unvan Değişikliği**
sınavlarına hazırlık uygulaması. Web tabanlı, çevrimdışı çalışır, reklamsız.

> **Durum:** Faz 1 / dikey dilim. Mimarinin tüm katmanları tek bir konu üzerinden uçtan
> uca çalışıyor. İçerik doldurma devam ediyor.

## Ne farklı?

Rakiplerin çözemediği sorun soru sayısı değil, **güven**:

- **Her sorunun mevzuat dayanağı görünür** — hangi kanunun hangi maddesi, şema düzeyinde zorunlu alan.
- **Her sorunun kaynağı izlenebilir** — kaynağı doğrulanmamış soru yayımlanamaz, build kırılır.
- **İçerik mevzuat sürümüyle damgalı** — hangi tarihli hâle göre hazırlandığı ve en son ne zaman doğrulandığı yazar.
- **Gerçek erişilebilirlik** — hedef kitlenin yaş profiline uygun; 44px dokunma hedefi, üç kademeli yazı boyutu, yüksek kontrast modu.
- **Reklamsız ve çevrimdışı** — hesap gerekmez, veri cihazda kalır, JSON olarak dışa aktarılabilir.

## Hızlı başlangıç

```bash
npm install
npm run dev      # içeriği derler, sonra http://localhost:3000
```

```bash
npm run build        # statik export → out/
npm test             # birim testler (54)
npm run typecheck
npm run content:build   # yalnızca içerik doğrulama + kapsam raporu
npm run android:sync    # build + web varlıklarını Android projesine kopyala
```

APK yerel makinede derlenmez; `.github/workflows/android.yml` üretir ve **Artifacts**
altına koyar.

## Teknoloji

| Katman | Seçim |
|---|---|
| Uygulama | Next.js 16 (App Router, **statik export**) · React 19 · TypeScript strict |
| Arayüz | Tailwind CSS v4 · lucide-react |
| Durum | Zustand (görsel tercihler) · Dexie live query (ilerleme) |
| Kalıcılık | Dexie / IndexedDB — repository arayüzü arkasında |
| İçerik | MDX + JSON, Zod ile derleme zamanında doğrulanır |
| Test | Vitest |
| Mobil | Capacitor (Android), APK GitHub Actions'ta üretilir — bu yüzden çıktı **tam statik** olmak zorunda |

## Yapı

```
content/       kaynak içerik (MDX özetler + JSON sorular) — insan yazar, git'te durur
scripts/       build-content.ts: doğrulama + telif kapısı + derleme
src/app/       rotalar (App Router)
src/features/  dikey dilimler: study, quiz, exam, progress, settings
src/lib/       çerçeveden bağımsız saf mantık: scoring, selector, db, repositories
src/types/     Zod şemaları → türetilmiş TypeScript tipleri
tests/         birim testler
android/       Capacitor tarafından üretilen Android projesi
```

## Belgeler

- **[PROJECT_PLAN.md](PROJECT_PLAN.md)** — pazar araştırması, rakip analizi, mimari
  kararlar ve gerekçeleri, veri modeli, ekran listesi, kullanıcı akışları, yol haritası.
- **[AGENTS.md](AGENTS.md)** — geliştirme kuralları, içerik ekleme, telif kısıtları,
  bilinen tuzaklar.

## Telif

Kamu kurumlarının yayımladığı çıkmış sınav soruları kaynak gösterilerek kullanılır; özel
yayınevlerinin ve ücretli platformların soru bankaları **kullanılmaz**. Ayrıntı için
[PROJECT_PLAN.md §14](PROJECT_PLAN.md) ve [AGENTS.md](AGENTS.md).
