-- Admin kann einen Spieler UNWIDERRUFLICH samt kompletter Historie löschen -
-- anders als self_delete_account() (das die Matches anonymisiert bestehen
-- lässt, damit die Statistik der Gegner stimmt), räumt diese Funktion
-- wirklich alles weg, was dem Spieler gehört. Gedacht für Test-/Wegwerf-
-- Accounts beim Durchtesten von Login/Logout - NICHT für echte Mitglieder
-- mit Match-Historie, weil das die Ranglisten/Statistik anderer Spieler
-- verfälscht (deren gemeinsame Matches verschwinden mit).
--
-- Sicherheitsnetz: läuft komplett in einer Transaktion (Funktionsaufruf) -
-- schlägt irgendwo ein Foreign-Key-Constraint fehl, wird die gesamte
-- Löschung zurückgerollt, nichts bleibt halb gelöscht.
create or replace function admin_delete_player(p_player uuid, p_confirm_nickname text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_auth_id uuid;
  v_nickname text;
  v_is_ghost boolean;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;

  select nickname::text, auth_user_id, coalesce(is_ghost, false)
    into v_nickname, v_auth_id, v_is_ghost
    from players where id = p_player;
  if v_nickname is null then raise exception 'Spieler nicht gefunden.'; end if;
  if v_is_ghost then raise exception 'Der Ghost-Spieler kann nicht gelöscht werden.'; end if;
  if p_player = current_player_id() then raise exception 'Du kannst dich nicht selbst löschen - nutze dafür "Meine Daten löschen" im eigenen Profil.'; end if;
  if p_confirm_nickname is distinct from v_nickname then
    raise exception 'Spielername stimmt nicht überein - Löschung abgebrochen.';
  end if;
  if exists (select 1 from tournaments where organizer_id = p_player) then
    raise exception 'Dieser Spieler hat Turniere organisiert - zuerst Turnierleitung übertragen oder das Turnier löschen.';
  end if;

  -- Turnierbaum: next_match_id/loser_next_match_id zeigen innerhalb
  -- derselben Tabelle aufeinander - erst entkoppeln, dann loeschen.
  update tournament_matches set next_match_id = null
    where next_match_id in (select id from tournament_matches where player1_id = p_player or player2_id = p_player or winner_id = p_player);
  update tournament_matches set loser_next_match_id = null
    where loser_next_match_id in (select id from tournament_matches where player1_id = p_player or player2_id = p_player or winner_id = p_player);
  update tournament_matches set match_id = null
    where match_id in (select id from matches where player1_id = p_player or player2_id = p_player or player1b_id = p_player or player2b_id = p_player);
  delete from tournament_matches where player1_id = p_player or player2_id = p_player or winner_id = p_player;
  delete from tournament_players where player_id = p_player;

  -- Matches: nur echte Teilnahme (auch als Doppelpartner) loescht die
  -- Zeile. reported_by/confirmed_by sind nur Metadaten (wer hat's
  -- eingetragen/bestaetigt) - da wird nur der Verweis entfernt, damit
  -- fremde Matches (wo dieser Spieler bloss als Admin eingetragen hat)
  -- erhalten bleiben.
  update matches set reported_by = null where reported_by = p_player;
  update matches set confirmed_by = null where confirmed_by = p_player;
  update challenges set resolved_match_id = null
    where resolved_match_id in (select id from matches where player1_id = p_player or player2_id = p_player or player1b_id = p_player or player2b_id = p_player);
  delete from match_confirmations where match_id in (select id from matches where player1_id = p_player or player2_id = p_player or player1b_id = p_player or player2b_id = p_player);
  delete from matches where player1_id = p_player or player2_id = p_player or player1b_id = p_player or player2b_id = p_player;

  delete from challenges where challenger_id = p_player or challenged_id = p_player;
  delete from player_badges where player_id = p_player;
  delete from ratings where player_id = p_player;
  delete from rating_snapshots where player_id = p_player;
  delete from elo_anchors where player_id = p_player;
  delete from ghost_games where player_id = p_player;
  delete from ping_replies where player_id = p_player or ping_id in (select id from pings where player_id = p_player);
  delete from pings where player_id = p_player;
  delete from feedback_messages where sender_id = p_player;
  update feedback set player_id = null where player_id = p_player;
  delete from invites where inviter_id = p_player;
  update invites set used_by = null where used_by = p_player;
  update players set invited_by = null where invited_by = p_player;

  delete from storage.objects where bucket_id = 'avatars' and v_auth_id is not null and (storage.foldername(name))[1] = v_auth_id::text;
  delete from players where id = p_player;
  if v_auth_id is not null then
    delete from auth.identities where user_id = v_auth_id;
    delete from auth.users where id = v_auth_id;
  end if;
end;
$$;

grant execute on function admin_delete_player(uuid, text) to authenticated;
