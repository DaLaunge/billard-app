-- Bug: tournament_organizer_report_match() fuegte "matches" gleich MIT
-- confirmed = true ein. Der Trigger trg_advance_tournament feuert dabei
-- SOFORT beim INSERT - zu diesem Zeitpunkt war tournament_matches.match_id
-- aber noch gar nicht auf die neue Zeile verlinkt (das passiert erst im
-- naechsten Statement der Funktion), also findet advance_tournament_bracket()
-- keine passende tournament_matches-Zeile und tut nichts. Ergebnis: von der
-- Turnierleitung eingetragene Matches ruecken das Raster nie vor - nur
-- normal von Spielern gemeldete + spaeter bestaetigte Matches funktionierten
-- (dort ist match_id bereits laengst verlinkt, wenn confirm_match() die
-- separate UPDATE-Anweisung macht, die den Trigger auslöst).
--
-- Fix: erst mit confirmed = false einfuegen, DANN tournament_matches.match_id
-- verlinken, DANN erst per eigenem UPDATE auf confirmed = true setzen - der
-- Trigger feuert dann ein zweites Mal, findet die (jetzt verlinkte)
-- tournament_matches-Zeile und rueckt korrekt vor.
--
-- Zusaetzlich: einmalige Reparatur fuer bereits betroffene, live vom Bug
-- getroffene Turniermatches (bestaetigt aber tournament_matches.winner_id
-- noch leer) - wendet dieselbe Logik wie advance_tournament_bracket() einmal
-- nachtraeglich an.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.tournament_organizer_report_match(
  p_tournament_match_id uuid, p_score1 integer, p_score2 integer
) returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_row matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.is_bye then raise exception 'Dieses Match ist ein Freilos.'; end if;
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then
    raise exception 'Die Paarung für dieses Match steht noch nicht fest.';
  end if;
  if p_score1 = p_score2 then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann hier ein Ergebnis eintragen.';
  end if;
  if v_me in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Als Spieler dieses Matches kannst du das Ergebnis nicht selbst als Turnierleitung eintragen.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht mehr aktiv.'; end if;

  -- Erst OHNE confirmed=true einfuegen (der Trigger feuert hier, tut aber
  -- mangels confirmed=true nichts), dann tournament_matches verlinken,
  -- DANACH erst bestaetigen - siehe Kommentar oben.
  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id)
  values (v_tm.player1_id, v_tm.player2_id, p_score1, p_score2, v_tour.discipline, v_me, false, v_tour.id)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;

  update matches set confirmed = true, confirmed_by = v_me where id = v_row.id
    returning * into v_row;

  return v_row;
end;
$function$;

-- Einmalige Reparatur bereits betroffener Turniermatches: bestaetigt, aber
-- vom Trigger nie verarbeitet (winner_id fehlt noch). Dieselbe Logik wie
-- advance_tournament_bracket(), einmal manuell nachgeholt.
do $$
declare
  r record;
  v_winner uuid;
  v_loser uuid;
  v_tour record;
begin
  for r in
    select tm.id, tm.tournament_id, tm.next_match_id, tm.next_slot, tm.loser_next_match_id, tm.loser_next_slot,
           m.player1_id, m.player2_id, m.score1, m.score2
    from tournament_matches tm
    join matches m on m.id = tm.match_id
    where m.confirmed = true and tm.winner_id is null
    order by tm.round
  loop
    v_winner := case when r.score1 > r.score2 then r.player1_id else r.player2_id end;
    v_loser := case when r.score1 > r.score2 then r.player2_id else r.player1_id end;

    update tournament_matches set winner_id = v_winner where id = r.id;

    if r.next_match_id is not null then
      if r.next_slot = 1 then
        update tournament_matches set player1_id = v_winner where id = r.next_match_id;
      else
        update tournament_matches set player2_id = v_winner where id = r.next_match_id;
      end if;
    end if;

    if r.loser_next_match_id is not null then
      if r.loser_next_slot = 1 then
        update tournament_matches set player1_id = v_loser where id = r.loser_next_match_id;
      else
        update tournament_matches set player2_id = v_loser where id = r.loser_next_match_id;
      end if;
    end if;

    select * into v_tour from tournaments where id = r.tournament_id;
    if v_tour.format = 'round_robin' then
      if not exists (select 1 from tournament_matches where tournament_id = v_tour.id and winner_id is null) then
        update tournaments set status = 'finished', finished_at = now() where id = v_tour.id;
      end if;
    else
      if not exists (
        select 1 from tournament_matches
        where tournament_id = v_tour.id and next_match_id is null and loser_next_match_id is null and winner_id is null
      ) then
        update tournaments set status = 'finished', finished_at = now() where id = v_tour.id;
      end if;
    end if;
  end loop;
end $$;
