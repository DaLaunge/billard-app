-- Heyball (WPA Rules of Heyball, 2025-08-16) als neue Disziplin mit Admin-Schalter.
--
-- Die Disziplin braucht serverseitig nichts Besonderes: matches.discipline und die Rating-Engine
-- (rebuild_elo / elo_anchor_rows) behandeln jede Disziplin als Text, es gibt keine CHECK-Liste.
-- Neu ist nur der Schalter: app_settings.heyball_enabled (Standard: AUS), von allen eingeloggten
-- Nutzern lesbar ueber get_feature_flags(), geaendert nur von Admins ueber admin_set_heyball().
-- Ausgeschaltet verschwindet Heyball in der App aus Match, Turnier, Filtern und Regelkunde;
-- bereits gespielte Heyball-Matches bleiben unberuehrt.
--
-- In Test UND Produktion ausfuehren (ganze Datei). Idempotent.

alter table public.app_settings
  add column if not exists heyball_enabled boolean not null default false;

create or replace function public.get_feature_flags()
returns jsonb
language sql stable security definer set search_path to 'public' as $function$
  select jsonb_build_object('heyball', coalesce((select heyball_enabled from app_settings where id), false));
$function$;

revoke all on function public.get_feature_flags() from public, anon;
grant execute on function public.get_feature_flags() to authenticated;

create or replace function public.admin_set_heyball(p_enabled boolean)
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  update app_settings set heyball_enabled = coalesce(p_enabled, false) where id;
end;
$function$;

revoke all on function public.admin_set_heyball(boolean) from public, anon;
grant execute on function public.admin_set_heyball(boolean) to authenticated;
