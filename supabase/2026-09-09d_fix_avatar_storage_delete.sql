-- Bugfix: sowohl admin_delete_player() als auch self_delete_account()
-- enthielten ein direktes "delete from storage.objects ...", um beim
-- Loeschen eines Kontos auch dessen Profilfoto zu entfernen. Supabase
-- blockiert das inzwischen fuer JEDE direkte SQL-Loeschung auf
-- storage.objects, unabhaengig von RLS/security definer:
-- "Direct deletion from storage tables is not allowed. Use the Storage API
-- instead." - dadurch schlug die komplette Spieler-/Konto-Loeschung fehl
-- (eine Transaktion, ein Fehler = alles zurueckgerollt), nicht nur bei
-- Winner-Stays-Teilnehmern, sondern bei JEDEM Spieler mit Login. Entdeckt
-- beim Aufraeumen der Winner-Stays-Testspieler.
--
-- Nebenbefund: admin_delete_player() hatte ausserdem das falsche Dateimuster
-- ("(storage.foldername(name))[1] = auth_user_id") - das tatsaechliche Muster
-- ist "<player_id>.jpg" (siehe set_avatar_photo()/2026-08-29_avatar_photo.sql),
-- die Zeile haette also ohnehin nie das richtige Foto getroffen.
--
-- Fix: die Foto-Loeschung raus aus SQL, stattdessen ruft der Client VOR dem
-- RPC-Aufruf die Storage-API auf (supabase.storage.from('avatars').remove(...)),
-- die intern nicht blockiert ist. Fuers Admin-Loeschen (fremdes Konto)
-- braucht es dafuer eine eigene Policy, da "avatar_delete_own" nur das
-- eigene Foto erlaubt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

drop policy if exists "avatar_delete_admin" on storage.objects;
create policy "avatar_delete_admin" on storage.objects
  for delete using (
    bucket_id = 'avatars' and is_admin()
  );

create or replace function public.self_delete_account()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_auth_id uuid;
begin
  select id, auth_user_id into v_me, v_auth_id from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;

  -- Eigene, rein persoenliche Daten vollstaendig entfernen. Das Profilfoto
  -- entfernt der Client VOR diesem Aufruf ueber die Storage-API (siehe
  -- App.jsx deleteAccount()) - ein direktes SQL-DELETE auf storage.objects
  -- wird von Supabase blockiert.
  delete from ping_replies where player_id = v_me;
  delete from pings where player_id = v_me;
  delete from challenges where challenger_id = v_me or challenged_id = v_me;
  delete from ghost_games where player_id = v_me;

  -- Spieler-Zeile anonymisieren statt loeschen (Match-Historie anderer bleibt intakt).
  update players set
    nickname = 'Ehemaliges Mitglied ' || substr(v_me::text, 1, 8),
    avatar_color = null,
    avatar_photo_at = null,
    motto = null,
    invite_code = null,
    selected_badge = null,
    auth_user_id = null,
    blocked = true
  where id = v_me;

  -- Login-Konto vollstaendig und unwiderruflich entfernen. Muss NACH dem
  -- obigen UPDATE laufen (auth_user_id dort schon auf null gesetzt), damit
  -- eine etwaige ON DELETE CASCADE-Regel auf players.auth_user_id nicht
  -- die gerade erst anonymisierte Zeile mitreisst.
  delete from auth.users where id = v_auth_id;
end;
$$;

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
  if exists (select 1 from winner_stays_sessions where organizer_id = p_player) then
    raise exception 'Dieser Spieler leitet eine Winner-Stays-Runde - diese zuerst beenden oder löschen.';
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

  -- Winner-Stays: Spielprotokoll UND Teilnahme-Eintraege dieses Spielers
  -- muessen vor der Matches-Loeschung weg (winner_stays_games.match_id
  -- verweist ohne ON DELETE auf matches - sonst schlaegt gleich die
  -- "delete from matches"-Zeile unten mit einem Fremdschluessel-Fehler fehl).
  delete from winner_stays_games where reported_by = p_player
    or entry_a_id in (select id from winner_stays_entries where player1_id = p_player or player2_id = p_player)
    or entry_b_id in (select id from winner_stays_entries where player1_id = p_player or player2_id = p_player)
    or winner_entry_id in (select id from winner_stays_entries where player1_id = p_player or player2_id = p_player);
  delete from winner_stays_entries where player1_id = p_player or player2_id = p_player;

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

  -- Foto entfernt der Client VOR diesem Aufruf ueber die Storage-API (siehe
  -- AdminScreen.jsx deletePlayer()) - kein direktes SQL-DELETE mehr hier.
  delete from players where id = p_player;
  if v_auth_id is not null then
    delete from auth.identities where user_id = v_auth_id;
    delete from auth.users where id = v_auth_id;
  end if;
end;
$$;

grant execute on function admin_delete_player(uuid, text) to authenticated;
