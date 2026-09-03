-- Rangverlaufs-Snapshots (rating_snapshots) bisher nur fuer "Gesamt" -
-- jetzt fuer alle Disziplinen, MIT vollem Punkteverfall bei Inaktivitaet
-- (nicht nur der aktuelle Live-Wert). Ersetzt den ersten, einfacheren
-- Entwurf (der elo_anchors unangetastet gelassen und fuer die
-- Einzeldisziplinen nur den Live-Wert ohne Verfall gespeichert haette).
--
-- elo_anchors hatte bisher genau eine Zeile pro Spieler (nach jedem
-- bestaetigten Match ueberschrieben) und wurde nur fuer disc='Gesamt'
-- befuellt - daher konnte snapshot_ratings() den Punkteverfall bisher
-- auch nur fuer Gesamt nachbilden. Jetzt bekommt elo_anchors eine
-- discipline-Spalte und rebuild_elo() schreibt fuer JEDE Disziplin einen
-- eigenen Anker (Rating direkt nach dem letzten Match dieser Disziplin,
-- Zeitpunkt=played_at) - snapshot_ratings() kann den Verfall damit exakt
-- so wie bisher bei Gesamt fuer alle Disziplinen einzeln berechnen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.
--
-- Fix (nach einem fehlgeschlagenen ersten Versuch): der neue Constraint
-- auf elo_anchors ist jetzt UNIQUE statt PRIMARY KEY - die Tabelle hat
-- offenbar einen eigenen Surrogat-Primaerschluessel (z.B. "id"), ein
-- zweiter PRIMARY KEY ist in Postgres nicht erlaubt ("multiple primary
-- keys"). Ein SQL-Editor-Lauf ist eine Transaktion - bei einem Fehler
-- wird alles zurueckgerollt, ein Fehlschlag hinterlaesst also keine
-- halb angewendete Aenderung.

-- 1) elo_anchors um discipline erweitern. Bestehende Zeilen sind alle
--    Gesamt (bisher einzige geschriebene Disziplin), daher als Default
--    fuer den Backfill.
alter table public.elo_anchors add column if not exists discipline text;
update public.elo_anchors set discipline = 'Gesamt' where discipline is null;
alter table public.elo_anchors alter column discipline set not null;
alter table public.elo_anchors alter column discipline set default 'Gesamt';

-- 2) Den bisherigen Unique-/Primary-Key auf (player_id, anchor_at) durch
--    (player_id, discipline, anchor_at) ersetzen - der alte Key wuerde
--    sonst zwei Disziplinen mit demselben Match-Zeitpunkt (z.B. Gesamt +
--    8 Ball fuer dasselbe Match) faelschlich als Duplikat behandeln.
--    Name des alten Constraints wird dynamisch gesucht (egal wie er
--    genau heisst), damit hier nichts geraten werden muss.
do $$
declare
  cn text;
begin
  select con.conname into cn
  from pg_constraint con
  where con.conrelid = 'public.elo_anchors'::regclass
    and con.contype in ('p', 'u')
    and array_length(con.conkey, 1) = 2
    and (
      select count(*) from pg_attribute
      where attrelid = con.conrelid and attnum = any(con.conkey)
        and attname in ('player_id', 'anchor_at')
    ) = 2
  limit 1;
  if cn is not null then
    execute format('alter table public.elo_anchors drop constraint %I', cn);
  end if;
end $$;

do $$
begin
  -- UNIQUE statt PRIMARY KEY: elo_anchors hat vermutlich einen eigenen
  -- Surrogat-Primärschlüssel (z.B. "id") - ein zweiter PRIMARY KEY ist in
  -- Postgres nicht erlaubt ("multiple primary keys"). UNIQUE reicht fuer
  -- ON CONFLICT (player_id, discipline, anchor_at) völlig aus.
  alter table public.elo_anchors
    add constraint elo_anchors_player_disc_anchor_key unique (player_id, discipline, anchor_at);
exception when duplicate_object then
  null; -- existiert schon (z.B. bei erneutem Ausfuehren dieses Skripts)
end $$;

-- 3) rebuild_elo(): Anker jetzt fuer JEDE Disziplin schreiben (vorher
--    nur "if disc = 'Gesamt' then ...") - alles andere 1:1 unveraendert
--    zur bisherigen Definition (siehe von dir bereitgestellter Quellcode).
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
        if la is not null then ra := 500 + (ra-500)*power(0.5, greatest(0, extract(epoch from (m.played_at-la))/86400.0 - GRACE)/HALF); end if;
        if lb is not null then rb := 500 + (rb-500)*power(0.5, greatest(0, extract(epoch from (m.played_at-lb))/86400.0 - GRACE)/HALF); end if;

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

        if la  is not null then ra  := 500 + (ra -500)*power(0.5, greatest(0, extract(epoch from (m.played_at-la ))/86400.0 - GRACE)/HALF); end if;
        if la2 is not null then ra2 := 500 + (ra2-500)*power(0.5, greatest(0, extract(epoch from (m.played_at-la2))/86400.0 - GRACE)/HALF); end if;
        if lb  is not null then rb  := 500 + (rb -500)*power(0.5, greatest(0, extract(epoch from (m.played_at-lb ))/86400.0 - GRACE)/HALF); end if;
        if lb2 is not null then rb2 := 500 + (rb2-500)*power(0.5, greatest(0, extract(epoch from (m.played_at-lb2))/86400.0 - GRACE)/HALF); end if;

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
           500 + (e.rating - 500) * power(0.5, greatest(0, extract(epoch from (now() - e.last_at))/86400.0 - GRACE)/HALF),
           e.games, e.games < 10, now()
    from est e;
  end loop;
end;
$function$;

-- 4) snapshot_ratings(): jetzt EIN einheitlicher Pfad fuer alle
--    Disziplinen (vorher zwei getrennte, Gesamt mit Verfall + Rest ohne) -
--    holt pro Spieler+Disziplin den juengsten Anker und wendet denselben
--    Verfall wie bisher bei Gesamt an.
create or replace function public.snapshot_ratings()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
  select a.player_id, current_date, to_char(now(), 'IYYY-"W"IW'), a.discipline,
         round(500 + (a.rating - 500)
               * power(0.5, greatest(0, (current_date - a.anchor_at::date) - 30) / 200.0), 1),
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

-- 5) Einmalig sofort ausfuehren, damit elo_anchors + der heutige
--    Snapshot fuer alle Disziplinen nicht erst beim naechsten Match
--    bzw. beim naechsten taeglichen Cron-Lauf entstehen.
select public.rebuild_elo();
select public.snapshot_ratings();
