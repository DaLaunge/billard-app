-- Nutzer-Feedback: "winner stays ist der einzige Modus, in dem ein
-- Unentschieden eingegeben werden kann. Implementiere das auch." - bei
-- jedem anderen Modus ist ein Unentschieden serverseitig unmoeglich (jede
-- report_*-RPC lehnt score1 = score2 direkt ab, "Unentschieden gibt es
-- beim Billard nicht."). Bei Winner Stays kann trotzdem ein Unentschieden
-- ENTSTEHEN, weil winner_stays_aggregate_session() pro Zweier-Paarung alle
-- Einzelracks der Session aufsummiert (siehe 2026-09-10b) - z.B. 4:4, wenn
-- zwei Leute in derselben Runde mehrfach gegeneinander gespielt und sich
-- die Racks am Ende genau die Waage gehalten haben. Jedes einzelne Rack
-- selbst kann weiterhin nie unentschieden enden (winner_stays_report_game()
-- lehnt das unveraendert ab) - nur die SUMME kann zufaellig gleich werden.
--
-- rebuild_elo() (siehe 2026-09-10_tournament_guests.sql) filtert bisher
-- generell "score1 <> score2" heraus, weil das in jedem anderen Modus ein
-- unmoegliches/kaputtes Match waere. Fuer Winner-Stays-Matches ist ein
-- Unentschieden aber ein legitimes, tatsaechlich gespieltes Ergebnis (z.B.
-- 8 real gespielte Racks bei 4:4) - das faellt bisher trotzdem komplett aus
-- dem Rating, obwohl es in Produktion mehrfach vorkommt (bestaetigt per
-- SELECT: 5 Matches mit winner_stays_session_id gesetzt und score1=score2).
-- Fix: das Match zaehlt in rebuild_elo() jetzt auch bei score1=score2 mit,
-- SOFERN es aus Winner Stays stammt (winner_stays_session_id is not null) -
-- fuer alle anderen Matches bleibt der Ausschluss unveraendert (dort kann
-- score1=score2 ohnehin nie vorkommen, die Bedingung ist dort ein No-Op).
-- Ein Unentschieden ist fuer die Elo-Formel selbst kein Sonderfall: der
-- tatsaechliche Punkteanteil a1/n wird dann exakt 0.5, was der ueblichen
-- Definition eines Remis im Elo-System entspricht - keine Formel-Aenderung
-- noetig, nur der Filter.
--
-- snapshot_ratings() (Rating-Verlauf) liest ausschliesslich aus
-- elo_anchors und braucht deshalb keine eigene Anpassung - profitiert
-- automatisch vom hier korrigierten rebuild_elo().
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

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
      where confirmed and (score1 <> score2 or winner_stays_session_id is not null) and not walkover
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

-- Sofort neu berechnen, damit die bereits existierenden Winner-Stays-
-- Unentschieden retroaktiv mitgezaehlt werden (nicht erst beim naechsten
-- bestaetigten Match, das den ohnehin bestehenden Trigger ausloest).
select public.rebuild_elo();
