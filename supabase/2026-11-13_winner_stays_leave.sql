-- Winner Stays: Teilnehmer koennen JEDERZEIT aus der Runde genommen werden (bis nur noch zwei uebrig sind) - auch wenn sie schon gespielt haben.
-- Test, dann Produktion. Idempotent.
--
-- Bisher: winner_stays_remove_entry() loeschte die Zeile; winner_stays_games zeigt aber (ohne ON DELETE) auf winner_stays_entries, das DELETE
-- scheiterte also an einem Fremdschluessel, sobald die Person ein Spiel gespielt hatte (nur wer noch nie dran war, liess sich entfernen).
-- Jetzt "verlaesst" ein Teilnehmer die Runde: seine Zeile (mit allen Spielen, Siegen und Niederlagen) wird in eine ARCHIV-RUNDE verschoben
-- (winner_stays_sessions mit status 'archive', archive_of = die eigentliche Runde; Eintrag.origin_session_id = urspruengliche Runde). Fuer
-- alle bestehenden Funktionen ist er damit schlicht nicht mehr in der Runde (Tisch, Warteschlange, Zaehlungen), waehrend die Spiele in
-- winner_stays_games unveraendert zur Runde gehoeren und beim Beenden (winner_stays_aggregate_session, verbindet ueber die Eintrags-ID)
-- weiter als gewertete Matches mit Protokoll entstehen. Archiv-Eintraege bekommen Positionen ab 1000, tauchen also nie "am Tisch" auf.
-- Die Regel "mindestens zwei Teilnehmer" bleibt: bis nur noch zwei uebrig sind, laeuft die Runde einfach weiter, bis jemand dazukommt oder
-- sie beendet wird. Entfernen darf die Leitung/Admins jeden, jeder Teilnehmer sich selbst; die Gast-Abmeldung nutzt dieselbe Funktion.
--
-- WICHTIG: Der SQL-Editor des Dashboards zerlegt plpgsql ("relation v_entry does not exist") - deshalb ist JEDE Funktion hier EINE SQL-Anweisung
-- (language sql, WITH-Klauseln, kein Semikolon im Rumpf). Unerlaubte Aufrufe tun still nichts; die App prueft vorher und zeigt eine Meldung.

alter table public.winner_stays_sessions add column if not exists archive_of uuid references public.winner_stays_sessions(id) on delete cascade;
alter table public.winner_stays_sessions drop constraint if exists winner_stays_sessions_status_check;
alter table public.winner_stays_sessions add constraint winner_stays_sessions_status_check check (status in ('running', 'finished', 'archive'));
alter table public.winner_stays_entries add column if not exists origin_session_id uuid;
alter table public.winner_stays_entries add column if not exists left_at timestamptz;

-- Kern (intern, ohne Berechtigungspruefung): Eintrag in die Archiv-Runde verschieben, Warteschlange rueckt nach.
-- Tut nichts, wenn der Eintrag nicht zur Runde gehoert, die Runde nicht laeuft oder nur noch zwei Teilnehmer da sind.
create or replace function public.winner_stays_leave_core(p_session_id uuid, p_entry_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  with s as (
    select * from winner_stays_sessions where id = p_session_id and status = 'running'
  ), e as (
    select * from winner_stays_entries where id = p_entry_id and session_id = p_session_id
  ), ok as (
    select s.id as sid, e.queue_position as pos from s, e
     where (select count(*) from winner_stays_entries where session_id = p_session_id) > 2
  ), old_arch as (
    select id from winner_stays_sessions where archive_of = p_session_id
  ), new_arch as (
    insert into winner_stays_sessions (name, discipline, is_doubles, table_number, organizer_id, status, break_rule, archive_of)
    select s.name, s.discipline, s.is_doubles, s.table_number, s.organizer_id, 'archive', s.break_rule, s.id
      from s
     where exists (select 1 from ok) and not exists (select 1 from old_arch)
    returning id
  ), arch as (
    select id from old_arch union all select id from new_arch
  ), moved as (
    update winner_stays_entries
       set session_id = (select id from arch), origin_session_id = p_session_id, left_at = now(), is_paused = false,
           queue_position = greatest(coalesce((select max(queue_position) from winner_stays_entries where session_id = (select id from arch)), 999), 999) + 1
     where id = p_entry_id and exists (select 1 from ok)
    returning 1
  )
  update winner_stays_entries set queue_position = queue_position - 1
   where session_id = p_session_id and id <> p_entry_id and queue_position > (select pos from ok) and exists (select 1 from moved)
$function$;
revoke all on function public.winner_stays_leave_core(uuid, uuid) from public, anon, authenticated;

-- Leitung/Admins: jeden; jeder Teilnehmer: sich selbst
create or replace function public.winner_stays_remove_entry(p_session_id uuid, p_entry_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  select winner_stays_leave_core(p_session_id, p_entry_id)
   where exists (
     select 1 from winner_stays_sessions s join winner_stays_entries e on e.id = p_entry_id and e.session_id = s.id
      where s.id = p_session_id and s.status = 'running' and current_player_id() is not null
        and (is_admin() or s.organizer_id = current_player_id() or e.player1_id = current_player_id() or e.player2_id = current_player_id())
   )
$function$;

-- Gast meldet sich selbst ab (nicht, solange er am Tisch steht)
create or replace function public.guest_ws_withdraw(p_token text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  select winner_stays_leave_core(e.session_id, e.id)
    from winner_stays_guest_tokens t
    join winner_stays_entries e on e.session_id = t.session_id and e.player1_id = t.player_id
   where t.token = p_token and e.queue_position > 1
$function$;

revoke all on function public.winner_stays_remove_entry(uuid, uuid) from public, anon;
grant execute on function public.winner_stays_remove_entry(uuid, uuid) to authenticated;
