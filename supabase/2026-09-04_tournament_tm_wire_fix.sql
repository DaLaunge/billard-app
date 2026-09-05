-- Bug in 2026-09-04_tournament_double_ko_byes.sql: tm_wire()s vierter
-- Parameter war als "smallint" deklariert, aber lb_pair()/generate_double_
-- ko_losers() rufen ihn immer mit einem literalen 1 oder 2 auf - so ein
-- Integer-Literal wird von Postgres als "integer" typisiert, und von
-- integer zu smallint gibt es fuer FUNKTIONSAUFRUFE (anders als bei
-- Spalten-Zuweisungen per UPDATE ... SET) keinen impliziten Cast. Ergebnis
-- live beim Anlegen eines Doppel-K.O.-Turniers: "function tm_wire(uuid,
-- boolean, uuid, integer) does not exist".
--
-- Fix: p_slot auf "integer" verbreitern (passt zu den Aufrufstellen,
-- next_slot/loser_next_slot bleiben smallint-Spalten - integer -> smallint
-- ist beim Zuweisen per UPDATE weiterhin problemlos erlaubt). Da sich der
-- Parametertyp aendert, muss die alte Funktion zuerst explizit gedroppt
-- werden (sonst legt "create or replace" nur eine zweite, ungenutzte
-- Überladung an statt die kaputte zu ersetzen).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

drop function if exists public.tm_wire(uuid, boolean, uuid, smallint);

create or replace function public.tm_wire(p_id uuid, p_via_loser boolean, p_target uuid, p_slot integer)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_via_loser then
    update tournament_matches set loser_next_match_id = p_target, loser_next_slot = p_slot where id = p_id;
  else
    update tournament_matches set next_match_id = p_target, next_slot = p_slot where id = p_id;
  end if;
end;
$function$;

revoke execute on function public.tm_wire(uuid, boolean, uuid, integer) from public, anon, authenticated;
