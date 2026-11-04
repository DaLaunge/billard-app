-- Bereits vorhandene Gaeste in Turnier und Winner-Stays-Runde hinzufuegen (Nutzer-Hinweis 2026-11-04): tournament_organizer_add_guest() und
-- winner_stays_add_guest() legten IMMER eine neue Person an und scheiterten bei einem Gast, den es schon gibt, mit "Name ist schon vergeben".
-- Jetzt nehmen beide den vorhandenen GAST gleichen Namens (Gross-/Kleinschreibung egal) und melden ihn an, genau wie add_guest_player() im Match.
-- Gehoert der Name einem echten Mitglied, wird nichts angelegt. Wer schon angemeldet ist, wird nicht doppelt eingetragen.
-- Beide liefern die Gast-Person zurueck (Winner Stays bisher nichts); fehlt die Berechtigung, ist die Runde/das Turnier im falschen Status oder der
-- Name ungueltig, kommt NULL zurueck - die App zeigt dann einen Fehler. Bremse wie bei add_guest_player: hoechstens 40 NEUE Gaeste in 10 Minuten.
-- Beide Funktionen sind EINE SQL-Anweisung ohne Semikolon im Rumpf (der SQL-Editor des Dashboards zerlegt plpgsql an den Semikolons).
--
-- Test, dann Produktion. Idempotent. Als GANZE Datei ausfuehren.

create or replace function public.tournament_organizer_add_guest(p_tournament_id uuid, p_nickname text)
returns players
language sql
security definer
set search_path = public
as $$
  with ok as (
    select trim(p_nickname) as nick from tournaments
     where id = p_tournament_id and status = 'setup' and current_player_id() is not null
       and (is_admin() or organizer_id = current_player_id())
       and char_length(trim(coalesce(p_nickname, ''))) between 1 and 30
  ),
  old as (
    select p.* from players p, ok where p.nickname = ok.nick and p.is_guest
  ),
  fresh as (
    insert into players (nickname, is_guest)
    select ok.nick, true from ok
     where not exists (select 1 from old)
       and not exists (select 1 from players p where p.nickname = ok.nick)
       and (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') < 40
    returning *
  ),
  g as (select * from old union all select * from fresh),
  reg as (
    insert into tournament_players (tournament_id, player_id)
    select p_tournament_id, g.id from g
     where not exists (select 1 from tournament_players tp where tp.tournament_id = p_tournament_id and tp.player_id = g.id)
    returning 1
  )
  select * from g
$$;

drop function if exists public.winner_stays_add_guest(uuid, text);

create function public.winner_stays_add_guest(p_session_id uuid, p_nickname text)
returns players
language sql
security definer
set search_path = public
as $$
  with ok as (
    select trim(p_nickname) as nick from winner_stays_sessions
     where id = p_session_id and status = 'running' and not is_doubles and current_player_id() is not null
       and (is_admin() or organizer_id = current_player_id())
       and char_length(trim(coalesce(p_nickname, ''))) between 1 and 30
  ),
  old as (
    select p.* from players p, ok where p.nickname = ok.nick and p.is_guest
  ),
  fresh as (
    insert into players (nickname, is_guest)
    select ok.nick, true from ok
     where not exists (select 1 from old)
       and not exists (select 1 from players p where p.nickname = ok.nick)
       and (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') < 40
    returning *
  ),
  g as (select * from old union all select * from fresh),
  reg as (
    insert into winner_stays_entries (session_id, player1_id, queue_position)
    select p_session_id, g.id, coalesce((select max(queue_position) from winner_stays_entries where session_id = p_session_id), -1) + 1
      from g
     where not exists (select 1 from winner_stays_entries e where e.session_id = p_session_id and (e.player1_id = g.id or e.player2_id = g.id))
    returning 1
  )
  select * from g
$$;

revoke all on function public.tournament_organizer_add_guest(uuid, text) from public;
grant execute on function public.tournament_organizer_add_guest(uuid, text) to authenticated;
revoke all on function public.winner_stays_add_guest(uuid, text) from public;
grant execute on function public.winner_stays_add_guest(uuid, text) to authenticated;
