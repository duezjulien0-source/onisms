-- =============================================
-- OniSMS — Schéma initial (migration 001)
-- À exécuter dans Supabase > SQL Editor > New Query > Run
-- =============================================

-- 1. Table des profils utilisateurs (étend auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'va' check (role in ('admin', 'va')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  budget_total numeric(10,4) not null default 0,
  budget_spent numeric(10,4) not null default 0,
  tags text[] default array[]::text[],
  country text default 'FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profils utilisateurs : Admin agence + VAs';
comment on column public.profiles.role is 'admin = patron agence | va = virtual assistant';
comment on column public.profiles.budget_total is 'Budget alloue a ce VA en $ (0 = illimite si admin)';
comment on column public.profiles.budget_spent is 'Montant deja depense par ce VA en $';

-- 2. Table du wallet agence (1 seule ligne)
create table if not exists public.agency_wallet (
  id int primary key default 1,
  balance numeric(10,4) not null default 0,
  total_recharged numeric(10,4) not null default 0,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

comment on table public.agency_wallet is 'Cagnotte globale de l agence (table a 1 ligne)';

insert into public.agency_wallet (id, balance, total_recharged)
values (1, 0, 0)
on conflict (id) do nothing;

-- 3. Fonction utilitaire : is_admin() (evite la recursion RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 4. Trigger : creer profil auto a l inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Backfill : creer profil pour utilisateurs existants
-- Le 1er utilisateur (par date de creation) devient Admin
insert into public.profiles (id, email, role)
select u.id, u.email,
  case when row_number() over (order by u.created_at) = 1 then 'admin' else 'va' end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 6. RLS sur profiles
alter table public.profiles enable row level security;

drop policy if exists "view_own_or_admin" on public.profiles;
create policy "view_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "update_own_basic" on public.profiles;
create policy "update_own_basic" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admin_full_access" on public.profiles;
create policy "admin_full_access" on public.profiles
  for all using (public.is_admin())
  with check (public.is_admin());

-- 7. RLS sur agency_wallet
alter table public.agency_wallet enable row level security;

drop policy if exists "all_can_view_wallet" on public.agency_wallet;
create policy "all_can_view_wallet" on public.agency_wallet
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin_updates_wallet" on public.agency_wallet;
create policy "admin_updates_wallet" on public.agency_wallet
  for update using (public.is_admin())
  with check (public.is_admin());

-- 8. Index pour les requetes frequentes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(status);

-- =============================================
-- Fin de la migration 001
-- =============================================
