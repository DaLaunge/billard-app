-- Gaeste ohne Konto tragen in Winner-Stays-Runden das Ergebnis ihres Spiels selbst ein (Nutzer-Wunsch 2026-10-27, Ergaenzung zu
-- 2026-10-30b_winner_stays_invite.sql). Wer am Tisch steht (Platz 0 oder 1), darf mit seinem Token das Ergebnis melden - wie es Mitglieder am
-- Tisch schon duerfen. Die bestehende winner_stays_report_game() bleibt UNVERAENDERT; ihr Ablauf (Sieger bleibt, Verlierer ans Ende, pausierte
-- ueberspringen) steht hier als interne Kopie, die statt current_player_id() die geprueften Spieler-id bekommt.
--
-- Test, dann Produktion. Idempotent. Als GANZE Datei ausfuehren.

create or replace function public.winner_stays_report_game_core(p_session_id uuid, p_score_a integer, p_score_b integer, p_actor uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sess winner_stays_sessions;
  v_a winner_stays_entries;
  v_b winner_stays_entries;
  v_winner winner_stays_entries;
  v_loser winner_stays_entries;
  v_game_no int;
  v_count int;
begin
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_a from winner_stays_entries where session_id = p_session_id and queue_position = 0;
  select * into v_b from winner_stays_entries where session_id = p_session_id and queue_position = 1;
  if v_a.id is null or v_b.id is null then
    raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde sein.';
  end if;
  if p_actor not in (v_a.player1_id, v_a.player2_id, v_b.player1_id, v_b.player2_id) then
    raise exception 'Nur die gerade am Tisch stehenden Spieler können Ergebnisse eintragen.';
  end if;
  if p_score_a = p_score_b then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  if p_score_a > p_score_b then v_winner := v_a; v_loser := v_b;
  else v_winner := v_b; v_loser := v_a; end if;

  select coalesce(max(game_no), 0) + 1 into v_game_no from winner_stays_games where session_id = p_session_id;

  insert into winner_stays_games (session_id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, reported_by)
  values (p_session_id, v_game_no, v_a.id, v_b.id, p_score_a, p_score_b, v_winner.id, p_actor);

  update winner_stays_entries set wins = wins + 1, games = games + 1, streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
    where id = v_winner.id;
  update winner_stays_entries set losses = losses + 1, games = games + 1, streak = 0
    where id = v_loser.id;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count > 2 then
    update winner_stays_entries set queue_position = -1 where id = v_loser.id;
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_loser.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_loser.id;
  end if;

  perform winner_stays_skip_paused(p_session_id);
end;
$function$;

-- Der Gast meldet sein Spiel: p_my_score = meine Punkte, p_opp_score = die des Gegners (die Zuordnung zu Platz 0/1 macht der Server).
create or replace function public.guest_ws_report_game(p_token text, p_my_score integer, p_opp_score integer)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tok winner_stays_guest_tokens;
  v_me winner_stays_entries;
begin
  select * into v_tok from winner_stays_guest_tokens where token = p_token;
  if not found then raise exception 'Ungültiger Gast-Zugang.'; end if;
  if p_my_score is null or p_opp_score is null or p_my_score < 0 or p_opp_score < 0 then raise exception 'Ungültiges Ergebnis.'; end if;
  select * into v_me from winner_stays_entries where session_id = v_tok.session_id and player1_id = v_tok.player_id;
  if not found or v_me.queue_position > 1 then raise exception 'Du stehst gerade nicht am Tisch.'; end if;
  if v_me.queue_position = 0 then
    perform winner_stays_report_game_core(v_tok.session_id, p_my_score, p_opp_score, v_tok.player_id);
  else
    perform winner_stays_report_game_core(v_tok.session_id, p_opp_score, p_my_score, v_tok.player_id);
  end if;
end;
$function$;

revoke all on function public.winner_stays_report_game_core(uuid, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.guest_ws_report_game(text, integer, integer) from public;
grant execute on function public.guest_ws_report_game(text, integer, integer) to anon, authenticated;

select proname from pg_proc where proname in ('winner_stays_report_game_core', 'guest_ws_report_game');
