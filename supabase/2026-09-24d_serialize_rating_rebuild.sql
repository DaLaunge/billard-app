-- Gleichzeitige Match-Meldungen scheitern nicht mehr an der Rating-Neuberechnung.
--
-- Gefunden 2026-09-24 beim Stresstest des Match-Abgleichs: von 5 exakt
-- gleichzeitig gemeldeten Matches scheiterten 3 mit
--   duplicate key value violates unique constraint "ratings_pkey"
-- und wurden NICHT gespeichert (der Spieler sieht "Fehler: ..." und muss
-- erneut speichern). Dasselbe traf Ablehnungen/Loeschungen. Ursache: jede
-- Aenderung an matches loest per Statement-Trigger trg_rebuild_ratings() eine
-- KOMPLETTE Neuberechnung aus - rebuild_elo() leert ratings und schreibt es neu.
-- Zwei Transaktionen, die das gleichzeitig tun, schreiben dieselben Zeilen,
-- und die zweite scheitert am Primaerschluessel. Existiert schon lange, fiel
-- aber erst auf, als gezielt viele Meldungen auf einmal getestet wurden -
-- genau das passiert aber an einem Vereinsabend.
--
-- Fix: eine transaktionsweite Advisory-Sperre am Anfang jedes Aufrufers von
-- rebuild_elo(). Gleichzeitige Neuberechnungen laufen dadurch nacheinander
-- statt gegeneinander; die zweite wartet (Millisekunden bis wenige Sekunden),
-- sieht danach den bereits gespeicherten Stand der ersten und rechnet
-- korrekt weiter. Die Sperre wird mit dem Ende der Transaktion automatisch
-- freigegeben. Die Funktionsruempfe sind ansonsten unveraendert uebernommen
-- (Stand Testprojekt 2026-09-24).
--
-- In Test UND Produktion ausfuehren. Idempotent.

create or replace function public.trg_rebuild_ratings()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_ratings'));  -- siehe Kopfkommentar
  perform rebuild_elo();
  perform snapshot_ratings();     -- heutigen Punkt pro Disziplin schreiben
  perform compute_badges();
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_recruit_badges') then
    perform compute_recruit_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_141_badges') then
    perform compute_141_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_opponent_streak_badges') then
    perform compute_opponent_streak_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_ghost_badges') then
    perform compute_ghost_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_challenge_badges') then
    perform compute_challenge_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_membership_badges') then
    perform compute_membership_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_tournament_badges') then
    perform compute_tournament_badges();
  end if;
  return null;
end;
$function$;

create or replace function public.admin_refresh_stats()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  perform pg_advisory_xact_lock(hashtext('rebuild_ratings'));  -- siehe Kopfkommentar
  perform rebuild_elo();
  perform snapshot_ratings();
  perform compute_badges();
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_recruit_badges') then
    perform compute_recruit_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_141_badges') then
    perform compute_141_badges();
  end if;
  return 'ok';
end;
$function$;

create or replace function public.nightly_refresh()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_ratings'));  -- siehe Kopfkommentar
  perform rebuild_elo();          -- Rangliste (ratings) mit Verfall bis jetzt
  perform snapshot_ratings();     -- Verlauf (snapshots) fuer heute, pro Disziplin
end;
$function$;
