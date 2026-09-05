-- Neue Faehigkeit: die Turnierleitung (oder ein Admin) kann ein BEREITS
-- bestaetigtes Turniermatch nachtraeglich korrigieren (z.B. Tippfehler im
-- Spielstand) - bisher gab es nur "erzwingen" (canForce/
-- tournament_force_confirm_match), das nur auf NOCH UNBESTAETIGTE Matches
-- wirkt.
--
-- Bewusst eingeschraenkt: eine Korrektur, die den SIEGER aendern wuerde,
-- wird abgelehnt. Der Turnierbaum haengt an tournament_matches.winner_id
-- (naechste Paarung/Verliererbaum-Zuordnung wird beim Bestaetigen ueber
-- den Trigger advance_tournament_bracket() gesetzt, siehe
-- 2026-09-04_tournament_mode.sql) - eine nachtraegliche Sieger-Umkehr
-- muesste diese gesamte Folge-Verkettung invalidieren/neu aufrollen, was
-- hier bewusst NICHT automatisiert wird (zu riskant fuer eine "kleine"
-- Korrekturfunktion). Reine Zahlendreher, die den Sieger nicht aendern,
-- bleiben moeglich.
--
-- matches_rebuild_ratings (AFTER INSERT OR DELETE OR UPDATE, siehe
-- 2026-09-03_fix_trigger_backfill_snapshots.sql) feuert bei JEDEM Update
-- auf matches, dh. Rating/Snapshots werden nach einer Korrektur automatisch
-- neu berechnet. advance_tournament_bracket() feuert dagegen nur bei
-- "UPDATE OF confirmed" - eine reine Score-Korrektur (confirmed bleibt
-- true) loest sie NICHT aus, was hier gewollt ist (winner_id/Baum bleiben
-- unangetastet, da der Sieger sich ja per Definition nicht aendert).
--
-- Nicht editierte 14/1-Zusatzfelder (Hoechstserie usw., NULL uebergeben)
-- bleiben unveraendert (coalesce gegen den bisherigen Wert) - die simple
-- Korrektur-UI bearbeitet nur den Spielstand, nicht das 14/1-Protokoll.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.tournament_organizer_edit_match(
  p_tournament_match_id uuid, p_score1 integer, p_score2 integer,
  p_high_run1 integer default null, p_high_run2 integer default null,
  p_deficit1 integer default null, p_deficit2 integer default null,
  p_avg1 numeric default null, p_avg2 numeric default null,
  p_twoball1 integer default null, p_twoball2 integer default null,
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
  v_match matches;
  v_new_winner uuid;
  v_ms1 integer; v_ms2 integer;
  v_hr1 integer; v_hr2 integer; v_d1 integer; v_d2 integer;
  v_a1 numeric; v_a2 numeric; v_tb1 integer; v_tb2 integer;
  v_row matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.match_id is null then raise exception 'Für dieses Match wurde noch kein Ergebnis gemeldet.'; end if;
  select * into v_match from matches where id = v_tm.match_id;
  if not v_match.confirmed then
    raise exception 'Dieses Match ist noch nicht bestätigt - dafür gibt es die normale Bestätigung/das Erzwingen.';
  end if;
  if p_score1 = p_score2 then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann ein bestätigtes Ergebnis korrigieren.';
  end if;
  if v_me in (v_tm.player1_id, v_tm.player2_id) then
    raise exception 'Als Spieler dieses Matches kannst du das Ergebnis nicht selbst korrigieren.';
  end if;

  -- p_score1/p_score2 (und die 14/1-Zusatzfelder) kommen in der Reihenfolge
  -- von tournament_matches.player1_id/player2_id - die matches-Zeile kann
  -- aber, je nachdem wer urspruenglich gemeldet hat, in umgekehrter
  -- Reihenfolge liegen (tournament_report_match traegt den Melder immer
  -- als player1 ein, unabhaengig von seiner Rolle in tournament_matches).
  if v_match.player1_id = v_tm.player1_id then
    v_ms1 := p_score1; v_ms2 := p_score2;
    v_hr1 := p_high_run1; v_hr2 := p_high_run2; v_d1 := p_deficit1; v_d2 := p_deficit2;
    v_a1 := p_avg1; v_a2 := p_avg2; v_tb1 := p_twoball1; v_tb2 := p_twoball2;
  else
    v_ms1 := p_score2; v_ms2 := p_score1;
    v_hr1 := p_high_run2; v_hr2 := p_high_run1; v_d1 := p_deficit2; v_d2 := p_deficit1;
    v_a1 := p_avg2; v_a2 := p_avg1; v_tb1 := p_twoball2; v_tb2 := p_twoball1;
  end if;

  v_new_winner := case when v_ms1 > v_ms2 then v_match.player1_id else v_match.player2_id end;
  if v_tm.winner_id is not null and v_new_winner <> v_tm.winner_id then
    raise exception 'Eine Korrektur, die den Sieger ändern würde, ist hier nicht möglich (könnte den weiteren Turnierverlauf ungültig machen).';
  end if;

  update matches set score1 = v_ms1, score2 = v_ms2,
    high_run1 = coalesce(v_hr1, high_run1), high_run2 = coalesce(v_hr2, high_run2),
    deficit1 = coalesce(v_d1, deficit1), deficit2 = coalesce(v_d2, deficit2),
    avg1 = coalesce(v_a1, avg1), avg2 = coalesce(v_a2, avg2),
    twoball1 = coalesce(v_tb1, twoball1), twoball2 = coalesce(v_tb2, twoball2),
    run_log = coalesce(p_run_log, run_log),
    confirmed_by = v_me
  where id = v_tm.match_id
  returning * into v_row;

  return v_row;
end;
$function$;
