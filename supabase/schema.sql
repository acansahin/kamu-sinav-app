-- Kamu Sınav Akademi — sunucu şeması ve RLS politikaları (Faz 3, Dilim 3).
--
-- NASIL ÇALIŞTIRILIR: Supabase panelinde SQL Editor → New query → bu dosyanın
-- tamamını yapıştır → Run. İdempotenttir; tekrar çalıştırmak veriyi silmez.
--
-- ─────────────────────────────────────────────────────────────────────────
-- TASARIM
--
-- Her satır: kimlik/senkron için gerçek sütunlar (id, user_id, zaman damgası)
-- + geri kalan her şey `data jsonb`. Neden JSONB: istemci tipine yeni bir alan
-- eklendiğinde (ör. Faz 4'te soruya yeni bir özellik) sunucu şeması GÖÇ
-- GEREKTİRMEZ. Bu, PROJECT_PLAN.md §7.2'deki "senkron şema göçü istemesin"
-- ilkesinin sürdürülmesidir. Senkronun ihtiyaç duyduğu iki sorgu —
-- "bu kullanıcının satırları" ve "şu damgadan sonra değişenler" — indeksli
-- sütunlarla karşılanır; `data` içine hiç bakılmaz.
--
-- HANGİ TABLOLAR BURADA YOK, NEDEN:
--   • daily_stats     → istemcide `attempts` günlüğünden yeniden üretilir.
--   • review_schedule → aynı şekilde `attempts` sırayla oynatılarak üretilir.
-- Bu ikisi bilinçli olarak senkronlanmaz; ayrıntı PROJECT_PLAN.md §16, Dilim 3.
--
-- GÜVENLİK: Tek koruma RLS'tir. Anon anahtarı tarayıcıya iner (tasarım gereği);
-- veriyi anahtarın gizliliği değil, aşağıdaki "yalnızca kendi satırın"
-- politikaları korur. service_role anahtarı RLS'i atlar ve bu uygulamada
-- HİÇBİR YERDE kullanılmaz.
-- ─────────────────────────────────────────────────────────────────────────

-- Append-only olay günlüğü. Güncellenmez; imleç `created_at` üzerinden yürür.
create table if not exists public.attempts (
	id         uuid        primary key,
	user_id    uuid        not null references auth.users (id) on delete cascade,
	created_at timestamptz not null,
	data       jsonb       not null
);

-- Konu ilerlemesi. Doğal anahtarı (kullanıcı, konu) bileşiktir.
-- DİKKAT: data.summaryRead / summaryReadAt `attempts`'ten türetilemez; çekme
-- adımı bu tabloyu yeniden inşa ederken o alanları korumak zorundadır.
create table if not exists public.topic_progress (
	user_id    uuid        not null references auth.users (id) on delete cascade,
	topic_id   text        not null,
	updated_at timestamptz not null,
	data       jsonb       not null,
	primary key (user_id, topic_id)
);

-- Konu testi oturumları. Son yazan kazanır (`updated_at`).
create table if not exists public.test_sessions (
	id         uuid        primary key,
	user_id    uuid        not null references auth.users (id) on delete cascade,
	updated_at timestamptz not null,
	data       jsonb       not null
);

-- Deneme sınavı oturumları. Son yazan kazanır.
create table if not exists public.exam_sessions (
	id         uuid        primary key,
	user_id    uuid        not null references auth.users (id) on delete cascade,
	updated_at timestamptz not null,
	data       jsonb       not null
);

-- Hata bildirimleri. `status` sunucu tarafında da değişebildiği için son
-- yazan kazanır.
create table if not exists public.reports (
	id         uuid        primary key,
	user_id    uuid        not null references auth.users (id) on delete cascade,
	updated_at timestamptz not null,
	data       jsonb       not null
);

-- Çalışma ayarları. Kullanıcı başına tek satır.
create table if not exists public.settings (
	user_id    uuid        primary key references auth.users (id) on delete cascade,
	updated_at timestamptz not null,
	data       jsonb       not null
);

-- Yer imleri. Doğal anahtarı (kullanıcı, tür, referans) bileşiktir. Silme
-- MEZAR TAŞIYLA taşınır: `data.deletedAt` doluysa yer imi kaldırılmıştır, ama
-- satır yine durur ki silme başka cihazlara da inebilsin. Son yazan kazanır.
create table if not exists public.bookmarks (
	user_id    uuid        not null references auth.users (id) on delete cascade,
	ref_type   text        not null,
	ref_id     text        not null,
	updated_at timestamptz not null,
	data       jsonb       not null,
	primary key (user_id, ref_type, ref_id)
);

-- ── İmleç indeksleri ──────────────────────────────────────────────────────
-- "Şu damgadan sonra değişenler" sorgusu (gönderim/çekme imleci) bu
-- indekslerle çalışır. attempts append-only olduğu için created_at yeter.
create index if not exists attempts_user_created
	on public.attempts (user_id, created_at);
create index if not exists topic_progress_user_updated
	on public.topic_progress (user_id, updated_at);
create index if not exists test_sessions_user_updated
	on public.test_sessions (user_id, updated_at);
create index if not exists exam_sessions_user_updated
	on public.exam_sessions (user_id, updated_at);
create index if not exists reports_user_updated
	on public.reports (user_id, updated_at);
create index if not exists bookmarks_user_updated
	on public.bookmarks (user_id, updated_at);

-- ── Satır düzeyi güvenlik ──────────────────────────────────────────────────
-- Her tabloda tek kural: kullanıcı YALNIZCA kendi satırlarını görür ve yazar.
-- `using` okuma/güncelleme/silmeyi, `with check` ekleme/güncellemeyi kapsar;
-- ikisi birlikte başka bir user_id'ye satır sızdırmayı da yazmayı da engeller.
do $$
declare
	t text;
begin
	foreach t in array array[
		'attempts', 'topic_progress', 'test_sessions',
		'exam_sessions', 'reports', 'settings', 'bookmarks'
	]
	loop
		execute format('alter table public.%I enable row level security;', t);
		execute format('drop policy if exists %I_owner on public.%I;', t, t);
		execute format(
			'create policy %I_owner on public.%I for all to authenticated '
			|| 'using (auth.uid() = user_id) with check (auth.uid() = user_id);',
			t, t
		);
	end loop;
end $$;
