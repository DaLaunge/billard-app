-- Turnier-Anmeldephase + Nichterscheinen-Regel (Nutzer-Feedback):
--
-- 1) Turniere werden nicht mehr mit fester Teilnehmerliste sofort
--    ausgelost, sondern starten "offen" (status='registration'). Spieler
--    melden sich SELBST an/ab (tournament_register/tournament_unregister).
--    Die Turnierleitung startet explizit (tournament_start - generiert an
--    dieser Stelle erst den Baum, ruft dafuer unveraendert die bestehenden
--    generate_round_robin()/generate_ko_bracket() auf) und kann einen
--    verfruehten Start rueckgaengig machen (tournament_cancel_start, nur
--    solange noch KEIN Match gemeldet wurde).
-- 2) tournament_mark_no_show(): Turnierleitung meldet, dass eine oder beide
--    Parteien eines anstehenden Matches nicht erschienen sind.
--    - EINE Partei abwesend: zaehlt normal als 1:0-Ergebnis fuer die
--      anwesende Partei (voller Elo-Effekt = gewollter "Punkteabzug").
--    - BEIDE abwesend: zaehlt NICHT fuers Elo (neue Spalte matches.walkover),
--      die Turnierleitung waehlt trotzdem einen technischen Aufsteiger,
--      damit der Baum weiterlaufen kann.
--    In BEIDEN Faellen kaskadiert die Abwesenheit automatisch auf alle
--    WEITEREN, dadurch bereits feststehenden offenen Partien der/des
--    tatsaechlich ausgeschiedenen Spielers (Doppel-K.O.-Abstieg bzw. alle
--    von Anfang an feststehenden Jeder-gegen-jeden-Partien) - beim
--    technischen Aufsteiger selbst NICHT, der bleibt bewusst regulaer im
--    Turnier.
--    Bekannte Einschraenkung: kaskadieren zwei UNABHAENGIG gemeldete
--    Abwesenheiten zufaellig in dieselbe spaetere Partie, gewinnt wer
--    zuerst gemeldet wurde - fuer einen kleinen Verein ein akzeptabler
--    Randfall.
--
-- advance_tournament_bracket() (der Trigger, der bei jeder Match-
-- Bestaetigung den Baum weiterschaltet) bleibt komplett unveraendert -
-- Forfeits/Walkover laufen ueber ganz normale bestaetigte matches-Zeilen,
-- exakt nach demselben Zwei-Schritt-Muster (erst match_id verlinken, DANACH
-- erst bestaetigen) wie tournament_organizer_report_match().
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table matches add column if not exists walkover boolean not null default false;
alter table tournaments add column if not exists double_round_robin boolean not null default false;

create or replace function public.rebuild_elo()
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  disc  text;
  m     record;
  ra numeric; rb numeric; ga int; gb int; la timestamptz; lb timestamptz;
  ra2 numeric; rb2 numeric; ga2 int; gb2 int; la2 timestamptz; lb2 timestamptz;
  tA numeric; tB numeric;
  n int; nf numeric; ea numeric; delta numeric;
  sh int; a1 int; a2 int;
  K     constant numeric := 4;
  GRACE constant numeric := 30;
  HALF  constant numeric := 200;
begin
  delete from elo_anchors where true;
  delete from ratings where true;

  for disc in
        select 'Gesamt'::text
        union select distinct discipline from matches where confirmed and player1b_id is null
        union select 'Doppel'::text where exists (select 1 from matches where confirmed and player1b_id is not null)
  loop
    drop table if exists est;
    create temp table est (player_id uuid primary key, rating numeric, games int, last_at timestamptz);

    for m in
      select * from matches
      where confirmed and score1 <> score2 and not walkover
        and ( disc = 'Gesamt'
              or (disc = 'Doppel' and player1b_id is not null)
              or (disc <> 'Gesamt' and disc <> 'Doppel' and player1b_id is null and discipline = disc) )
      order by played_at, id
    loop
      sh := greatest(0, -least(m.score1, m.score2));
      a1 := m.score1 + sh; a2 := m.score2 + sh;
      n  := a1 + a2;
      nf := least(n, 16);

      if m.player1b_id is null then
        select rating, games, last_at into ra, ga, la from est where player_id = m.player1_id;
        if not found then ra := 500; ga := 0; la := null; insert into est values (m.player1_id, 500, 0, null); end if;
        select rating, games, last_at into rb, gb, lb from est where player_id = m.player2_id;
        if not found then rb := 500; gb := 0; lb := null; insert into est values (m.player2_id, 500, 0, null); end if;
        if la is not null then ra := 500 + (ra-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-la))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb is not null then rb := 500 + (rb-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-lb))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;

        ea := 1.0 / (1.0 + power(2.0, (rb - ra) / 100.0));
        delta := K * nf * (a1::numeric / n - ea);
        ra := ra + delta; rb := rb - delta;

        update est set rating = ra, games = ga+1, last_at = m.played_at where player_id = m.player1_id;
        update est set rating = rb, games = gb+1, last_at = m.played_at where player_id = m.player2_id;

        insert into elo_anchors (player_id, discipline, anchor_at, rating, games) values
          (m.player1_id, disc, m.played_at, ra, ga+1),
          (m.player2_id, disc, m.played_at, rb, gb+1)
        on conflict (player_id, discipline, anchor_at) do update set rating = excluded.rating, games = excluded.games;

      else
        select rating, games, last_at into ra,  ga,  la  from est where player_id = m.player1_id;
        if not found then ra:=500; ga:=0; la:=null; insert into est values (m.player1_id,500,0,null); end if;
        select rating, games, last_at into ra2, ga2, la2 from est where player_id = m.player1b_id;
        if not found then ra2:=500; ga2:=0; la2:=null; insert into est values (m.player1b_id,500,0,null); end if;
        select rating, games, last_at into rb,  gb,  lb  from est where player_id = m.player2_id;
        if not found then rb:=500; gb:=0; lb:=null; insert into est values (m.player2_id,500,0,null); end if;
        select rating, games, last_at into rb2, gb2, lb2 from est where player_id = m.player2b_id;
        if not found then rb2:=500; gb2:=0; lb2:=null; insert into est values (m.player2b_id,500,0,null); end if;

        if la  is not null then ra  := 500 + (ra -500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-la ))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if la2 is not null then ra2 := 500 + (ra2-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-la2))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb  is not null then rb  := 500 + (rb -500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-lb ))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb2 is not null then rb2 := 500 + (rb2-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-lb2))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;

        tA := (ra + ra2) / 2.0;
        tB := (rb + rb2) / 2.0;
        ea := 1.0 / (1.0 + power(2.0, (tB - tA) / 100.0));
        delta := K * nf * (a1::numeric / n - ea);
        ra := ra + delta; ra2 := ra2 + delta;
        rb := rb - delta; rb2 := rb2 - delta;

        update est set rating = ra,  games = ga +1, last_at = m.played_at where player_id = m.player1_id;
        update est set rating = ra2, games = ga2+1, last_at = m.played_at where player_id = m.player1b_id;
        update est set rating = rb,  games = gb +1, last_at = m.played_at where player_id = m.player2_id;
        update est set rating = rb2, games = gb2+1, last_at = m.played_at where player_id = m.player2b_id;

        insert into elo_anchors (player_id, discipline, anchor_at, rating, games) values
          (m.player1_id,  disc, m.played_at, ra,  ga +1),
          (m.player1b_id, disc, m.played_at, ra2, ga2+1),
          (m.player2_id,  disc, m.played_at, rb,  gb +1),
          (m.player2b_id, disc, m.played_at, rb2, gb2+1)
        on conflict (player_id, discipline, anchor_at) do update set rating = excluded.rating, games = excluded.games;
      end if;
    end loop;

    insert into ratings (player_id, discipline, rating, games_played, provisional, updated_at)
    select e.player_id, disc,
           500 + (e.rating - 500) * power(0.5::float8, (greatest(0, extract(epoch from (now() - e.last_at))/86400.0 - GRACE)/HALF)::float8)::numeric,
           e.games, e.games < 10, now()
    from est e;
  end loop;
end;
$function$;

-- Erstellt nur noch die Turnier-HUELLE (Name/Format/Disziplin/Tische) ohne
-- Teilnehmerliste - landet in status='registration'. Spieler melden sich
-- danach selbst an (tournament_register), die Turnierleitung startet
-- explizit (tournament_start), das generiert erst dann den Baum.
create or replace function public.create_tournament(
  p_name text, p_format text, p_discipline text, p_table_numbers integer[],
  p_playoff_size integer default null::integer, p_double_round_robin boolean default false
) returns tournaments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tournament tournaments;
  v_tables int[];
  v_table_count int;
  v_playoff_size int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Turniername fehlt.'; end if;
  if p_format not in ('ko', 'double_ko', 'round_robin') then raise exception 'Unbekanntes Turnierformat.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select array_agg(distinct x order by x) into v_tables from unnest(p_table_numbers) x;
  v_table_count := coalesce(array_length(v_tables, 1), 0);
  if v_table_count = 0 then raise exception 'Mindestens ein Tisch nötig.'; end if;
  if exists (select 1 from unnest(v_tables) t where t <= 0) then
    raise exception 'Tischnummern müssen positiv sein.';
  end if;

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

  insert into tournaments (name, format, discipline, organizer_id, table_numbers, status, playoff_size, double_round_robin)
  values (trim(p_name), p_format, trim(p_discipline), v_me, v_tables, 'registration', v_playoff_size, coalesce(p_double_round_robin, false))
  returning * into v_tournament;

  return v_tournament;
end;
$function$;

create or replace function public.tournament_register(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if v_tour.status <> 'registration' then raise exception 'Die Anmeldung für dieses Turnier ist nicht mehr offen.'; end if;
  if exists (select 1 from players where id = v_me and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann sich nicht für Turniere anmelden.';
  end if;
  insert into tournament_players (tournament_id, player_id) values (p_tournament_id, v_me)
    on conflict do nothing;
end;
$function$;

create or replace function public.tournament_unregister(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if v_tour.status <> 'registration' then raise exception 'Abmelden ist nach Turnierstart nicht mehr möglich.'; end if;
  delete from tournament_players where tournament_id = p_tournament_id and player_id = v_me;
end;
$function$;

create or replace function public.tournament_start(p_tournament_id uuid)
returns tournaments
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
  v_players uuid[];
  v_n int;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann dieses Turnier starten.';
  end if;
  if v_tour.status <> 'registration' then raise exception 'Dieses Turnier ist nicht (mehr) in der Anmeldephase.'; end if;

  select array_agg(player_id) into v_players from tournament_players where tournament_id = p_tournament_id;
  v_n := coalesce(array_length(v_players, 1), 0);

  if v_tour.format = 'round_robin' and v_n < 3 then
    raise exception 'Jeder-gegen-jeden braucht mindestens 3 Teilnehmer.';
  end if;
  if v_tour.format in ('ko', 'double_ko') and v_n < 2 then
    raise exception 'Mindestens 2 Teilnehmer nötig.';
  end if;
  if v_tour.playoff_size is not null and v_tour.playoff_size > v_n then
    raise exception 'Playoff-Größe darf nicht größer als die Teilnehmerzahl sein.';
  end if;
  if v_tour.format = 'double_ko' and v_tour.playoff_size > 2 and v_n < v_tour.playoff_size * 2 then
    raise exception 'Für diese Playoff-Größe werden mindestens % Teilnehmer benötigt.', v_tour.playoff_size * 2;
  end if;

  -- Reihenfolge fuers Auslosen zufaellig mischen
  select array_agg(x) into v_players from (select x from unnest(v_players) x order by random()) t;

  if v_tour.format = 'round_robin' then
    perform generate_round_robin(p_tournament_id, v_players, v_tour.table_numbers, v_tour.double_round_robin);
  else
    perform generate_ko_bracket(p_tournament_id, v_players, v_tour.table_numbers, v_tour.format = 'double_ko', coalesce(v_tour.playoff_size, 2));
  end if;

  perform tournament_assign_free_tables(p_tournament_id);

  update tournaments set status = 'running', started_at = now() where id = p_tournament_id
    returning * into v_tour;

  return v_tour;
end;
$function$;

create or replace function public.tournament_cancel_start(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann den Start rückgängig machen.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier läuft nicht (mehr).'; end if;
  if exists (select 1 from tournament_matches where tournament_id = p_tournament_id and match_id is not null) then
    raise exception 'Der Start kann nicht mehr rückgängig gemacht werden - es wurde bereits mindestens ein Spiel gemeldet.';
  end if;
  delete from tournament_matches where tournament_id = p_tournament_id;
  update tournaments set status = 'registration', started_at = null where id = p_tournament_id;
end;
$function$;

create or replace function public.tournament_mark_no_show(
  p_tournament_match_id uuid, p_absent_player_ids uuid[], p_technical_winner_id uuid default null
) returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_tour tournaments;
  v_absent_count int;
  v_present uuid;
  v_loser uuid;
  v_row matches;
  v_next tournament_matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.is_bye then raise exception 'Dieses Match ist ein Freilos.'; end if;
  if v_tm.match_id is not null then raise exception 'Für dieses Match wurde bereits ein Ergebnis gemeldet.'; end if;
  if v_tm.player1_id is null or v_tm.player2_id is null then
    raise exception 'Die Paarung für dieses Match steht noch nicht fest.';
  end if;

  select * into v_tour from tournaments where id = v_tm.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann ein Nichterscheinen melden.';
  end if;
  if v_tour.status <> 'running' then raise exception 'Dieses Turnier ist nicht aktiv.'; end if;

  v_absent_count := coalesce(array_length(p_absent_player_ids, 1), 0);
  if v_absent_count < 1 or v_absent_count > 2 then
    raise exception 'Bitte einen oder beide Spieler als abwesend markieren.';
  end if;
  if exists (select 1 from unnest(p_absent_player_ids) pid where pid not in (v_tm.player1_id, v_tm.player2_id)) then
    raise exception 'Ungültige Spielerauswahl für dieses Match.';
  end if;

  if v_absent_count = 1 then
    v_loser := p_absent_player_ids[1];
    v_present := case when v_loser = v_tm.player1_id then v_tm.player2_id else v_tm.player1_id end;
  else
    if p_technical_winner_id is null or p_technical_winner_id not in (v_tm.player1_id, v_tm.player2_id) then
      raise exception 'Bitte einen technischen Aufsteiger für dieses Match auswählen.';
    end if;
    v_present := p_technical_winner_id;
    v_loser := case when p_absent_player_ids[1] = p_technical_winner_id then p_absent_player_ids[2] else p_absent_player_ids[1] end;
  end if;

  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id, walkover)
  values (
    v_tm.player1_id, v_tm.player2_id,
    case when v_tm.player1_id = v_present then 1 else 0 end,
    case when v_tm.player2_id = v_present then 1 else 0 end,
    v_tour.discipline, v_me, false, v_tour.id, v_absent_count = 2
  )
  returning * into v_row;

  update tournament_matches set match_id = v_row.id where id = p_tournament_match_id;
  perform tournament_assign_free_tables(v_tour.id);
  update matches set confirmed = true, confirmed_by = v_me where id = v_row.id;

  -- Kaskade: der tatsaechlich ausgeschiedene/verlierende Spieler (beim
  -- doppelten Nichterscheinen NICHT der technische Aufsteiger) verliert
  -- automatisch auch alle WEITEREN, dadurch bereits bekannten offenen
  -- Partien - bis keine mehr uebrig ist.
  loop
    select * into v_next from tournament_matches
      where tournament_id = v_tour.id and match_id is null and coalesce(is_bye, false) = false
        and player1_id is not null and player2_id is not null
        and (player1_id = v_loser or player2_id = v_loser)
      limit 1;
    exit when not found;

    v_present := case when v_next.player1_id = v_loser then v_next.player2_id else v_next.player1_id end;
    insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed, tournament_id, walkover)
    values (
      v_next.player1_id, v_next.player2_id,
      case when v_next.player1_id = v_present then 1 else 0 end,
      case when v_next.player2_id = v_present then 1 else 0 end,
      v_tour.discipline, v_me, false, v_tour.id, false
    )
    returning * into v_row;

    update tournament_matches set match_id = v_row.id where id = v_next.id;
    perform tournament_assign_free_tables(v_tour.id);
    update matches set confirmed = true, confirmed_by = v_me where id = v_row.id;
  end loop;
end;
$function$;
