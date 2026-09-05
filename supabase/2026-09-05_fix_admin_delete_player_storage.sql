-- Bugfix: admin_delete_player() versuchte direkt "delete from
-- storage.objects", was Supabase serverseitig grundsätzlich verbietet
-- ("Direct deletion from storage tables is not allowed. Use the Storage
-- API instead.", SQLSTATE 42501/insufficient_privilege) - live beim
-- Testlöschen von RaphiTest bestätigt. Da die ganze Funktion eine
-- Transaktion ist, brach das die komplette Löschung ab (kein Datenverlust,
-- aber auch keine Löschung). Fängt den Fehler jetzt gezielt ab: verwaiste
-- Avatar-Dateien bleiben liegen (kosmetischer Nebeneffekt), der Rest der
-- Löschung läuft trotzdem durch.
--
-- Derselbe DELETE steckt unveraendert auch in self_delete_account() (siehe
-- Migration von vor 2026-09) - vermutlich seit derselben Supabase-
-- Plattformänderung ebenfalls kaputt für jeden Nutzer mit hochgeladenem
-- Avatarfoto. Nicht Teil dieser Migration, weil out of scope für "Spieler
-- löschen" - separat pruefen/fixen.
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

  update tournament_matches set next_match_id = null
    where next_match_id in (select id from tournament_matches where player1_id = p_player or player2_id = p_player or winner_id = p_player);
  update tournament_matches set loser_next_match_id = null
    where loser_next_match_id in (select id from tournament_matches where player1_id = p_player or player2_id = p_player or winner_id = p_player);
  update tournament_matches set match_id = null
    where match_id in (select id from matches where player1_id = p_player or player2_id = p_player or player1b_id = p_player or player2b_id = p_player);
  delete from tournament_matches where player1_id = p_player or player2_id = p_player or winner_id = p_player;
  delete from tournament_players where player_id = p_player;

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

  begin
    delete from storage.objects where bucket_id = 'avatars' and v_auth_id is not null and (storage.foldername(name))[1] = v_auth_id::text;
  exception when insufficient_privilege then
    null; -- Supabase erlaubt kein direktes DELETE auf storage.objects; verwaiste Datei bleibt liegen
  end;

  delete from players where id = p_player;
  if v_auth_id is not null then
    delete from auth.identities where user_id = v_auth_id;
    delete from auth.users where id = v_auth_id;
  end if;
end;
$$;

grant execute on function admin_delete_player(uuid, text) to authenticated;
