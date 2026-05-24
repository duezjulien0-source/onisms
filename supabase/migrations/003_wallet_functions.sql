-- =============================================
-- OniSMS — migration 003 : fonctions wallet
-- A executer dans Supabase > SQL Editor
-- =============================================

-- Fonction : essaie de debiter le wallet agence + le budget d'un VA
-- Retourne true si OK, false si budget VA insuffisant.
-- Securisee : verifie le budget restant du VA (sauf pour admin = illimite).
create or replace function public.try_charge_va(
  va_id_param uuid,
  amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_remaining numeric;
begin
  if amount <= 0 then
    return true; -- rien a debiter
  end if;

  -- Recupere role + budget restant du VA
  select role,
    case when role = 'admin' then 999999
         else greatest(0, budget_total - budget_spent)
    end
  into v_role, v_remaining
  from public.profiles where id = va_id_param;

  if v_role is null then
    return false; -- VA introuvable
  end if;

  if v_remaining < amount then
    return false; -- budget VA insuffisant
  end if;

  -- Debit atomique du wallet agence + budget VA
  update public.agency_wallet
  set balance = balance - amount, updated_at = now()
  where id = 1;

  update public.profiles
  set budget_spent = budget_spent + amount, updated_at = now()
  where id = va_id_param;

  return true;
end;
$$;

-- Fonction : rembourse un VA (cas d'annulation, timeout, etc.)
create or replace function public.refund_va(
  va_id_param uuid,
  amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount <= 0 then return; end if;

  update public.agency_wallet
  set balance = balance + amount, updated_at = now()
  where id = 1;

  update public.profiles
  set budget_spent = greatest(0, budget_spent - amount), updated_at = now()
  where id = va_id_param;
end;
$$;

-- Fonction : recharge le wallet agence (admin uniquement)
create or replace function public.recharge_wallet(amount numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  if amount <= 0 then
    return false;
  end if;

  update public.agency_wallet
  set balance = balance + amount,
      total_recharged = total_recharged + amount,
      updated_at = now()
  where id = 1;

  return true;
end;
$$;

-- Permissions : tout authentifie peut appeler ces fonctions
grant execute on function public.try_charge_va(uuid, numeric) to authenticated;
grant execute on function public.refund_va(uuid, numeric) to authenticated;
grant execute on function public.recharge_wallet(numeric) to authenticated;
