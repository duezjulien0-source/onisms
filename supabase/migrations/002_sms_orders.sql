-- =============================================
-- OniSMS — migration 002 : table des commandes SMS
-- A executer dans Supabase > SQL Editor
-- =============================================

create table if not exists public.sms_orders (
  id uuid primary key default gen_random_uuid(),
  va_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_order_id text not null,
  phone text not null,
  service text not null,
  country text not null,
  operator text,
  status text not null default 'pending'
    check (status in ('pending', 'received', 'canceled', 'timeout', 'banned', 'finished')),
  code text,
  sms_text text,
  cost numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  finished_at timestamptz,

  unique (provider, provider_order_id)
);

comment on table public.sms_orders is 'Commandes de numeros virtuels passees aupres des fournisseurs SMS';
comment on column public.sms_orders.provider is 'Nom du fournisseur : 5sim, smspool, sms-activate, etc.';
comment on column public.sms_orders.provider_order_id is 'ID de la commande chez le fournisseur (sert au polling)';
comment on column public.sms_orders.status is 'pending = en attente / received = code recu / finished = clos OK / canceled = annule par VA / timeout = expire / banned = numero blackliste';
comment on column public.sms_orders.cost is 'Cout en USD facture par le fournisseur';

-- RLS
alter table public.sms_orders enable row level security;

drop policy if exists "view_own_orders_or_admin" on public.sms_orders;
create policy "view_own_orders_or_admin" on public.sms_orders
  for select using (auth.uid() = va_id or public.is_admin());

drop policy if exists "insert_own_orders_or_admin" on public.sms_orders;
create policy "insert_own_orders_or_admin" on public.sms_orders
  for insert with check (auth.uid() = va_id or public.is_admin());

drop policy if exists "update_own_orders_or_admin" on public.sms_orders;
create policy "update_own_orders_or_admin" on public.sms_orders
  for update using (auth.uid() = va_id or public.is_admin())
  with check (auth.uid() = va_id or public.is_admin());

create index if not exists idx_sms_orders_va on public.sms_orders(va_id);
create index if not exists idx_sms_orders_status on public.sms_orders(status);
create index if not exists idx_sms_orders_created on public.sms_orders(created_at desc);
create index if not exists idx_sms_orders_provider on public.sms_orders(provider);
