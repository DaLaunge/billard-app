-- Einmaliger Backfill: rating_snapshots fuer alle Disziplinen rueckwirkend
-- fuellen. Seit dem letzten Skript enthaelt elo_anchors fuer JEDE
-- Disziplin einen Anker pro tatsaechlich gespieltem Match (anchor_at =
-- played_at) - die komplette Match-Historie steckt also bereits drin.
-- Dieses Skript wendet fuer jeden Tag seit dem allerersten Match denselben
-- Verfalls-Ansatz an, den snapshot_ratings() sonst nur fuer "heute"
-- rechnet: pro Tag und Disziplin wird der juengste Anker VOR/AN diesem
-- Tag genommen und mit der ueblichen Formel bis zu diesem Tag verfallen
-- gelassen. So entsteht ein durchgehender Verlauf statt nur eines
-- einzelnen heutigen Punkts pro Einzeldisziplin.
--
-- Ueberschreibt bestehende Gesamt-Snapshots mit demselben Ergebnis (nur
-- dieselbe Formel nochmal angewendet) - aendert dort nichts, ergaenzt
-- aber Tage VOR dem Start des taeglichen Snapshot-Crons.
--
-- Einmalig auszufuehren, in Supabase SQL-Editor. Test und Produktion
-- sind getrennte Supabase-Projekte (Test: hadamdvpnwslztsxmwdr,
-- Produktion: wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN
-- separat laufen. Sicher erneut ausfuehrbar (nur Upserts).

do $$
declare
  d date;
  min_d date;
  max_d date := current_date - 1; -- heute liefert der normale taegliche Lauf
begin
  select min(anchor_at)::date into min_d from elo_anchors;
  if min_d is null then return; end if;

  for d in select generate_series(min_d, max_d, interval '1 day')::date loop
    insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
    select a.player_id, d, to_char(d, 'IYYY-"W"IW'), a.discipline,
           round(500 + (a.rating - 500)
                 * power(0.5, greatest(0, (d - a.anchor_at::date) - 30) / 200.0), 1),
           null, a.games < 10, d
    from (
      select distinct on (player_id, discipline) player_id, discipline, anchor_at, rating, games
      from elo_anchors
      where anchor_at::date <= d
      order by player_id, discipline, anchor_at desc
    ) a
    on conflict (player_id, snap_date, discipline)
    do update set rating = excluded.rating, provisional = excluded.provisional,
                  iso_week = excluded.iso_week, taken_on = excluded.taken_on;

    update rating_snapshots s set rank = sub.rnk
    from (select player_id, discipline, rank() over (partition by discipline order by rating desc) as rnk
          from rating_snapshots where snap_date = d and not provisional) sub
    where s.player_id = sub.player_id and s.snap_date = d and s.discipline = sub.discipline;
  end loop;
end $$;
