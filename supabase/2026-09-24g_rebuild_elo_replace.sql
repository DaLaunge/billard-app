-- Schnellere Rating-Neuberechnung, Schritt 2 von 2: rebuild_elo() umstellen.
--
-- ERST AUSFUEHREN, wenn 2026-09-24f_rebuild_elo_messung.sql im selben Projekt
-- "ERGEBNIS IDENTISCH" gemeldet hat. Voraussetzung: 2026-09-24e.
--
-- rebuild_elo() bekommt den Rumpf von rebuild_elo_v2() (Berechnung in
-- elo_anchor_rows(), elo_anchors nur noch als Differenz geschrieben), der
-- Zwischenname rebuild_elo_v2 verschwindet wieder. Name und Signatur bleiben,
-- daher aendert sich an den Aufrufern nichts - trg_rebuild_ratings(),
-- admin_refresh_stats() und nightly_refresh() halten weiterhin die
-- Advisory-Sperre aus 2026-09-24d, bevor sie rebuild_elo() aufrufen.
--
-- Die bisherige Fassung steht in 2026-09-16c_winner_stays_ties_count_in_elo.sql;
-- zum Zuruecksetzen deren "create or replace function public.rebuild_elo()"
-- erneut ausfuehren. elo_anchor_rows() kann dann bleiben (wird nicht mehr
-- aufgerufen, schadet nicht).
--
-- Test, dann Produktion. Idempotent.

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

  -- elo_anchors: nur die Differenz schreiben
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
    -- ::text, damit auch eine andere Darstellung (1.5 vs 1.50) als Aenderung zaehlt
    where elo_anchors.rating::text is distinct from excluded.rating::text
       or elo_anchors.games is distinct from excluded.games;

  -- ratings: Endstand = letzter Anker je (Spieler, Disziplin), verfallen bis jetzt
  delete from ratings where true;
  insert into ratings (player_id, discipline, rating, games_played, provisional, updated_at)
  select distinct on (n.p, n.d) n.p, n.d,
         500 + (n.r - 500) * power(0.5::float8, (greatest(0, extract(epoch from (now() - n.t))/86400.0 - GRACE)/HALF)::float8)::numeric,
         n.g, n.g < 10, now()
  from unnest(a_p, a_d, a_t, a_r, a_g) as n(p, d, t, r, g)
  order by n.p, n.d, n.t desc;
end;
$function$;

drop function if exists public.rebuild_elo_v2();
