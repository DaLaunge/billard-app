-- Echte Ratings je Disziplin UND Spielart: zu den bisherigen Staenden kommen je Disziplin zwei weitere.
--
-- Bisher gab es je Disziplin nur ein Rating aus den EINZEL-Matches ('8 Ball', '9 Ball', ...). Doppel zaehlte nur
-- fuer 'Doppel' (alle Disziplinen zusammen) und 'Gesamt'. Damit liess sich die Statistik bei gewaehlter Disziplin
-- nicht nach Einzel/Doppel/Beides aufteilen. Jetzt fuehrt die Engine, fuer jede Disziplin D:
--   'D'          Einzel-Matches in D (wie bisher, Name unveraendert)
--   'Doppel:D'   Doppel-Matches in D
--   'Gesamt:D'   Einzel UND Doppel in D zusammen
-- zusaetzlich zu 'Gesamt', 'Einzel' und 'Doppel' (alle Disziplinen) wie bisher. Gleiche Formel, K/Anfaenger-K und
-- Verfall (ueber 500, 30 Tage nach dem letzten Match in IRGENDEINER Disziplin) fuer jeden Stand. Die neuen Namen
-- enthalten einen Doppelpunkt; der Client blendet sie in Disziplin-Listen aus (siehe isDerivedRating).
--
-- Was die Migration tut:
--   1. elo_anchor_rows() mit den neuen Staenden (Slots: 0 Gesamt, 1 Doppel, 2 Einzel, dann je Disziplin k=1..nd:
--      2+k Einzel, 2+nd+k Doppel, 2+2*nd+k Gesamt-Disziplin). rebuild_elo(), snapshot_ratings() und die View
--      rangliste sind generisch und brauchen keine Aenderung.
--   2. Neu rechnen (Anker, ratings, heutiger Snapshot).
--   3. Rating-Verlauf: fuer alle bisherigen Snapshot-Tage die neuen Zeilen nachtragen (nur fehlende).
-- WICHTIG danach: CACHE_VERSION in src/lib/snapshotCache.js (steht im selben Push), sonst bekommen Geraete die
-- nachgetragenen Tage nicht. Test, dann Produktion. Idempotent. Rechenzeit: pro Match 1-2 Staende mehr.

create or replace function public.elo_anchor_rows()
 returns table (player_id uuid, discipline text, anchor_at timestamptz, rating numeric, games int)
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  K     constant numeric := 4;
  KNEW  constant numeric := 8;   -- Anfaenger-K: erste NEWG Spiele je (Spieler, Disziplin), danach K
  NEWG  constant int := 10;     -- identisch mit der Grenze fuer "vorlaeufig" (games < 10)
  GRACE constant numeric := 30;
  HALF  constant numeric := 200;
  m record;
  d int; dn text;
  n int; nf numeric; ea numeric; delta numeric;
  ka numeric; kb numeric; ka2 numeric; kb2 numeric;
  sh int; a1 int; a2 int;
  s1 int; s2 int; s3 int; s4 int;
  ra numeric; rb numeric; ga int; gb int; la timestamptz; lb timestamptz;
  ra2 numeric; rb2 numeric; ga2 int; gb2 int; la2 timestamptz; lb2 timestamptz;
  tA numeric; tB numeric;
  -- letzter Match des Spielers in IRGENDEINER Disziplin (Slot Gesamt), vor diesem Match gelesen
  o_la timestamptz; o_lb timestamptz; o_la2 timestamptz; o_lb2 timestamptz;
  -- Stand je Slot = (Disziplin, Spieler); Slot = dx * Spielerzahl + Spielerindex + 1.
  -- Klasse d: 0 = Gesamt, 1 = Doppel, 2 = Einzel (alle Disziplinen), 2+k = Einzel in Disziplin k, 2+nd+k = Doppel in k,
  -- 2+2*nd+k = Einzel+Doppel in k. games null = noch nie gespielt
  -- (entspricht "not found" im alten est-Temp-Table).
  st_r numeric[] := '{}'; st_g int[] := '{}'; st_t timestamptz[] := '{}';
  sl_p uuid[] := '{}'; sl_d text[] := '{}';
  -- Anker in Verarbeitungsreihenfolge
  o_s int[] := '{}'; o_t timestamptz[] := '{}'; o_r numeric[] := '{}'; o_g int[] := '{}';
begin
  for m in
    with pl as (select p.id, (row_number() over (order by p.id))::int - 1 as ix from players p),
         -- alle Disziplinen mit mindestens einem bestaetigten Match (Einzel ODER Doppel); 'Gesamt'/'Doppel'/'Einzel'
         -- als Disziplinname fielen schon bisher aus
         dl as (select x.d, (row_number() over (order by x.d))::int as k, (count(*) over ())::int as nd
                from (select distinct mm.discipline as d from matches mm
                      where mm.confirmed and mm.discipline is not null and mm.discipline not in ('Gesamt', 'Doppel', 'Einzel')) x)
    select mt.played_at, mt.score1, mt.score2, (mt.player1b_id is not null) as dbl,
           mt.player1_id, mt.player2_id, mt.player1b_id, mt.player2b_id, mt.discipline,
           c.np, p1.ix as i1, p2.ix as i2, p1b.ix as i1b, p2b.ix as i2b,
           dl.k, dl.nd
    from matches mt
    cross join (select count(*)::int as np from players) c
    join pl p1 on p1.id = mt.player1_id
    join pl p2 on p2.id = mt.player2_id
    left join pl p1b on p1b.id = mt.player1b_id
    left join pl p2b on p2b.id = mt.player2b_id
    left join dl on dl.d = mt.discipline
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
    o_la := st_t[m.i1 + 1]; o_lb := st_t[m.i2 + 1];
    if m.dbl then o_la2 := st_t[m.i1b + 1]; o_lb2 := st_t[m.i2b + 1]; end if;

    -- jeder Match zaehlt fuer Gesamt und Einzel bzw. Doppel (alle Disziplinen) und, wenn er eine Disziplin hat,
    -- fuer deren Staende (Einzel: Einzel + Einzel/Doppel-gesamt; Doppel: Doppel + Einzel/Doppel-gesamt)
    foreach d in array (case when m.dbl
        then array[0, 1] || case when m.k is null then array[]::int[] else array[2 + m.nd + m.k, 2 + 2 * m.nd + m.k] end
        else array[0, 2] || case when m.k is null then array[]::int[] else array[2 + m.k, 2 + 2 * m.nd + m.k] end end) loop
      dn := case when d = 0 then 'Gesamt' when d = 1 then 'Doppel' when d = 2 then 'Einzel'
                 when d <= 2 + m.nd then m.discipline
                 when d <= 2 + 2 * m.nd then 'Doppel:' || m.discipline
                 else 'Gesamt:' || m.discipline end;

      if not m.dbl then
        s1 := d * m.np + m.i1 + 1;
        s2 := d * m.np + m.i2 + 1;
        ga := st_g[s1]; if ga is null then ra := 500; ga := 0; la := null; else ra := st_r[s1]; la := st_t[s1]; end if;
        gb := st_g[s2]; if gb is null then rb := 500; gb := 0; lb := null; else rb := st_r[s2]; lb := st_t[s2]; end if;
        if la is not null and ra > 500 then ra := 500 + (ra-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-o_la))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb is not null and rb > 500 then rb := 500 + (rb-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-o_lb))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;

        ea := 1.0 / (1.0 + power(2.0, (rb - ra) / 100.0));
        delta := nf * (a1::numeric / n - ea);
        ka := case when ga < NEWG then KNEW else K end;
        kb := case when gb < NEWG then KNEW else K end;
        ra := ra + ka * delta; rb := rb - kb * delta;

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

        if la  is not null and ra  > 500 then ra  := 500 + (ra -500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-o_la))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if la2 is not null and ra2 > 500 then ra2 := 500 + (ra2-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-o_la2))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb  is not null and rb  > 500 then rb  := 500 + (rb -500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-o_lb))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;
        if lb2 is not null and rb2 > 500 then rb2 := 500 + (rb2-500)*power(0.5::float8, (greatest(0, extract(epoch from (m.played_at-o_lb2))/86400.0 - GRACE)/HALF)::float8)::numeric; end if;

        tA := (ra + ra2) / 2.0;
        tB := (rb + rb2) / 2.0;
        ea := 1.0 / (1.0 + power(2.0, (tB - tA) / 100.0));
        delta := nf * (a1::numeric / n - ea);
        ka  := case when ga  < NEWG then KNEW else K end;
        ka2 := case when ga2 < NEWG then KNEW else K end;
        kb  := case when gb  < NEWG then KNEW else K end;
        kb2 := case when gb2 < NEWG then KNEW else K end;
        ra := ra + ka * delta; ra2 := ra2 + ka2 * delta;
        rb := rb - kb * delta; rb2 := rb2 - kb2 * delta;

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


revoke execute on function public.elo_anchor_rows() from public, anon, authenticated;
grant execute on function public.elo_anchor_rows() to service_role;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_read_only_user') then
    grant execute on function public.elo_anchor_rows() to supabase_read_only_user;
  end if;
end $$;

-- Neu rechnen: Anker + ratings, dann der heutige Snapshot
select pg_advisory_xact_lock(hashtext('rebuild_ratings'));
select public.rebuild_elo();
select public.snapshot_ratings();

-- Verlauf nachtragen: die neuen Staende ('Doppel:D', 'Gesamt:D') fuer jeden bisherigen Snapshot-Tag und jeden Spieler,
-- der an dem Tag schon einen Stand hatte. Rechnung wie in 2026-10-23b (letzter Anker <= Tag, Verfall nur ueber 500 und
-- erst 30 Tage nach dem letzten Match in irgendeiner Disziplin).
with days as (
  select distinct s.snap_date as d, s.player_id, s.iso_week, s.taken_on
  from rating_snapshots s
  where s.discipline = 'Gesamt' and s.snap_date < current_date
),
names as (
  select distinct a.discipline from elo_anchors a where a.discipline like 'Doppel:%' or a.discipline like 'Gesamt:%'
),
calc as (
  select h.d, h.player_id, h.iso_week, h.taken_on, n.discipline, l.games < 10 as prov,
         round(case when l.rating > 500
                    then 500 + (l.rating - 500) * power(0.5, greatest(0, (h.d - lo.last_any) - 30) / 200.0)
                    else l.rating end, 1) as neu
  from days h
  cross join names n
  cross join lateral (
    select a.anchor_at, a.rating, a.games
    from elo_anchors a
    where a.player_id = h.player_id and a.discipline = n.discipline and a.anchor_at::date <= h.d
    order by a.anchor_at desc limit 1
  ) l
  cross join lateral (
    select max(a2.anchor_at)::date as last_any
    from elo_anchors a2
    where a2.player_id = h.player_id and a2.anchor_at::date <= h.d
  ) lo
),
rk as (
  select c.*, case when c.prov then null
                   else rank() over (partition by c.d, c.discipline, c.prov order by c.neu desc)::int end as r
  from calc c
)
insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
select rk.player_id, rk.d, rk.iso_week, rk.discipline, rk.neu, rk.r, rk.prov, rk.taken_on
from rk
on conflict (player_id, snap_date, discipline) do nothing;
