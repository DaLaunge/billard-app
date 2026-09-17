-- Fortschrittsanzeige fuer Erfolgs-Kategorien, die NICHT aus den ohnehin
-- geladenen matches/players/challenges ableitbar sind: Ghost-Spiele (eigene
-- Tabelle ghost_games, RLS ohne Policies -> vom Client aus aktuell gar nicht
-- lesbar) und Turnierplatzierungen (Bracket-Aufloesung nur ueber die
-- serverseitige Funktion tournament_final_standings()). Bisher zeigten die
-- Kategorien MITGLIEDSCHAFT/GHOST/TURNIERE deshalb im Profil keinerlei
-- "das hast du schon erreicht"-Hinweis auf gesperrten Erfolgen, obwohl alle
-- anderen Kategorien das schon konnten (siehe Fortschrittsanzeige aus
-- Erfolge: Top-3-Ranking-Badges, Suche/Filter, Fortschrittsanzeige) - fuer
-- die Motivation ("1 Turnier gewonnen, noch 2 fuer 'Serienmeister'") war das
-- eine spuerbare Luecke laut Nutzer-Feedback.
--
-- Mitgliedschaft (created_at) ist bereits im Client bekannt und braucht
-- keine neue Abfrage.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.my_achievement_counters()
returns table(ghost_games int, tournament_wins int, tournament_2nd int, tournament_3rd int)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  return query
  select
    (select count(*)::int from ghost_games where player_id = v_me),
    (select count(*)::int from tournaments tour
       cross join lateral tournament_final_standings(tour.id) fs
       where tour.status = 'finished' and fs.placement = 1 and fs.player_id = v_me),
    (select count(*)::int from tournaments tour
       cross join lateral tournament_final_standings(tour.id) fs
       where tour.status = 'finished' and fs.placement = 2 and fs.player_id = v_me),
    (select count(*)::int from tournaments tour
       cross join lateral tournament_final_standings(tour.id) fs
       where tour.status = 'finished' and fs.placement = 3 and fs.player_id = v_me);
end;
$$;

grant execute on function public.my_achievement_counters() to authenticated;
