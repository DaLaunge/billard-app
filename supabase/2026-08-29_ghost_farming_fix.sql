-- Verhindert das "Durchklicken" von Ghost-Trainingsspielen (Score knapp
-- eintragen, sofort abschliessen, wiederholen) - damit liessen sich die
-- Ghost-Erfolge (bis 1000 Spiele) beliebig schnell farmen.
--
-- Mindestdauer wird aus dem eingetragenen Ergebnis geschaetzt (siehe
-- src/lib/ghostTiming.js fuer dieselbe Formel client-seitig, dort auch
-- die Begruendung der Zeitwerte): 3 Minuten Grundzeit, +1 Minute pro
-- weiterem Rack bei 8/9/10 Ball, bei 14/1 Endlos ~3 Sekunden pro Punkt
-- (mindestens ebenfalls 3 Minuten). record_ghost_game() lehnt den Aufruf
-- ab, wenn seit dem letzten Ghost-Spiel dieses Spielers nicht genug Zeit
-- vergangen ist - das ist die eigentliche Durchsetzung, unabhaengig davon,
-- ob die Sperre in der App selbst umgangen wird (z. B. direkter RPC-Aufruf).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

alter table public.players add column if not exists last_ghost_game_at timestamptz;

create or replace function public.record_ghost_game(p_discipline text, p_score1 integer, p_score2 integer)
returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  v_last timestamptz;
  v_total integer;
  v_min_seconds integer;
  v_elapsed integer;
begin
  select id, last_ghost_game_at into pid, v_last from players where auth_user_id = auth.uid();
  if pid is null then raise exception 'Kein Spieler zu diesem Login.'; end if;

  v_total := greatest(0, coalesce(p_score1, 0)) + greatest(0, coalesce(p_score2, 0));
  if p_discipline = '14/1 Endlos' then
    v_min_seconds := greatest(180, v_total * 3);
  else
    v_min_seconds := 180 + greatest(0, v_total - 1) * 60;
  end if;

  if v_last is not null then
    v_elapsed := extract(epoch from (now() - v_last));
    if v_elapsed < v_min_seconds then
      raise exception 'Das ging zu schnell fuer ein echtes Training - bitte warte noch % Sekunden.',
        (v_min_seconds - v_elapsed);
    end if;
  end if;

  insert into ghost_games (player_id) values (pid);
  update players set last_ghost_game_at = now() where id = pid;
  perform compute_ghost_badges();
end;
$$;
