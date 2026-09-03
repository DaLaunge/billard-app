-- Read-only Postgres-Rolle fuer Claude: kann nur SELECT, niemals INSERT/
-- UPDATE/DELETE/DDL - im Gegensatz zum anon-Key umgeht sie RLS (sieht
-- also auch Tabellen wie elo_anchors) und kann Funktions-Quellcode lesen
-- (pg_get_functiondef), aber sie kann NICHTS schreiben. Ausfuehrung der
-- eigentlichen SQL-Skripte bleibt weiterhin manuell durch dich.
--
-- WICHTIG: Ersetze 'REPLACE_WITH_STRONG_PASSWORD' vor dem Ausfuehren durch
-- ein selbst gewaehltes, starkes Passwort (z.B. per Passwort-Generator).
-- Das Passwort landet NICHT in diesem Repo - trag es nur direkt im
-- Supabase SQL-Editor ein und gib mir danach nur die fertige
-- Connection-String separat (nicht per Commit).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - fuer beide separat, mit JEWEILS EIGENEM Passwort.

do $$
begin
  create role claude_reader login password 'REPLACE_WITH_STRONG_PASSWORD';
exception when duplicate_object then
  raise notice 'Rolle claude_reader existiert schon - Passwort ggf. mit ALTER ROLE claude_reader WITH PASSWORD ''...''; aendern.';
end $$;

grant usage on schema public to claude_reader;
grant select on all tables in schema public to claude_reader;
alter default privileges in schema public grant select on tables to claude_reader;

-- Sicherheitshalber explizit: keine Schreibrechte, keine Funktionsausfuehrung.
revoke insert, update, delete, truncate on all tables in schema public from claude_reader;
revoke execute on all functions in schema public from claude_reader;
-- pg_get_functiondef() selbst ist eine System-Funktion und bleibt lesbar -
-- die REVOKE-Zeile betrifft nur die APP-eigenen Funktionen (rebuild_elo(),
-- snapshot_ratings(), ...), die claude_reader ohnehin nie AUSFUEHREN,
-- sondern nur ihren Quellcode LESEN koennen soll (via
-- "select pg_get_functiondef('rebuild_elo'::regproc);" - das ist ein
-- SELECT, kein EXECUTE des Funktionskoerpers selbst).
