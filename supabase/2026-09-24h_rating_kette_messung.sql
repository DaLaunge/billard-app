-- KEINE Migration: Messung der Rating-Kette, zweiter Teil (nach 24f).
-- Aendert NICHTS dauerhaft: endet immer mit RAISE EXCEPTION, alles wird
-- zurueckgerollt. Ergebnis steht in der Fehlermeldung ("MESSUNG ...").
--
-- 24f hat jede Funktion einmal gemessen (rebuild_elo alt 780 ms,
-- snapshot_ratings 197 ms, compute_badges 401 ms, compute_tournament_badges
-- 68 ms). Die Lese-Anteile von snapshot_ratings brauchen read-only nur ~10 ms,
-- die Einzelabfragen von compute_badges je 5-15 ms. Offen ist, wie viel davon
-- einmalige Kosten pro Verbindung sind (plpgsql kompilieren, Plaene erstellen,
-- Katalog laden) und wie viel bei jedem Aufruf anfaellt. Deshalb laeuft die
-- Kette hier ZWEIMAL; Durchlauf 2 entspricht einer warmen Pool-Verbindung.
-- snapshot_ratings wird zusaetzlich Statement fuer Statement gemessen.

do $mess$
declare
  t0 timestamptz;
  msg text := '';
  pass int;
  fn text;
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_ratings'));

  for pass in 1 .. 2 loop
    msg := msg || ' || Durchlauf ' || pass || ':';
    foreach fn in array array['rebuild_elo', 'snapshot_ratings', 'compute_badges',
                              'compute_tournament_badges', 'compute_opponent_streak_badges',
                              'compute_streak_badges'] loop
      t0 := clock_timestamp();
      execute format('select public.%I()', fn);
      msg := msg || ' ' || fn || '=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
    end loop;

    -- snapshot_ratings, Statement 1 (Upsert heutiger Punkt), inline
    t0 := clock_timestamp();
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
    msg := msg || ' snap_upsert=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';

    -- snapshot_ratings, Statement 2 (Raenge), inline
    t0 := clock_timestamp();
    update rating_snapshots s set rank = sub.rnk
    from (select player_id, discipline, rank() over (partition by discipline order by rating desc) as rnk
          from rating_snapshots where snap_date = current_date and not provisional) sub
    where s.player_id = sub.player_id and s.snap_date = current_date and s.discipline = sub.discipline;
    msg := msg || ' snap_rank=' || round(extract(epoch from clock_timestamp() - t0) * 1000) || 'ms';
  end loop;

  raise exception 'MESSUNG%', msg;
end
$mess$;
