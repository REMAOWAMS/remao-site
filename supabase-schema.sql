-- =====================================================================
-- REMAO — Schéma de base de données Supabase
-- À coller dans : Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) Table unique des contenus (actualités, pays, assises, documents,
--    partenaires, membres). Le type distingue chaque contenu ; les champs
--    sont stockés dans "data" (jsonb) pour rester souple.
create table if not exists public.contenus (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contenus_type_idx on public.contenus (type);

-- 2) Sécurité : on active Row Level Security
alter table public.contenus enable row level security;

-- Lecture PUBLIQUE (le site web affiche les contenus publiés)
drop policy if exists "Lecture publique" on public.contenus;
create policy "Lecture publique"
  on public.contenus for select
  using (true);

-- Écriture RÉSERVÉE aux membres connectés (Bureau Exécutif)
drop policy if exists "Insert authentifie" on public.contenus;
create policy "Insert authentifie"
  on public.contenus for insert to authenticated
  with check (true);

drop policy if exists "Update authentifie" on public.contenus;
create policy "Update authentifie"
  on public.contenus for update to authenticated
  using (true) with check (true);

drop policy if exists "Delete authentifie" on public.contenus;
create policy "Delete authentifie"
  on public.contenus for delete to authenticated
  using (true);

-- 3) Stockage des images et fichiers (logos, photos, affiches, PDF)
insert into storage.buckets (id, name, public)
values ('medias', 'medias', true)
on conflict (id) do nothing;

drop policy if exists "Medias lecture publique" on storage.objects;
create policy "Medias lecture publique"
  on storage.objects for select
  using (bucket_id = 'medias');

drop policy if exists "Medias upload authentifie" on storage.objects;
create policy "Medias upload authentifie"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'medias');

drop policy if exists "Medias update authentifie" on storage.objects;
create policy "Medias update authentifie"
  on storage.objects for update to authenticated
  using (bucket_id = 'medias');

drop policy if exists "Medias delete authentifie" on storage.objects;
create policy "Medias delete authentifie"
  on storage.objects for delete to authenticated
  using (bucket_id = 'medias');

-- =====================================================================
-- Fin. Ensuite : Authentication > Users > Add user (email + mot de passe)
-- pour créer le compte du Bureau Exécutif.
-- =====================================================================
