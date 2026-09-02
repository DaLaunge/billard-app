-- Doppel-Matches (8/9/10 Ball, Doppel-Modus) bekommen wie report_match()
-- jetzt einen p_run_log-Parameter fuer das simple Punktestand-Protokoll
-- (Array von [s1, s2]-Paaren, ein Eintrag pro Zaehler-Klick). Die Spalte
-- matches.run_log gibt es bereits (siehe 2026-09-02_141_run_log.sql).
--
-- WICHTIG (Lehre aus dem report_match()-Vorfall): "create or replace
-- function" ersetzt eine Funktion nur, wenn die Parameter-TYPLISTE exakt
-- gleich bleibt. Ein zusaetzlicher Parameter aendert die Signatur, wodurch
-- Postgres eine zweite, ueberladene Funktion anlegen wuerde statt zu
-- ersetzen - das hatte zuvor "Could not choose the best candidate
-- function" ausgeloest. Diese Migration loescht daher die alte
-- 6-Parameter-Version EXPLIZIT, bevor die neue (7-Parameter) angelegt wird.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

drop function if exists public.report_doubles(uuid, uuid, uuid, integer, integer, text);

create or replace function public.report_doubles(
  p_partner_id uuid, p_opp1_id uuid, p_opp2_id uuid,
  p_my_score integer, p_opp_score integer, p_discipline text,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me  uuid := current_player_id();
  v_row matches;
  ids   uuid[];
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  ids := array[v_me, p_partner_id, p_opp1_id, p_opp2_id];
  -- alle vier verschieden?
  if (select count(distinct x) from unnest(ids) x) <> 4 then
    raise exception 'Für ein Doppel braucht es vier verschiedene Spieler.';
  end if;
  if exists (select 1 from players where id = any(ids) and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann bei einem Doppel nicht mitspielen.';
  end if;
  if exists (select 1 from unnest(ids) x where not exists (select 1 from players where id = x)) then
    raise exception 'Ein Spieler wurde nicht gefunden.';
  end if;
  if p_my_score = p_opp_score then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  insert into matches (player1_id, player1b_id, player2_id, player2b_id,
                       score1, score2, discipline, reported_by, confirmed, run_log)
  values (v_me, p_partner_id, p_opp1_id, p_opp2_id,
          p_my_score, p_opp_score, trim(p_discipline), v_me, false, p_run_log)
  returning * into v_row;

  -- die drei anderen müssen bestätigen
  insert into match_confirmations (match_id, player_id) values
    (v_row.id, p_partner_id), (v_row.id, p_opp1_id), (v_row.id, p_opp2_id);

  return v_row;
end;
$function$;
