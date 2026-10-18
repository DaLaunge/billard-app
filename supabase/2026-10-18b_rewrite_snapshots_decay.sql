-- Tages-Snapshots der Vergangenheit nach der neuen Verfallsregel neu berechnen
-- (Folge von 2026-10-18_decay_only_above_500.sql, die NUR heute und die Anker
-- neu schrieb). Ohne diesen Schritt springt die Entwicklungs-Grafik beim
-- Uebergang um ~7 Punkte und alte Raenge stammen aus der alten Rechnung.
--
-- Je (Tag, Spieler, Disziplin): letzter Anker mit anchor_at::date <= Tag, Verfall
-- wie snapshot_ratings() (nur ueber 500, 30 Tage Frist, 200 Tage Halbwertszeit),
-- provisional = games < 10, rank = rank() unter allen nicht vorlaeufigen Zeilen
-- desselben Tages und derselben Disziplin. Es werden nur vorhandene Snapshot-
-- Zeilen aktualisiert, keine neuen angelegt. Heute bleibt unberuehrt.
-- Nach dem Einspielen reicht ein App-Neuladen (snapshotCache CACHE_VERSION 2).
--
-- Test, dann Produktion. Idempotent.

with have as (
  select snap_date as d, player_id, discipline from rating_snapshots where snap_date < current_date
),
calc as (
  select h.d, h.player_id, h.discipline, l.games < 10 as prov,
         round(case when l.rating > 500
                    then 500 + (l.rating - 500) * power(0.5, greatest(0, (h.d - l.anchor_at::date) - 30) / 200.0)
                    else l.rating end, 1) as neu
  from have h
  cross join lateral (
    select a.anchor_at, a.rating, a.games
    from elo_anchors a
    where a.player_id = h.player_id and a.discipline = h.discipline and a.anchor_at::date <= h.d
    order by a.anchor_at desc limit 1
  ) l
),
rk as (
  select c.*, case when c.prov then null
                   else rank() over (partition by c.d, c.discipline, c.prov order by c.neu desc)::int end as r
  from calc c
)
update rating_snapshots s
   set rating = rk.neu, provisional = rk.prov, rank = rk.r
  from rk
 where s.snap_date = rk.d and s.player_id = rk.player_id and s.discipline = rk.discipline
   and (s.rating is distinct from rk.neu or s.provisional is distinct from rk.prov or s.rank is distinct from rk.r);
