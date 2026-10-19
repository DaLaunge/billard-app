-- Startseite = einer der (frei waehlbaren) Menuepunkte der Leiste (Nutzer-Wunsch 2026-10-21): die Auswahl in den Einstellungen zeigt die
-- Menueleiste des Spielers als Grafik und er tippt an, welcher der 4 Punkte beim Start oeffnet - "last" (zuletzt geoeffnete Seite) bleibt als
-- Schalter. Dafuer darf players.start_tab jetzt jeden Seiten-Schluessel eines Menuepunkts enthalten (bisher nur rang/live/stats/profil/last -
-- "turnier" wurde vom CHECK sogar abgelehnt). Neue erlaubte Werte: turnier, erfolge, zahlen, invite, clubs, regeln.
--
-- Test, dann Produktion. Idempotent.

alter table public.players drop constraint if exists players_start_tab_check;
alter table public.players
  add constraint players_start_tab_check
  check (start_tab in ('rang', 'live', 'stats', 'profil', 'last', 'turnier', 'erfolge', 'zahlen', 'invite', 'clubs', 'regeln'));

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
  if p_start_tab not in ('rang', 'live', 'stats', 'profil', 'last', 'turnier', 'erfolge', 'zahlen', 'invite', 'clubs', 'regeln') then
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
