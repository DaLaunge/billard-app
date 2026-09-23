-- App-Version pro Spieler + erzwingbare Mindestversion.
--
-- 1) players.app_version / app_version_at: welche Version (APP_VERSION aus
--    src/lib/constants.js) ein Spieler zuletzt benutzt hat und wann. Hat
--    jemand mehrere Geraete, steht hier das zuletzt benutzte.
-- 2) app_settings.min_app_version: aeltere Versionen (ab der Version, die
--    diese Pruefung enthaelt) zeigen "Update wird geladen" und aktualisieren
--    sich sofort - ausser mitten in einer Match-/Winner-Stays-Eingabe, dort
--    erst beim Verlassen.
--
-- Beides laeuft ueber EINEN kleinen RPC-Aufruf beim App-Start bzw. beim
-- Zurueckholen der App (report_app_version) - geschrieben wird nur, wenn sich
-- die Version geaendert hat oder der letzte Eintrag aelter als ein Tag ist.
--
-- Mindestversion setzen (NUR auf eine Version, die schon deployt ist -
-- sonst sucht jede App vergeblich nach einem Update und bleibt gesperrt,
-- bis der Wert wieder gesenkt wird):
--   update app_settings set min_app_version = 380;
-- Wer ist noch auf welcher Version:
--   select nickname, app_version, app_version_at from players
--   where app_version_at is not null order by app_version, app_version_at desc;
--
-- In Test UND Produktion ausfuehren. Idempotent.

create table if not exists public.app_settings (
  id boolean primary key default true check (id),   -- genau eine Zeile
  min_app_version integer not null default 0
);
insert into public.app_settings (id) values (true) on conflict do nothing;
-- RLS an, keine Policies: gelesen wird nur ueber report_app_version(),
-- geaendert nur im SQL-Editor.
alter table public.app_settings enable row level security;

alter table public.players
  add column if not exists app_version integer,
  add column if not exists app_version_at timestamptz;

create or replace function public.report_app_version(p_version integer)
returns integer
language plpgsql security definer set search_path to 'public' as $function$
begin
  update players set app_version = p_version, app_version_at = now()
   where auth_user_id = auth.uid()
     and (app_version is distinct from p_version
          or app_version_at is null or app_version_at < now() - interval '1 day');
  return (select min_app_version from app_settings where id);
end;
$function$;

revoke all on function public.report_app_version(integer) from public, anon;
grant execute on function public.report_app_version(integer) to authenticated;
