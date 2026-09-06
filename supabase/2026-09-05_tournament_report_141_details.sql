-- Turniermatches nutzen jetzt denselben MatchScreen-Flow wie normale
-- Matches (statt einer eigenen, einfachen Zahlen-Eingabe) - inklusive
-- vollem 14/1-Endlos-Rechner (Aufnahme-Protokoll, Hoechstserie, aufgeholter
-- Rueckstand, Offensivschnitt, Zwei-Kugel-Raeumungen). Die bisherigen
-- Turnier-Report-RPCs kannten aber nur Score1/Score2 - diese Zusatzdaten
-- gingen fuer Turniermatches bislang komplett verloren. Beide Funktionen
-- bekommen dieselben optionalen Parameter wie report_match().
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.tournament_report_match(
  p_tournament_match_id uuid, p_my_score integer, p_opp_score integer,
  p_high_run_me integer default null, p_high_run_opp integer default null,
  p_deficit_me integer default null, p_deficit_opp integer default null,
  p_avg_me numeric default null, p_avg_opp numeric default null,
  p_twoball_me integer default null, p_twoball_opp integer default null,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_opponent uuid;
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
  if v_me not in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Nur die beiden Spieler dieses Matches können das Ergebnis melden.';
  end if;
  if p_my_score = p_opp_score then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht mehr aktiv.'; end if;
  v_opponent := case when v_me = v_tm.player1_id then v_tm.player2_id else v_tm.player1_id end;

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id,
                       high_run1, high_run2, deficit1, deficit2, avg1, avg2, twoball1, twoball2, run_log)
  values (v_me, v_opponent, p_my_score, p_opp_score, v_tour.discipline, v_me, false, v_tour.id,
          p_high_run_me, p_high_run_opp, p_deficit_me, p_deficit_opp, p_avg_me, p_avg_opp, p_twoball_me, p_twoball_opp, p_run_log)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  return v_row;
end;
$function$;

create or replace function public.tournament_organizer_report_match(
  p_tournament_match_id uuid, p_score1 integer, p_score2 integer,
  p_high_run_me integer default null, p_high_run_opp integer default null,
  p_deficit_me integer default null, p_deficit_opp integer default null,
  p_avg_me numeric default null, p_avg_opp numeric default null,
  p_twoball_me integer default null, p_twoball_opp integer default null,
  p_run_log jsonb default null
)
 returns matches
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
  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id,
                       high_run1, high_run2, deficit1, deficit2, avg1, avg2, twoball1, twoball2, run_log)
  values (v_tm.player1_id, v_tm.player2_id, p_score1, p_score2, v_tour.discipline, v_me, false, v_tour.id,
          p_high_run_me, p_high_run_opp, p_deficit_me, p_deficit_opp, p_avg_me, p_avg_opp, p_twoball_me, p_twoball_opp, p_run_log)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;

  update matches set confirmed = true, confirmed_by = v_me where id = v_row.id
    returning * into v_row;

  return v_row;
end;
$function$;
