-- =============================================
-- OniSMS — migration 004 : scoring base historique
-- =============================================

-- Fonction : calcule le taux de reussite d'un fournisseur sur une periode
-- success = status 'finished' (code recu ET valide par l'utilisateur)
-- echec = 'timeout' OU 'canceled' apres au moins 1 min (assume code jamais arrive)
-- en cours / annule rapide : exclu (pas concluant)
create or replace function public.get_provider_success_rate(
  p_provider text,
  p_country text,
  p_service text,
  p_days int default 7
)
returns table (
  success_rate numeric,
  total_attempts bigint,
  successes bigint,
  failures bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with relevant as (
    select status, created_at, finished_at
    from public.sms_orders
    where provider = p_provider
      and country = p_country
      and service = p_service
      and status in ('finished', 'canceled', 'timeout', 'banned')
      and created_at > now() - (p_days || ' days')::interval
      -- Exclut les annulations < 60s (pas concluant : on n'a pas attendu le SMS)
      and not (status = 'canceled' and finished_at is not null
               and extract(epoch from (finished_at - created_at)) < 60)
  ),
  agg as (
    select
      count(*) filter (where status = 'finished') as ok,
      count(*) filter (where status in ('canceled', 'timeout', 'banned')) as ko,
      count(*) as total
    from relevant
  )
  select
    case when total = 0 then null::numeric
         else round(100.0 * ok::numeric / total, 1)
    end as success_rate,
    total as total_attempts,
    ok as successes,
    ko as failures
  from agg;
$$;

-- Vue : stats globales par provider/country/service sur les 7 derniers jours
create or replace view public.provider_stats_7d as
select
  provider,
  country,
  service,
  count(*) filter (where status = 'finished') as successes,
  count(*) filter (where status in ('canceled', 'timeout', 'banned')
                   and not (status = 'canceled' and finished_at is not null
                            and extract(epoch from (finished_at - created_at)) < 60)
  ) as failures,
  count(*) filter (where status in ('finished', 'canceled', 'timeout', 'banned')
                   and not (status = 'canceled' and finished_at is not null
                            and extract(epoch from (finished_at - created_at)) < 60)
  ) as total_concluant,
  case
    when count(*) filter (where status in ('finished', 'canceled', 'timeout', 'banned')
                          and not (status = 'canceled' and finished_at is not null
                                   and extract(epoch from (finished_at - created_at)) < 60)
    ) = 0 then null
    else round(100.0 * count(*) filter (where status = 'finished')::numeric
              / count(*) filter (where status in ('finished', 'canceled', 'timeout', 'banned')
                                 and not (status = 'canceled' and finished_at is not null
                                          and extract(epoch from (finished_at - created_at)) < 60)
              ), 1)
  end as success_rate
from public.sms_orders
where created_at > now() - interval '7 days'
group by provider, country, service;

grant execute on function public.get_provider_success_rate(text, text, text, int) to authenticated;
grant select on public.provider_stats_7d to authenticated;
