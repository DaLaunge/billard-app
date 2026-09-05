-- Drei zusaetzliche Rechte fuer die Turnierleitung (Organisator eines
-- konkreten Turniers, oder Admin - gleiches Sicherheitsmodell wie
-- tournament_force_confirm_match in 2026-09-04_tournament_mode.sql):
--
-- 1) tournament_organizer_report_match: Ergebnis direkt eintragen (z.B. wenn
--    die Turnierleitung waehrend des Events selbst mitschreibt statt dass
--    beide Spieler es je am eigenen Handy melden). Gilt sofort als
--    bestaetigt (wie admin_add_match) - NICHT erlaubt, wenn die Turnier-
--    leitung selbst einer der beiden Spieler ist (Interessenkonflikt, wie
--    bei tournament_force_confirm_match).
-- 2) tournament_end_early: Turnier vorzeitig auf "finished" setzen. Bereits
--    gemeldete/bestaetigte Matches behalten ihre tournament_id und zaehlen
--    unveraendert als Turnierspiel zur Elo/Rangliste - hier wird nur der
--    Turnier-Status geaendert, an "matches" wird nichts angefasst.
-- 3) tournament_delete: Turnier komplett loeschen (cascade auf
--    tournament_players/tournament_matches) - nur solange noch KEIN
--    einziges Match gemeldet wurde (kein tournament_matches-Eintrag mit
--    gesetzter match_id). Sobald gespielt wurde, ist das Turnier nur noch
--    per tournament_end_early vorzeitig beendbar, nicht mehr loeschbar.
--
-- Ausserdem: tournament_report_match bekommt eine fehlende Pruefung nach-
-- getragen (Turnier muss noch "running" sein) - bisher konnte theoretisch
-- auch nach einem vorzeitigen Ende noch ein Ergebnis gemeldet werden.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.tournament_report_match(
  p_tournament_match_id uuid, p_my_score integer, p_opp_score integer
) returns matches
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

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id)
  values (v_me, v_opponent, p_my_score, p_opp_score, v_tour.discipline, v_me, false, v_tour.id)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  return v_row;
end;
$function$;

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

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, confirmed_by, tournament_id)
  values (v_tm.player1_id, v_tm.player2_id, p_score1, p_score2, v_tour.discipline, v_me, true, v_me, v_tour.id)
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  return v_row;
end;
$function$;

create or replace function public.tournament_end_early(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann dieses Turnier beenden.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier läuft nicht (mehr).'; end if;
  update tournaments set status = 'finished', finished_at = now() where id = p_tournament_id;
end;
$function$;

create or replace function public.tournament_delete(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann dieses Turnier löschen.';
  end if;
  if exists (select 1 from tournament_matches where tournament_id = p_tournament_id and match_id is not null) then
    raise exception 'Turnier kann nicht gelöscht werden - es wurde bereits mindestens ein Spiel gemeldet. Stattdessen vorzeitig beenden.';
  end if;
  delete from tournaments where id = p_tournament_id;
end;
$function$;
