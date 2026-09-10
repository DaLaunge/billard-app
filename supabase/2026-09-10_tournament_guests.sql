-- Gast-Spieler in Turnieren (Nutzer-Feedback): manche Leute wollen die App
-- nicht installieren/nutzen, sollen aber trotzdem an einem Turnierabend
-- teilnehmen koennen, ohne dass die Turnierleitung das Turnier deswegen
-- abbrechen/neu anlegen muss. Ein Gast ist technisch ein ganz normaler
-- players-Datensatz OHNE auth_user_id (dieses Muster existiert im Bestand
-- bereits fuer mehrere echte Mitglieder ohne Login) - Turnierbaum-Auslosung,
-- Spielrunden, Turnierleitungs-Meldung (tournament_organizer_report_match,
-- immer schon organizer-gemeldet+bestaetigt, braucht also nie eine Aktion
-- der Gast-Person selbst) funktionieren dafuer bereits unveraendert. Neu
-- noetig: (1) ein eigenes is_guest-Flag zur Unterscheidung vom "Ghost"
-- (Trainingspartner, siehe is_ghost - bewusst NICHT wiederverwendet, der
-- Ghost ist ein einzelner geteilter Platzhalter ohne eigene Identitaet,
-- waehrend jeder Gast eine eigene Person mit eigenem Namen/eigener Historie
-- ist), (2) eine Organisator-RPC, die Anlegen + Turnier-Anmeldung in einem
-- Schritt erledigt, (3) der Ausschluss von Gast-Matches aus rebuild_elo()
-- ("Die Spiele gegen Gaeste kommen nicht ins Ranking" - Nutzer-Zitat) -
-- betrifft JEDES Match mit einer Gast-Beteiligung, nicht nur Turniermatches,
-- damit ein normal gemeldetes Match gegen dieselbe Gast-Person (falls die
-- players-Zeile ausserhalb eines Turniers weiterverwendet wird) ebenso
-- ausgenommen bleibt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.players add column if not exists is_guest boolean not null default false;

-- tournament_organizer_add_guest(): legt eine neue Gast-Person an (nur
-- Name, kein Login) und meldet sie im selben Schritt fuer das Turnier an -
-- dieselben Rechte-/Status-Pruefungen wie tournament_organizer_add_players().
create or replace function public.tournament_organizer_add_guest(p_tournament_id uuid, p_nickname text)
returns players
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
  v_nick text := trim(coalesce(p_nickname, ''));
  v_guest players;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann Gäste hinzufügen.';
  end if;
  if v_tour.status <> 'setup' then raise exception 'Gäste können nur während der Anmeldephase hinzugefügt werden.'; end if;
  if v_nick = '' then raise exception 'Name fehlt.'; end if;

  begin
    insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
  exception when unique_violation then
    raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
  end;

  insert into tournament_players (tournament_id, player_id) values (p_tournament_id, v_guest.id);
  return v_guest;
end;
$function$;

-- rebuild_elo(): identisch zur bisherigen Version, nur die Match-Auswahl je
-- Disziplin bekommt einen zusaetzlichen Ausschluss fuer Matches mit
-- Gast-Beteiligung (Einzel: player1_id/player2_id, Doppel zusaetzlich
-- player1b_id/player2b_id) - diese Matches zaehlen fuers Turnier/die
-- Ergebnis-Historie ganz normal, beeinflussen aber kein Rating.
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
        and not exists (
          select 1 from players p
          where p.id in (matches.player1_id, matches.player2_id, matches.player1b_id, matches.player2b_id)
            and p.is_guest
        )
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
