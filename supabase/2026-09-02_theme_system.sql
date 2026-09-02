-- Farbthemen: jeder Spieler kann ein Farbthema fuer sich selbst waehlen
-- (7 vordefinierte + ein frei kombinierbares aus zwei Akzentfarben).
-- Gespeichert direkt am Spieler-Datensatz, damit die Wahl geraeteuebergreifend
-- erhalten bleibt (nicht nur lokal im Browser).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

alter table public.players
  add column if not exists theme_key text not null default 'green',
  add column if not exists theme_custom jsonb;

alter table public.players
  drop constraint if exists players_theme_key_check;
alter table public.players
  add constraint players_theme_key_check
  check (theme_key in ('green', 'black', 'red', 'blue', 'purple', 'brown', 'teal', 'custom'));

-- Setzt das Farbthema des eingeloggten Spielers. p_theme_custom wird nur
-- bei p_theme_key = 'custom' gespeichert (sonst immer null, damit kein
-- veraltetes Eigenes-Thema-Wertepaar stehen bleibt, wenn spaeter wieder
-- auf ein vordefiniertes Thema gewechselt wird).
create or replace function public.set_theme(p_theme_key text, p_theme_custom jsonb default null)
returns players
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me  uuid := current_player_id();
  v_row players;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if p_theme_key not in ('green', 'black', 'red', 'blue', 'purple', 'brown', 'teal', 'custom') then
    raise exception 'Unbekanntes Farbthema.';
  end if;

  update players
     set theme_key    = p_theme_key,
         theme_custom = case when p_theme_key = 'custom' then p_theme_custom else null end
   where id = v_me
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.set_theme(text, jsonb) to authenticated;
