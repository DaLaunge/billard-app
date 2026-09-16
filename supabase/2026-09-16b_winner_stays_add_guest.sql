-- Nutzer-Feedback: "hier sollte bereits ein Gast-User vorgeschlagen werden,
-- weil es den user nicht im System gibt" - beim Hinzufuegen von
-- Teilnehmern zu einer Winner-Stays-Runde gab es (anders als bei normalen
-- Turnieren, siehe 2026-09-10_tournament_guests.sql) noch keine
-- Moeglichkeit, jemanden ohne App/Login als Gast hinzuzufuegen.
--
-- winner_stays_add_guest() spiegelt tournament_organizer_add_guest():
-- legt eine neue Gast-Person an (nur Name, kein Login, is_guest=true) und
-- reiht sie im selben Schritt ans Ende der Warteschlange ein - nur fuer
-- Einzel-Runden (bei Doppel muesste ein ganzes Team stehen, das macht ein
-- reiner Namensvorschlag aus der Spieler-Suche nicht sinnvoll moeglich).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.winner_stays_add_guest(p_session_id uuid, p_nickname text)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_nick text := trim(coalesce(p_nickname, ''));
  v_guest players;
  v_next_pos int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Gäste hinzufügen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if v_sess.is_doubles then raise exception 'Diese Runde ist ein Doppel - Gäste einzeln als Team hinzufügen.'; end if;
  if v_nick = '' then raise exception 'Name fehlt.'; end if;

  begin
    insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
  exception when unique_violation then
    raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
  end;

  select coalesce(max(queue_position), -1) + 1 into v_next_pos from winner_stays_entries where session_id = p_session_id;
  insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_guest.id, v_next_pos);
end;
$function$;
