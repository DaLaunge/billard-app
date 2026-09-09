-- Neuer Modus "Winner Stays" (Nutzer-Feedback): typisch, wenn sich 3+
-- Personen einen Tisch teilen - 2 spielen, die anderen warten/schiedsen,
-- der Sieger bleibt am Tisch, der Verlierer geht ans Ende der Schlange und
-- die naechste Person in der Schlange kommt nach. Skaliert auf beliebig
-- viele Personen, funktioniert in Einzel wie Doppel, in jeder Disziplin.
-- Voellig anderes Datenmodell als die bestehenden Turniere (keine feste
-- Bracket-Struktur, dynamische Warteschlange statt Runden) - deshalb
-- eigene Tabellen statt einer Erweiterung von tournaments/tournament_matches.
--
-- Jedes gemeldete Spiel wird zusaetzlich als ganz normales, SOFORT
-- bestaetigtes matches-Match eingetragen (zaehlt fuers Rating, wie bei
-- einer Turnierleitungs-Meldung) - keine gesonderte Bestaetigung durch die
-- Gegenseite, weil bei "Winner Stays" ohnehin alle live am Tisch stehen und
-- die Eingabe schnell gehen soll ("einfache Eingabemaske").
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create table if not exists public.winner_stays_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  discipline text not null,
  is_doubles boolean not null default false,
  table_number int,
  organizer_id uuid not null references public.players(id),
  status text not null default 'running' check (status in ('running', 'finished')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Warteschlange: Position 0 und 1 stehen gerade am Tisch (0 = "verteidigt",
-- 1 = Herausforderer/in) - beide Werte sind reine Ablaufsteuerung, keine
-- Rangliste. Fuer Doppel ist player2_id das zweite Teammitglied, sonst null.
create table if not exists public.winner_stays_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.winner_stays_sessions(id) on delete cascade,
  player1_id uuid not null references public.players(id),
  player2_id uuid references public.players(id),
  queue_position int not null,
  wins int not null default 0,
  losses int not null default 0,
  games int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, queue_position)
);

-- Spielprotokoll je Runde - match_id verweist auf den normalen, gewerteten
-- matches-Datensatz (fuers Rating), diese Tabelle ist der "Winner Stays"-
-- eigene Verlauf (wer stand sich gegenueber, wer hat gewonnen).
create table if not exists public.winner_stays_games (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.winner_stays_sessions(id) on delete cascade,
  game_no int not null,
  entry_a_id uuid not null references public.winner_stays_entries(id),
  entry_b_id uuid not null references public.winner_stays_entries(id),
  score_a int not null,
  score_b int not null,
  winner_entry_id uuid not null references public.winner_stays_entries(id),
  match_id uuid references public.matches(id),
  played_at timestamptz not null default now(),
  reported_by uuid not null references public.players(id)
);

alter table public.winner_stays_sessions enable row level security;
alter table public.winner_stays_entries enable row level security;
alter table public.winner_stays_games enable row level security;

create policy "mitglieder_lesen_winner_stays_sessions" on public.winner_stays_sessions for select using (true);
create policy "mitglieder_lesen_winner_stays_entries" on public.winner_stays_entries for select using (true);
create policy "mitglieder_lesen_winner_stays_games" on public.winner_stays_games for select using (true);

-- =========================================================================
-- winner_stays_create_session(): legt eine neue Runde an, jeder Spieler
-- darf das (wie bei create_tournament()), noch ohne Teilnehmer.
-- =========================================================================
create or replace function public.winner_stays_create_session(
  p_name text, p_discipline text, p_is_doubles boolean default false, p_table_number int default null
) returns public.winner_stays_sessions
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_row winner_stays_sessions;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Name fehlt.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;
  if p_table_number is not null and p_table_number <= 0 then raise exception 'Tischnummer muss positiv sein.'; end if;

  insert into winner_stays_sessions (name, discipline, is_doubles, table_number, organizer_id)
  values (trim(p_name), trim(p_discipline), coalesce(p_is_doubles, false), p_table_number, v_me)
  returning * into v_row;

  return v_row;
end;
$function$;

-- =========================================================================
-- winner_stays_add_entries(): mehrere Einzel-Teilnehmer auf einmal ans Ende
-- der Warteschlange hinzufuegen (nur bei is_doubles = false).
-- =========================================================================
create or replace function public.winner_stays_add_entries(p_session_id uuid, p_player_ids uuid[])
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_next_pos int;
  v_pid uuid;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Teilnehmer hinzufügen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if v_sess.is_doubles then raise exception 'Diese Runde ist ein Doppel - Teams einzeln hinzufügen.'; end if;
  if coalesce(array_length(p_player_ids, 1), 0) = 0 then raise exception 'Keine Spieler ausgewählt.'; end if;
  if exists (
    select 1 from unnest(p_player_ids) pid
    where not exists (select 1 from players where id = pid)
       or exists (select 1 from players where id = pid and coalesce(is_ghost, false))
  ) then
    raise exception 'Auswahl enthält einen ungültigen Spieler oder den Ghost.';
  end if;
  if exists (
    select 1 from winner_stays_entries e
    where e.session_id = p_session_id and e.player1_id = any(p_player_ids)
  ) then
    raise exception 'Mindestens eine ausgewählte Person spielt in dieser Runde bereits mit.';
  end if;

  select coalesce(max(queue_position), -1) into v_next_pos from winner_stays_entries where session_id = p_session_id;

  foreach v_pid in array p_player_ids loop
    v_next_pos := v_next_pos + 1;
    insert into winner_stays_entries (session_id, player1_id, queue_position) values (p_session_id, v_pid, v_next_pos);
  end loop;
end;
$function$;

-- =========================================================================
-- winner_stays_add_team(): ein Doppel-Team ans Ende der Warteschlange
-- hinzufuegen (nur bei is_doubles = true).
-- =========================================================================
create or replace function public.winner_stays_add_team(p_session_id uuid, p_player1_id uuid, p_player2_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_next_pos int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Teilnehmer hinzufügen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if not v_sess.is_doubles then raise exception 'Diese Runde ist kein Doppel.'; end if;
  if p_player1_id = p_player2_id then raise exception 'Ein Team braucht zwei verschiedene Personen.'; end if;
  if exists (select 1 from players where id in (p_player1_id, p_player2_id) and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann hier nicht mitspielen.';
  end if;
  if exists (
    select 1 from winner_stays_entries e
    where e.session_id = p_session_id
      and (e.player1_id in (p_player1_id, p_player2_id) or e.player2_id in (p_player1_id, p_player2_id))
  ) then
    raise exception 'Mindestens eine ausgewählte Person spielt in dieser Runde bereits mit.';
  end if;

  select coalesce(max(queue_position), -1) + 1 into v_next_pos from winner_stays_entries where session_id = p_session_id;

  insert into winner_stays_entries (session_id, player1_id, player2_id, queue_position)
  values (p_session_id, p_player1_id, p_player2_id, v_next_pos);
end;
$function$;

-- =========================================================================
-- winner_stays_remove_entry(): jemanden wieder aus der Warteschlange
-- nehmen (z.B. muss vorzeitig gehen) - Schlange rueckt danach nach.
-- =========================================================================
create or replace function public.winner_stays_remove_entry(p_session_id uuid, p_entry_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_entry winner_stays_entries;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Teilnehmer entfernen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;

  select * into v_entry from winner_stays_entries where id = p_entry_id and session_id = p_session_id;
  if not found then raise exception 'Teilnehmer nicht gefunden.'; end if;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count <= 2 then raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde bleiben.'; end if;

  delete from winner_stays_entries where id = p_entry_id;
  update winner_stays_entries set queue_position = queue_position - 1
    where session_id = p_session_id and queue_position > v_entry.queue_position;
end;
$function$;

-- =========================================================================
-- winner_stays_report_game(): das Kernstueck - meldet das Ergebnis zwischen
-- Warteschlangen-Position 0 (score_a) und 1 (score_b), traegt es normal
-- (sofort bestaetigt) in matches ein, aktualisiert die Live-Rangliste
-- (wins/losses/games/streak) und rotiert die Warteschlange: Verlierer ans
-- Ende, alle dahinter ruecken auf. Bei genau 2 Teilnehmern bleibt die
-- Reihenfolge unveraendert (die beiden spielen einfach immer weiter
-- gegeneinander).
-- =========================================================================
create or replace function public.winner_stays_report_game(p_session_id uuid, p_score_a int, p_score_b int)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
  v_a winner_stays_entries;
  v_b winner_stays_entries;
  v_winner winner_stays_entries;
  v_loser winner_stays_entries;
  v_match_id uuid;
  v_game_no int;
  v_count int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann Ergebnisse eintragen.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist beendet.'; end if;
  if p_score_a = p_score_b then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_a from winner_stays_entries where session_id = p_session_id and queue_position = 0;
  select * into v_b from winner_stays_entries where session_id = p_session_id and queue_position = 1;
  if v_a.id is null or v_b.id is null then
    raise exception 'Es müssen mindestens zwei Teilnehmer in der Runde sein.';
  end if;

  if p_score_a > p_score_b then v_winner := v_a; v_loser := v_b;
  else v_winner := v_b; v_loser := v_a; end if;

  if v_sess.is_doubles then
    insert into matches (player1_id, player1b_id, player2_id, player2b_id, score1, score2, discipline, reported_by, confirmed, confirmed_by)
    values (v_a.player1_id, v_a.player2_id, v_b.player1_id, v_b.player2_id, p_score_a, p_score_b, v_sess.discipline, v_me, true, v_me)
    returning id into v_match_id;
  else
    insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, confirmed_by)
    values (v_a.player1_id, v_b.player1_id, p_score_a, p_score_b, v_sess.discipline, v_me, true, v_me)
    returning id into v_match_id;
  end if;

  select coalesce(max(game_no), 0) + 1 into v_game_no from winner_stays_games where session_id = p_session_id;

  insert into winner_stays_games (session_id, game_no, entry_a_id, entry_b_id, score_a, score_b, winner_entry_id, match_id, reported_by)
  values (p_session_id, v_game_no, v_a.id, v_b.id, p_score_a, p_score_b, v_winner.id, v_match_id, v_me);

  update winner_stays_entries set wins = wins + 1, games = games + 1, streak = streak + 1,
    best_streak = greatest(best_streak, streak + 1)
    where id = v_winner.id;
  update winner_stays_entries set losses = losses + 1, games = games + 1, streak = 0
    where id = v_loser.id;

  select count(*) into v_count from winner_stays_entries where session_id = p_session_id;
  if v_count > 2 then
    update winner_stays_entries set queue_position = queue_position - 1
      where session_id = p_session_id and queue_position > v_loser.queue_position;
    update winner_stays_entries set queue_position = v_count - 1 where id = v_loser.id;
  end if;
end;
$function$;

-- =========================================================================
-- winner_stays_finish_session() / winner_stays_delete_session(): wie bei
-- Turnieren - beenden geht immer, loeschen nur, solange noch kein Spiel
-- gemeldet wurde.
-- =========================================================================
create or replace function public.winner_stays_finish_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann sie beenden.';
  end if;
  if v_sess.status <> 'running' then raise exception 'Diese Runde ist nicht aktiv.'; end if;
  update winner_stays_sessions set status = 'finished', finished_at = now() where id = p_session_id;
end;
$function$;

create or replace function public.winner_stays_delete_session(p_session_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_sess winner_stays_sessions;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_sess from winner_stays_sessions where id = p_session_id;
  if not found then raise exception 'Runde nicht gefunden.'; end if;
  if not (is_admin() or v_sess.organizer_id = v_me) then
    raise exception 'Nur die Leitung dieser Runde kann sie löschen.';
  end if;
  if exists (select 1 from winner_stays_games where session_id = p_session_id) then
    raise exception 'Es wurden bereits Spiele in dieser Runde gemeldet - stattdessen beenden statt löschen.';
  end if;
  delete from winner_stays_sessions where id = p_session_id;
end;
$function$;
