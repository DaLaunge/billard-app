-- Punkteverfall nur noch von oben (Nutzer-Wunsch 2026-10-18).
--
-- Problem: Der Verfall zog jedes inaktive Rating nach 30 Tagen Richtung 500 -
-- bei Spielern UNTER 500 ist das ein Zuwachs. Wer bewusst pausierte, stieg
-- also im Ranking (Taktik schwaecherer Spieler).
-- Neu: Verfall wirkt nur bei Rating > 500 (sinkt wie bisher Richtung 500).
-- Ein Rating <= 500 bleibt waehrend der Pause unveraendert.
--
-- Geaendert: elo_anchor_rows() (Verfall zwischen Matches), rebuild_elo()
-- (Endstand "bis jetzt"), snapshot_ratings() (Tagesstand), und die View
-- rangliste bekommt am Ende die Spalte "ruhend" (kein bestaetigtes Match seit
-- 60 Tagen; Doppel-Partner zaehlen mit). Die App listet ruhende Spieler nicht
-- mehr in der Rating-Rangliste, "aktiv" (180 Tage) bleibt fuer Gegnerlisten.
--
-- Vergangene Tages-Snapshots (rating_snapshots) werden NICHT umgeschrieben;
-- die Entwicklungs-Grafik behaelt ihre Historie, neue Tage kommen mit der
-- neuen Regel. Daher kein CACHE_VERSION-Bump.
--
-- Test, dann Produktion. Idempotent.

create or replace function public.elo_anchor_rows()
 returns table (player_id uuid, discipline text, anchor_at timestamptz, rating numeric, games int)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  K     constant numeric := 4;
  GRACE constant numeric := 30;
  HALF  constant numeric := 200;
  m record;
  d int; dn text;
  n int; nf numeric; ea numeric; delta numeric;
  sh int; a1 int; a2 int;
  s1 int; s2 int; s3 int; s4 int;
  ra numeric; rb numeric; ga int; gb int; la timestamptz; lb timestamptz;
  ra2 numeric; rb2 numeric; ga2 int; gb2 int; la2 timestamptz; lb2 timestamptz;
  tA numeric; tB numeric;
  -- Stand je Slot = (Disziplin, Spieler); Slot = dx * Spielerzahl + Spielerindex + 1.
  -- dx: 0 = Gesamt, 1 = Doppel, 2.. = Einzel-Disziplinen. games null = noch nie gespielt
  -- (entspricht "not found" im alten est-Temp-Table).
  st_r numeric[] := '{}'; st_g int[] := '{}'; st_t timestamptz[] := '{}';
  sl_p uuid[] := '{}'; sl_d text[] := '{}';
  -- Anker in Verarbeitungsreihenfolge
  o_s int[] := '{}'; o_t timestamptz[] := '{}'; o_r numeric[] := '{}'; o_g int[] := '{}';
begin
  for m in
    with pl as (select p.id, (row_number() over (order by p.id))::int - 1 as ix from players p),
         -- dieselben Einzel-Disziplinen wie die alte Disziplin-Liste; 'Gesamt'/'Doppel'
         -- als Einzel-Disziplinname bzw. null fielen dort in keinen Einzel-Durchlauf
         dl as (select x.d, (row_number() over (order by x.d))::int + 1 as dx
                from (select distinct mm.discipline as d from matches mm
                      where mm.confirmed and mm.player1b_id is null
                        and mm.discipline is not null and mm.discipline not in ('Gesamt', 'Doppel')) x)
    select mt.played_at, mt.score1, mt.score2, (mt.player1b_id is not null) as dbl,
           mt.player1_id, mt.player2_id, mt.player1b_id, mt.player2b_id, mt.discipline,
           c.np, p1.ix as i1, p2.ix as i2, p1b.ix as i1b, p2b.ix as i2b,
           case when mt.player1b_id is not null then 1 else dl.dx end as dx
    from matches mt
    cross join (select count(*)::int as np from players) c
    join pl p1 on p1.id = mt.player1_id
    join pl p2 on p2.id = mt.player2_id
    left join pl p1b on p1b.id = mt.player1b_id
    left join pl p2b on p2b.id = mt.player2b_id
    left join dl on dl.d = mt.discipline and mt.player1b_id is null
    where mt.confirmed and (mt.score1 <> mt.score2 or mt.winner_stays_session_id is not null) and not mt.walkover
      and not exists (
        select 1 from players p
        where p.id in (mt.player1_id, mt.player2_id, mt.player1b_id, mt.player2b_id)
          and p.is_guest
      )
    order by mt.played_at, mt.id
  loop
    sh := greatest(0, -least(m.score1, m.score2));
    a1 := m.score1 + sh; a2 := m.score2 + sh;
    n  := a1 + a2;
    nf := least(n, 16);

    -- jeder Match zaehlt fuer Gesamt und zusaetzlich fuer seine Disziplin bzw. Doppel
    foreach d in array case when m.dx is null then array[0] else array[0, m.dx] end loop
      dn := case d when 0 then 'Gesamt' when 1 then 'Doppel' else m.discipline end;

      if not m.dbl then
        s1 := d * m.np + m.i1 + 1;
        s2 := d * m.np + m.i2 + 1;
        ga := st_g[s1]; if ga is null then ra := 500; ga := 0; la := null; else ra := st_r[s1]; la := st_t[s1]; end if;
        gb := st_g[s2]; if gb is null then rb := 500; gb := 0; lb := null; else rb := st_r[s2]; lb := st_t[s2]; end if;
        if la is not null and ra > 500 then ra := 500 + (ra-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-la))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb is not null and rb > 500 then rb := 500 + (rb-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-lb))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;

        ea := 1.0 / (1.0 + power(2.0, (rb - ra) / 100.0));
        delta := K * nf * (a1::numeric / n - ea);
        ra := ra + delta; rb := rb - delta;

        st_r[s1] := ra; st_g[s1] := ga+1; st_t[s1] := m.played_at; sl_p[s1] := m.player1_id; sl_d[s1] := dn;
        st_r[s2] := rb; st_g[s2] := gb+1; st_t[s2] := m.played_at; sl_p[s2] := m.player2_id; sl_d[s2] := dn;

        o_s := o_s || s1 || s2;
        o_t := o_t || m.played_at || m.played_at;
        o_r := o_r || ra || rb;
        o_g := o_g || (ga+1) || (gb+1);

      else
        s1 := d * m.np + m.i1  + 1;
        s2 := d * m.np + m.i1b + 1;
        s3 := d * m.np + m.i2  + 1;
        s4 := d * m.np + m.i2b + 1;
        ga  := st_g[s1]; if ga  is null then ra  := 500; ga  := 0; la  := null; else ra  := st_r[s1]; la  := st_t[s1]; end if;
        ga2 := st_g[s2]; if ga2 is null then ra2 := 500; ga2 := 0; la2 := null; else ra2 := st_r[s2]; la2 := st_t[s2]; end if;
        gb  := st_g[s3]; if gb  is null then rb  := 500; gb  := 0; lb  := null; else rb  := st_r[s3]; lb  := st_t[s3]; end if;
        gb2 := st_g[s4]; if gb2 is null then rb2 := 500; gb2 := 0; lb2 := null; else rb2 := st_r[s4]; lb2 := st_t[s4]; end if;

        if la  is not null and ra  > 500 then ra  := 500 + (ra -500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-la ))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if la2 is not null and ra2 > 500 then ra2 := 500 + (ra2-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-la2))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb  is not null and rb  > 500 then rb  := 500 + (rb -500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-lb ))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb2 is not null and rb2 > 500 then rb2 := 500 + (rb2-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-lb2))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;

        tA := (ra + ra2) / 2.0;
        tB := (rb + rb2) / 2.0;
        ea := 1.0 / (1.0 + power(2.0, (tB - tA) / 100.0));
        delta := K * nf * (a1::numeric / n - ea);
        ra := ra + delta; ra2 := ra2 + delta;
        rb := rb - delta; rb2 := rb2 - delta;

        -- Schreibreihenfolge wie die UPDATEs der alten Funktion
        st_r[s1] := ra;  st_g[s1] := ga +1; st_t[s1] := m.played_at; sl_p[s1] := m.player1_id;  sl_d[s1] := dn;
        st_r[s2] := ra2; st_g[s2] := ga2+1; st_t[s2] := m.played_at; sl_p[s2] := m.player1b_id; sl_d[s2] := dn;
        st_r[s3] := rb;  st_g[s3] := gb +1; st_t[s3] := m.played_at; sl_p[s3] := m.player2_id;  sl_d[s3] := dn;
        st_r[s4] := rb2; st_g[s4] := gb2+1; st_t[s4] := m.played_at; sl_p[s4] := m.player2b_id; sl_d[s4] := dn;

        o_s := o_s || s1 || s2 || s3 || s4;
        o_t := o_t || m.played_at || m.played_at || m.played_at || m.played_at;
        o_r := o_r || ra || ra2 || rb || rb2;
        o_g := o_g || (ga+1) || (ga2+1) || (gb+1) || (gb2+1);
      end if;
    end loop;
  end loop;

  -- gleicher Schluessel mehrfach (zwei Matches mit identischem played_at):
  -- der zuletzt verarbeitete gewinnt, wie beim alten ON CONFLICT DO UPDATE
  return query
    select distinct on (u.s, u.t) sl_p[u.s], sl_d[u.s], u.t, u.r, u.g
    from unnest(o_s, o_t, o_r, o_g) with ordinality as u(s, t, r, g, ord)
    order by u.s, u.t, u.ord desc;
end;
$function$;

revoke execute on function public.elo_anchor_rows() from public, anon, authenticated;
grant execute on function public.elo_anchor_rows() to service_role;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_read_only_user') then
    grant execute on function public.elo_anchor_rows() to supabase_read_only_user;
  end if;
end $$;

create or replace function public.rebuild_elo()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  GRACE constant numeric := 30;
  HALF  constant numeric := 200;
  a_p uuid[]; a_d text[]; a_t timestamptz[]; a_r numeric[]; a_g int[];
begin
  -- Aufrufer halten pg_advisory_xact_lock(hashtext('rebuild_ratings')), siehe 2026-09-24d
  select coalesce(array_agg(x.player_id), '{}'), coalesce(array_agg(x.discipline), '{}'),
         coalesce(array_agg(x.anchor_at), '{}'), coalesce(array_agg(x.rating), '{}'),
         coalesce(array_agg(x.games), '{}')
    into a_p, a_d, a_t, a_r, a_g
  from elo_anchor_rows() x;

  delete from elo_anchors e
  where not exists (
    select 1 from unnest(a_p, a_d, a_t) as n(p, d, t)
    where n.p = e.player_id and n.d = e.discipline and n.t = e.anchor_at
  );

  insert into elo_anchors (player_id, discipline, anchor_at, rating, games)
  select n.p, n.d, n.t, n.r, n.g
  from unnest(a_p, a_d, a_t, a_r, a_g) as n(p, d, t, r, g)
  on conflict (player_id, discipline, anchor_at) do update
    set rating = excluded.rating, games = excluded.games
    where elo_anchors.rating::text is distinct from excluded.rating::text
       or elo_anchors.games is distinct from excluded.games;

  -- ratings: Endstand = letzter Anker je (Spieler, Disziplin); Verfall nur von oben
  delete from ratings where true;
  insert into ratings (player_id, discipline, rating, games_played, provisional, updated_at)
  select distinct on (n.p, n.d) n.p, n.d,
         case when n.r > 500
              then 500 + (n.r - 500) * power(0.5::float8, (greatest(0, extract(epoch from (now() - n.t))/86400.0 - GRACE)/HALF)::float8)::numeric
              else n.r end,
         n.g, n.g < 10, now()
  from unnest(a_p, a_d, a_t, a_r, a_g) as n(p, d, t, r, g)
  order by n.p, n.d, n.t desc;
end;
$function$;

create or replace function public.snapshot_ratings()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
  select a.player_id, current_date, to_char(now(), 'IYYY-"W"IW'), a.discipline,
         round(case when a.rating > 500
                    then 500 + (a.rating - 500)
                         * power(0.5, greatest(0, (current_date - a.anchor_at::date) - 30) / 200.0)
                    else a.rating end, 1),
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

-- View: neue Spalte "ruhend" am Ende (create or replace erlaubt nur Anhaengen)
create or replace view public.rangliste as
 SELECT r.discipline,
    p.nickname,
    round(r.rating)::integer AS rating,
    r.games_played AS spiele,
    r.provisional AS vorlaeufig,
    lm.letzte_partie::date AS letzte_partie,
    COALESCE(lm.letzte_partie > (now() - '180 days'::interval), false) AS aktiv,
    NOT COALESCE(lm.letzte_partie > (now() - '60 days'::interval), false) AS ruhend
   FROM ratings r
     JOIN players p ON p.id = r.player_id
     LEFT JOIN LATERAL ( SELECT max(m.played_at) AS letzte_partie
           FROM matches m
          WHERE m.confirmed
            AND r.player_id IN (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id)
            AND (r.discipline IN ('Gesamt', 'Doppel') OR m.discipline = r.discipline)) lm ON true
  ORDER BY r.discipline, r.provisional, r.rating DESC;

-- Neu rechnen
select pg_advisory_xact_lock(hashtext('rebuild_ratings'));
select public.rebuild_elo();
select public.snapshot_ratings();
