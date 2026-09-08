-- Zwei zusammenhaengende Aenderungen (Nutzer-Feedback: Turniere anlegen soll
-- allen Spielern offenstehen, aber die Turnierleitungs-Sonderrechte duerfen
-- dafuer nicht missbraucht werden koennen):
--
-- 1) create_tournament(): die Admin-Pruefung faellt weg - jeder registrierte
--    Spieler kann ein Turnier anlegen (wird automatisch dessen organizer_id).
--
-- 2) tournament_organizer_edit_match(): schliesst die dadurch entstehende
--    Luecke. tournament_organizer_report_match() und tournament_force_
--    confirm_match() lehnen es bereits serverseitig ab, wenn die Turnier-
--    leitung selbst einer der beiden Spieler ist - nur die nachtraegliche
--    KORREKTUR eines schon bestaetigten Ergebnisses erlaubte das bisher
--    bewusst (kleiner Verein, Turnierleitung oft selbst Teilnehmer, sonst
--    kein Weg einen eigenen Tippfehler zu fixen). Der Sieger laesst sich
--    dabei zwar nicht aendern, aber die Punktedifferenz schon - und die
--    geht in die Elo-Berechnung ein (rebuild_elo(), nf = least(n,16), siehe
--    CLAUDE.md). Eine Turnierleitung, die im eigenen Turnier mitspielt,
--    koennte sich damit nachtraeglich einen groesseren Elo-Gewinn
--    verschaffen, ohne dass der Gegner das nochmal bestaetigen muesste.
--    Jetzt: Korrektur am eigenen Match nur noch fuer echte Admins (die
--    bleiben unbeschraenkt) - eine nicht-administrative Turnierleitung hat
--    damit am Ende genau dieselben Rechte ueber ihr eigenes Match wie jeder
--    normale Spieler in einem normalen 1-gegen-1-Match: selbst melden,
--    Gegner muss bestaetigen, keine einseitige Aenderung danach.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.create_tournament(
  p_name text, p_format text, p_discipline text,
  p_player_ids uuid[], p_table_numbers integer[],
  p_playoff_size integer default null::integer, p_double_round_robin boolean default false
) returns tournaments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tournament tournaments;
  v_players uuid[];
  v_n int;
  v_tables int[];
  v_table_count int;
  v_playoff_size int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Turniername fehlt.'; end if;
  if p_format not in ('ko', 'double_ko', 'round_robin') then raise exception 'Unbekanntes Turnierformat.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select array_agg(distinct x) into v_players from unnest(p_player_ids) x;
  v_n := coalesce(array_length(v_players, 1), 0);

  if p_format = 'round_robin' and v_n < 3 then
    raise exception 'Jeder-gegen-jeden braucht mindestens 3 Teilnehmer.';
  end if;
  if p_format in ('ko', 'double_ko') and v_n < 2 then
    raise exception 'Mindestens 2 Teilnehmer nötig.';
  end if;
  if exists (
    select 1 from unnest(v_players) pid
    where not exists (select 1 from players where id = pid)
       or exists (select 1 from players where id = pid and coalesce(is_ghost, false))
  ) then
    raise exception 'Teilnehmerliste enthält einen ungültigen Spieler oder den Ghost.';
  end if;

  select array_agg(distinct x order by x) into v_tables from unnest(p_table_numbers) x;
  v_table_count := coalesce(array_length(v_tables, 1), 0);
  if v_table_count = 0 then raise exception 'Mindestens ein Tisch nötig.'; end if;
  if exists (select 1 from unnest(v_tables) t where t <= 0) then
    raise exception 'Tischnummern müssen positiv sein.';
  end if;

  -- Playoff-Groesse: bei double_ko immer gesetzt (Default 2 = bisheriges
  -- Verhalten), bei round_robin optional (null = nur Tabelle, wie bisher),
  -- bei ko irrelevant/ignoriert.
  if p_format = 'double_ko' then
    v_playoff_size := coalesce(p_playoff_size, 2);
    if v_playoff_size not in (2, 4, 8) then raise exception 'Ungültige Finalrunden-Größe.'; end if;
  elsif p_format = 'round_robin' then
    v_playoff_size := p_playoff_size;
    if v_playoff_size is not null and v_playoff_size not in (2, 4, 8) then
      raise exception 'Ungültige Playoff-Größe.';
    end if;
  else
    v_playoff_size := null;
  end if;
  if v_playoff_size is not null and v_playoff_size > v_n then
    raise exception 'Playoff-Größe darf nicht größer als die Teilnehmerzahl sein.';
  end if;
  if p_format = 'double_ko' and v_playoff_size > 2 and v_n < v_playoff_size * 2 then
    raise exception 'Für diese Playoff-Größe werden mindestens % Teilnehmer benötigt.', v_playoff_size * 2;
  end if;

  insert into tournaments (name, format, discipline, organizer_id, table_numbers, status, started_at, playoff_size)
  values (trim(p_name), p_format, trim(p_discipline), v_me, v_tables, 'running', now(), v_playoff_size)
  returning * into v_tournament;

  insert into tournament_players (tournament_id, player_id)
    select v_tournament.id, x from unnest(v_players) x;

  -- Reihenfolge fuers Auslosen zufaellig mischen
  select array_agg(x) into v_players from (select x from unnest(v_players) x order by random()) t;

  if p_format = 'round_robin' then
    perform generate_round_robin(v_tournament.id, v_players, v_tables, coalesce(p_double_round_robin, false));
  else
    perform generate_ko_bracket(v_tournament.id, v_players, v_tables, p_format = 'double_ko', coalesce(v_playoff_size, 2));
  end if;

  perform tournament_assign_free_tables(v_tournament.id);

  return v_tournament;
end;
$function$;

create or replace function public.tournament_organizer_edit_match(p_tournament_match_id uuid, p_score1 integer, p_score2 integer, p_high_run1 integer DEFAULT NULL::integer, p_high_run2 integer DEFAULT NULL::integer, p_deficit1 integer DEFAULT NULL::integer, p_deficit2 integer DEFAULT NULL::integer, p_avg1 numeric DEFAULT NULL::numeric, p_avg2 numeric DEFAULT NULL::numeric, p_twoball1 integer DEFAULT NULL::integer, p_twoball2 integer DEFAULT NULL::integer, p_run_log jsonb DEFAULT NULL::jsonb)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_match matches;
  v_new_winner uuid;
  v_ms1 integer; v_ms2 integer;
  v_hr1 integer; v_hr2 integer; v_d1 integer; v_d2 integer;
  v_a1 numeric; v_a2 numeric; v_tb1 integer; v_tb2 integer;
  v_row matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.match_id is null then raise exception 'Für dieses Match wurde noch kein Ergebnis gemeldet.'; end if;
  select * into v_match from matches where id = v_tm.match_id;
  if not v_match.confirmed then
    raise exception 'Dieses Match ist noch nicht bestätigt - dafür gibt es die normale Bestätigung/das Erzwingen.';
  end if;
  if p_score1 = p_score2 then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann ein bestätigtes Ergebnis korrigieren.';
  end if;
  -- Ausnahmsweise darf die Turnierleitung ein eigenes Match korrigieren
  -- (kleiner Verein, oft selbst Teilnehmer) - ABER nur, wenn sie zusaetzlich
  -- Admin ist. Sonst koennte sich eine Turnierleitung, die selbst mitspielt,
  -- im eigenen Match nachtraeglich die Punktedifferenz (und damit den Elo-
  -- Gewinn) schoenrechnen, ohne dass der Gegner das nochmal bestaetigen
  -- muesste - der Sieger allein laesst sich zwar nicht aendern, das reicht
  -- aber nicht als Schutz.
  if v_me in (v_tm.player1_id, v_tm.player2_id) and not is_admin() then
    raise exception 'Als Spieler dieses Matches kannst du ein bestätigtes Ergebnis nicht selbst korrigieren - das kann nur ein Admin.';
  end if;
  if v_tour.results_confirmed_at is not null then
    raise exception 'Das Turnier wurde bereits bestätigt - Korrekturen sind nicht mehr möglich.';
  end if;

  if v_match.player1_id = v_tm.player1_id then
    v_ms1 := p_score1; v_ms2 := p_score2;
    v_hr1 := p_high_run1; v_hr2 := p_high_run2; v_d1 := p_deficit1; v_d2 := p_deficit2;
    v_a1 := p_avg1; v_a2 := p_avg2; v_tb1 := p_twoball1; v_tb2 := p_twoball2;
  else
    v_ms1 := p_score2; v_ms2 := p_score1;
    v_hr1 := p_high_run2; v_hr2 := p_high_run1; v_d1 := p_deficit2; v_d2 := p_deficit1;
    v_a1 := p_avg2; v_a2 := p_avg1; v_tb1 := p_twoball2; v_tb2 := p_twoball1;
  end if;

  v_new_winner := case when v_ms1 > v_ms2 then v_match.player1_id else v_match.player2_id end;
  if v_tm.winner_id is not null and v_new_winner <> v_tm.winner_id then
    raise exception 'Eine Korrektur, die den Sieger ändern würde, ist hier nicht möglich (könnte den weiteren Turnierverlauf ungültig machen).';
  end if;

  update matches set score1 = v_ms1, score2 = v_ms2,
    high_run1 = coalesce(v_hr1, high_run1), high_run2 = coalesce(v_hr2, high_run2),
    deficit1 = coalesce(v_d1, deficit1), deficit2 = coalesce(v_d2, deficit2),
    avg1 = coalesce(v_a1, avg1), avg2 = coalesce(v_a2, avg2),
    twoball1 = coalesce(v_tb1, twoball1), twoball2 = coalesce(v_tb2, twoball2),
    run_log = coalesce(p_run_log, run_log),
    confirmed_by = v_me
  where id = v_tm.match_id
  returning * into v_row;

  return v_row;
end;
$function$;
