-- Volle Versionsnummer ("391.25") zusaetzlich zur ganzen Zahl melden.
--
-- Hintergrund: seit 2026-09-30 zaehlen Test-Staende "<letzte Prod-Nummer>.<Minor>"
-- (siehe CLAUDE.md, Abschnitt Workflow). players.app_version ist eine ganze
-- Zahl und bekommt nur die Prod-Basis (391) - ob ein Tester schon 391.25 oder
-- noch 391.20 hat, sah man im Admin deshalb nicht. Neu: app_version_full (Text).
--
-- Reihenfolge: zuerst im Test-Projekt einspielen, spaeter in Prod. Die App
-- funktioniert auch VOR dem Einspielen weiter (sie faellt auf den alten Aufruf
-- zurueck), zeigt dann aber im Admin nur die ganze Zahl.

alter table public.players
  add column if not exists app_version_full text;

-- Die alte Funktion nur mit p_version wird ersetzt: p_full ist optional
-- (default null), alte Aufrufe ohne p_full laufen unveraendert weiter.
drop function if exists public.report_app_version(integer);

create or replace function public.report_app_version(p_version integer, p_full text default null)
returns integer
language plpgsql security definer set search_path to 'public' as $function$
begin
  update players
     set app_version = p_version,
         app_version_full = coalesce(p_full, p_version::text),
         app_version_at = now()
   where auth_user_id = auth.uid()
     and (app_version is distinct from p_version
          or app_version_full is distinct from coalesce(p_full, p_version::text)
          or app_version_at is null or app_version_at < now() - interval '1 day');
  return (select min_app_version from app_settings where id);
end;
$function$;

revoke all on function public.report_app_version(integer, text) from public, anon;
grant execute on function public.report_app_version(integer, text) to authenticated;

-- Rueckgabetyp aendert sich (neue Spalte) -> erst droppen, dann neu anlegen.
drop function if exists public.admin_app_versions();

create or replace function public.admin_app_versions()
returns table(player_id uuid, nickname text, app_version integer, app_version_full text,
              app_version_at timestamp with time zone, min_app_version integer)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  return query
  select p.id, p.nickname::text, p.app_version, p.app_version_full, p.app_version_at,
         (select s.min_app_version from app_settings s where s.id)
  from players p
  where not coalesce(p.is_ghost, false) and not coalesce(p.is_guest, false)
  order by p.app_version nulls first, p.app_version_at desc nulls last, p.nickname;
end;
$function$;

revoke all on function public.admin_app_versions() from public, anon;
grant execute on function public.admin_app_versions() to authenticated;
