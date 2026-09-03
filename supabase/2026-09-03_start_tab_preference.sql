-- Startseite: jeder Spieler kann waehlen, welcher Menuepunkt beim Starten
-- der App zuerst angezeigt wird (Uebersicht/Live/Statistik/Profil).
-- Gespeichert direkt am Spieler-Datensatz, analog zu theme_key
-- (siehe 2026-09-02_theme_system.sql), damit die Wahl geraeteuebergreifend
-- erhalten bleibt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

alter table public.players
  add column if not exists start_tab text not null default 'rang';

alter table public.players
  drop constraint if exists players_start_tab_check;
alter table public.players
  add constraint players_start_tab_check
  check (start_tab in ('rang', 'live', 'stats', 'profil'));

-- Setzt die Startseite des eingeloggten Spielers.
create or replace function public.set_start_tab(p_start_tab text)
returns players
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me  uuid := current_player_id();
  v_row players;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if p_start_tab not in ('rang', 'live', 'stats', 'profil') then
    raise exception 'Unbekannte Startseite.';
  end if;

  update players
     set start_tab = p_start_tab
   where id = v_me
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.set_start_tab(text) to authenticated;
