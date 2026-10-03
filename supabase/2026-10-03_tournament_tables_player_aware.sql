-- Nutzer-Feedback: "beim Turniermodus jeder gegen jeden verleitet es die
-- Spieler dazu, manuell nachzutragen. Warum? Koennen wir das besser
-- gestalten?" - Ursache war die Tischzuteilung: tournament_assign_free_tables()
-- vergab freie Tische stur der Reihe nach an die "naechsten" Paarungen
-- (bei Jeder-gegen-jeden haben ALLE Paarungen dasselbe ready_at, die
-- Reihenfolge war also zufaellig) und pruefte nicht, ob die beiden Spieler
-- ueberhaupt frei sind - derselbe Spieler konnte an zwei Tischen gleichzeitig
-- stehen, und die Leute spielten ohnehin, wer gerade frei war. Fuer die
-- tatsaechlich gespielte Paarung gab es dann keinen Tisch und damit kein
-- "Melden" (nur die Turnierleitung konnte nachtragen, ohne Protokoll).
--
-- Client-Teil (Melden ohne Tisch bei Jeder-gegen-jeden) steckt in
-- TurnierMatchActions.jsx (turnierActions(), Parameter `format`) - keine
-- Melde-RPC verlangt serverseitig einen Tisch. Dieses Skript macht die
-- Tischzuteilung spielerbewusst:
--
-- 1) Nie zwei Tische fuer denselben Spieler: Spieler, die schon an einem
--    Tisch stehen (Paarung mit Tisch, noch kein Ergebnis), bekommen keine
--    weitere Paarung zugeteilt, bis die erste gemeldet ist.
-- 2) Bei Jeder-gegen-jeden (Gruppenphase) bekommen zuerst die Paarungen einen
--    Tisch, deren Spieler bisher am wenigsten gespielt haben (statt
--    zufaelliger Reihenfolge), danach ready_at/Runde/Position.
-- 3) Einen zugeteilten, aber nicht gespielten Tisch gibt die Zuteilung
--    wieder frei, sobald einer der beiden Spieler inzwischen eine andere
--    Partie gemeldet hat (neue Spalte table_assigned_at) - sonst blieben
--    Tisch UND beide Spieler fuer die Zuteilung blockiert, obwohl sie laengst
--    woanders gespielt haben (Melden geht ja auch ohne Tisch).
--
-- Fuer K.O./Doppel-K.O. aendert sich praktisch nichts (dort sind Spieler
-- ohnehin immer nur in einer offenen Paarung), die Zuteilung bleibt FIFO.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.tournament_matches add column if not exists table_assigned_at timestamptz;

create or replace function public.tournament_assign_free_tables(p_tournament_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tables int[];
  v_format text;
  v_busy int[];
  v_busy_players uuid[];
  v_free int[];
  v_t int;
  v_cand record;
begin
  select table_numbers, format into v_tables, v_format from tournaments where id = p_tournament_id;
  if coalesce(array_length(v_tables, 1), 0) = 0 then return; end if;

  -- Verwaiste Zuteilung freigeben (nur Jeder-gegen-jeden-Gruppenphase): einer
  -- der beiden Spieler hat nach der Zuteilung eine ANDERE Partie dieses
  -- Turniers gemeldet - er steht nicht mehr am Tisch.
  if v_format = 'round_robin' then
    update tournament_matches tm set table_number = null, table_assigned_at = null
    where tm.tournament_id = p_tournament_id and tm.bracket = 'main'
      and tm.match_id is null and tm.table_number is not null and tm.table_assigned_at is not null
      and exists (
        select 1 from tournament_matches x
        join matches m on m.id = x.match_id
        where x.tournament_id = tm.tournament_id and x.id <> tm.id
          and (x.player1_id in (tm.player1_id, tm.player2_id) or x.player2_id in (tm.player1_id, tm.player2_id))
          and m.played_at > tm.table_assigned_at
      );
  end if;

  -- Ein Tisch gilt als belegt, solange fuer die dortige Partie noch KEIN
  -- Ergebnis gemeldet wurde (match_id is null) - ab Ergebnismeldung ist der
  -- Tisch physisch wieder frei, auch wenn das Ergebnis noch nicht bestaetigt ist.
  select coalesce(array_agg(distinct table_number), array[]::int[]) into v_busy
    from tournament_matches
    where tournament_id = p_tournament_id and table_number is not null and match_id is null;

  select coalesce(array_agg(t), array[]::int[]) into v_free
    from unnest(v_tables) t
    where not (t = any(v_busy));

  if coalesce(array_length(v_free, 1), 0) = 0 then return; end if;

  -- Spieler, die gerade an einem Tisch stehen, bekommen keinen zweiten.
  select coalesce(array_agg(distinct p), array[]::uuid[]) into v_busy_players
    from (
      select player1_id as p from tournament_matches
        where tournament_id = p_tournament_id and table_number is not null and match_id is null
      union all
      select player2_id from tournament_matches
        where tournament_id = p_tournament_id and table_number is not null and match_id is null
    ) s
    where p is not null;

  foreach v_t in array v_free loop
    select tm.id, tm.player1_id, tm.player2_id into v_cand
    from tournament_matches tm
    where tm.tournament_id = p_tournament_id
      and coalesce(tm.is_bye, false) = false and coalesce(tm.void, false) = false
      and tm.player1_id is not null and tm.player2_id is not null
      and tm.match_id is null and tm.table_number is null
      and not (tm.player1_id = any(v_busy_players))
      and not (tm.player2_id = any(v_busy_players))
    order by
      case when v_format = 'round_robin' and tm.bracket = 'main' then (
        select count(*) from tournament_matches x
        where x.tournament_id = tm.tournament_id and x.match_id is not null
          and (x.player1_id in (tm.player1_id, tm.player2_id) or x.player2_id in (tm.player1_id, tm.player2_id))
      ) else 0 end,
      tm.ready_at asc nulls last, tm.round, tm.bracket_position
    limit 1;

    exit when not found;

    update tournament_matches set table_number = v_t, table_assigned_at = now() where id = v_cand.id;
    v_busy_players := v_busy_players || v_cand.player1_id || v_cand.player2_id;
  end loop;
end;
$function$;
