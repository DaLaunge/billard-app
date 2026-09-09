-- admin_delete_player() (siehe 2026-09-05_admin_delete_player.sql) kannte die
-- mit der Winner-Stays-Funktion (2026-09-09_winner_stays.sql) neu
-- hinzugekommenen Tabellen noch nicht - das Loeschen eines Spielers, der
-- irgendwann an einer Winner-Stays-Runde teilgenommen hat, waere mit einem
-- Fremdschluessel-Fehler fehlgeschlagen (winner_stays_entries.player1_id/
-- player2_id und winner_stays_games.match_id haengen ohne ON DELETE-Regel an
-- players bzw. matches). Beim Aufraeumen der Testspieler nach dem
-- Winner-Stays-Livetest entdeckt.
--
-- Gleiche Linie wie beim bestehenden Turnier-Organisator-Check (Zeile ~34):
-- eine laufende Runde, die dieser Spieler LEITET, wird nicht einfach
-- mitgeloescht (koennte andere Teilnehmer betreffen) - stattdessen muss die
-- Runde zuerst beendet/geloescht werden. Reine TEILNAHME wird dagegen wie bei
-- normalen Matches mitgeloescht (diese Funktion ist laut ihrem eigenen
-- Kommentar ohnehin nur fuer Test-/Wegwerf-Accounts gedacht und akzeptiert
-- dafuer den Verlust gemeinsamer Historie).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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

  delete from storage.objects where bucket_id = 'avatars' and v_auth_id is not null and (storage.foldername(name))[1] = v_auth_id::text;
  delete from players where id = p_player;
  if v_auth_id is not null then
    delete from auth.identities where user_id = v_auth_id;
    delete from auth.users where id = v_auth_id;
  end if;
end;
$$;

grant execute on function admin_delete_player(uuid, text) to authenticated;
