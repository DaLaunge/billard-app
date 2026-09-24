-- Match-Abgleich mit Pruefsumme (Ergaenzung zu 2026-09-24_match_delta_sync.sql).
--
-- matches_sync(p_since) liefert in EINEM Aufruf:
--   rows    - Matches mit updated_at >= p_since (gleiche Felder/Form wie die
--             bisherige Delta-Abfrage in src/lib/matchCache.js)
--   deleted - geloeschte Match-IDs seit p_since
--   count   - Anzahl ALLER Matches
--   hash    - SHA-256 ueber alle Match-IDs, nach id sortiert, mit ',' verbunden
--
-- Warum eine Funktion statt mehrerer Abfragen: eine STABLE-Funktion sieht
-- waehrend ihrer ganzen Ausfuehrung denselben Datenbank-Stand (den Snapshot
-- der aufrufenden Abfrage). Aenderungen und Pruefsumme passen dadurch immer
-- zusammen - ein Match, das genau waehrend des Abgleichs gemeldet wird, fehlt
-- in BEIDEN und kommt beim naechsten Abgleich. Gleichzeitige Meldungen vieler
-- Spieler loesen so nie einen unnoetigen Neuabgleich aus. Weicht die Pruefsumme
-- trotzdem ab, ist wirklich etwas verloren gegangen, und die App repariert
-- gezielt (nur die ID-Liste + fehlende Zeilen, nicht alles).
--
-- Sortierung nach dem uuid-Typ (Byte-Reihenfolge), NICHT nach id::text: eine
-- Text-Sortierung haengt von der Collation ab und koennte Bindestriche anders
-- behandeln als der einfache Zeichenvergleich im Browser.
--
-- SECURITY INVOKER (Standard): es gelten die normalen Leserechte (RLS) auf
-- matches/deleted_matches, genau wie bei den bisherigen Abfragen.
--
-- In Test UND Produktion ausfuehren. Idempotent. Ohne diese Funktion arbeitet
-- die App wie bisher (Delta ohne Pruefsumme).

create or replace function public.matches_sync(p_since timestamptz)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at)
      from (
        select m.id, m.played_at, m.score1, m.score2, m.high_run1, m.high_run2, m.discipline,
               m.confirmed, m.reported_by, m.player1_id, m.player2_id, m.player1b_id, m.player2b_id,
               m.run_log, m.tournament_id, m.winner_stays_session_id, m.manual_entry_note, m.updated_at,
               (select jsonb_build_object('name', t.name, 'format', t.format, 'organizer_id', t.organizer_id)
                  from tournaments t where t.id = m.tournament_id) as tournament,
               (select jsonb_build_object('name', w.name, 'is_doubles', w.is_doubles)
                  from winner_stays_sessions w where w.id = m.winner_stays_session_id) as winner_stays_session
        from matches m
        where m.updated_at >= p_since
      ) x), '[]'::jsonb),
    'deleted', coalesce((
      select jsonb_agg(jsonb_build_object('match_id', d.match_id, 'deleted_at', d.deleted_at))
      from deleted_matches d
      where d.deleted_at >= p_since), '[]'::jsonb),
    'count', (select count(*) from matches),
    'hash', (select encode(sha256(convert_to(coalesce(string_agg(id::text, ',' order by id), ''), 'UTF8')), 'hex')
             from matches)
  );
$function$;

revoke all on function public.matches_sync(timestamptz) from public, anon;
grant execute on function public.matches_sync(timestamptz) to authenticated;
