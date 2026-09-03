-- Bug: power(0.5, x) mit numeric-Operanden rechnet in Postgres nicht als
-- Fliesskommazahl, sondern behaelt beliebig viele exakte Nachkommastellen.
-- Da rebuild_elo() diese Verfallsformel verkettet (jede Zeile baut per
-- "ra := 500 + (ra-500)*power(...)" auf dem vorherigen ra auf), wächst die
-- Nachkommastellen-Zahl mit JEDEM Match club-weit um ~20 Stellen weiter -
-- nachgemessen: Match 1 = 124 Stellen, Match 169 = 3684 Stellen. Der Wert
-- selbst bleibt zwar korrekt (rundet sauber, z.B. auf 562.4), aber jede
-- Zeile in elo_anchors/ratings blaeht sich unbegrenzt auf, und rebuild_elo()
-- (komplette Neuberechnung bei JEDER Match-Bestaetigung) wird mit der Zeit
-- spuerbar langsamer.
--
-- Fix: power() ueber float8 statt numeric rechnen (Ergebnis wird ohnehin nur
-- auf 500 Basis addiert und spaeter auf 1 Nachkommastelle gerundet
-- angezeigt - die ~15 signifikanten Stellen von float8 sind mehr als genug)
-- und erst danach zurueck nach numeric casten. Betrifft rebuild_elo()
-- (Einzel- und Doppel-Zweig, sowie den finalen ratings-Insert) und
-- snapshot_ratings() (defensiv, falls a.rating je wieder aufgeblaeht sein
-- sollte).
--
-- rebuild_elo() rechnet bei jedem Aufruf die komplette Historie aus den
-- rohen matches neu (delete+insert von elo_anchors) - die bereits
-- aufgeblaehten Altwerte verschwinden also automatisch, sobald diese
-- Funktion einmal mit der neuen Formel laeuft (siehe Aufruf ganz unten).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

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
      where confirmed and score1 <> score2
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

create or replace function public.snapshot_ratings()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
  select a.player_id, current_date, to_char(now(), 'IYYY-"W"IW'), a.discipline,
         round(500 + (a.rating - 500)
               * power(0.5::float8, (greatest(0, (current_date - a.anchor_at::date) - 30) / 200.0)::float8)::numeric, 1),
         null, a.games < 10, current_date
  from (
    select distinct on (player_id, discipline) player_id, discipline, anchor_at, rating, games
    from elo_anchors order by player_id, discipline, anchor_at desc
  ) a
  on conflict (player_id, snap_date, discipline)
  do update set rating = excluded.rating, provisional = excluded.provisional,
                iso_week = excluded.iso_week, taken_on = excluded.taken_on;

  update rating_snapshots s set rank = sub.rnk
  from (select player_id, discipline, rank() over (partition by discipline order by rating desc) as rnk
        from rating_snapshots where snap_date = current_date and not provisional) sub
  where s.player_id = sub.player_id and s.snap_date = current_date and s.discipline = sub.discipline;
end;
$function$;

-- Sofort mit der neuen Formel neu rechnen, damit die bereits aufgeblaehten
-- Werte in elo_anchors/ratings verschwinden.
select public.rebuild_elo();
select public.snapshot_ratings();
