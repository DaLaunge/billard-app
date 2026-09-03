-- Ergaenzt die Startseiten-Auswahl (siehe 2026-09-03_start_tab_preference.sql)
-- um die Option "last": statt eines fixen Menuepunkts wird beim App-Start
-- der zuletzt geoeffnete Hauptmenuepunkt gezeigt (auf dem Geraet in
-- localStorage gemerkt, siehe src/App.jsx).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

alter table public.players
  drop constraint if exists players_start_tab_check;
alter table public.players
  add constraint players_start_tab_check
  check (start_tab in ('rang', 'live', 'stats', 'profil', 'last'));

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
  if p_start_tab not in ('rang', 'live', 'stats', 'profil', 'last') then
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
