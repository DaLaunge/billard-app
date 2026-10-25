-- Zusatzzaehler im Ghost-Training (Fehler und gute Stoesse zaehlen).
--
-- Ghost-Training erzeugt keine Zeile in matches, nur eine in ghost_games (zaehlt fuer die Ghost-Erfolge). Damit die
-- Zaehler aus dem Training (Fluke, Runout, Scratch, Foul + Fehlanstoss, Long Pot, Bandenstoss, Kombination, Karambol) nicht verloren
-- gehen, bekommt ghost_games vier neue, optionale Spalten:
--   discipline, score1, score2   - Disziplin und Ergebnis des Trainings (Grundlage fuer eine spaetere Auswertung)
--   counters (jsonb)             - {"fluke":[a,b], ..., "carom":[a,b]}; Index 0 = der Trainierende, Index 1 = Ghost (immer 0)
-- und record_ghost_game() nimmt einen optionalen Parameter p_counters. Alles andere (Mindestdauer gegen Durchklicken,
-- last_ghost_game_at, Ghost-Erfolge) bleibt wie in 2026-08-29_ghost_farming_fix.sql.
--
-- Die App faellt auf den alten Aufruf (ohne Zaehler) zurueck, solange diese Migration fehlt. Test, dann Produktion.
-- Idempotent. Beruehrt weder matches noch Ratings.

alter table public.ghost_games add column if not exists discipline text;
alter table public.ghost_games add column if not exists score1 integer;
alter table public.ghost_games add column if not exists score2 integer;
alter table public.ghost_games add column if not exists counters jsonb;

-- alte Signatur ersetzen (sonst gaebe es zwei Ueberladungen und PostgREST wuerde bei einem Aufruf ohne p_counters
-- nicht mehr eindeutig aufloesen)
drop function if exists public.record_ghost_game(text, integer, integer);

create or replace function public.record_ghost_game(
  p_discipline text, p_score1 integer, p_score2 integer, p_counters jsonb default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  v_last timestamptz;
  v_total integer;
  v_min_seconds integer;
  v_elapsed integer;
  k text;
  i integer;
  n numeric;
  v_counters jsonb := null;
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

  -- Zaehler pruefen (gleiche Regeln wie set_match_counters, dazu die vier Trainings-Zaehler)
  if p_counters is not null then
    if jsonb_typeof(p_counters) <> 'object' then raise exception 'Ungültige Zusatzzähler.'; end if;
    for k in select jsonb_object_keys(p_counters) loop
      if k not in ('fluke', 'runout', 'scratch', 'foul', 'badbreak', 'longpot', 'bank', 'combo', 'carom') then
        raise exception 'Unbekannter Zusatzzähler: %', k;
      end if;
      if jsonb_typeof(p_counters -> k) <> 'array' or jsonb_array_length(p_counters -> k) <> 2 then
        raise exception 'Zusatzzähler % braucht genau zwei Werte.', k;
      end if;
      for i in 0..1 loop
        if jsonb_typeof(p_counters -> k -> i) <> 'number' then
          raise exception 'Zusatzzähler % hat einen ungültigen Wert.', k;
        end if;
        n := (p_counters -> k ->> i)::numeric;
        if n < 0 or n > 99 or n <> floor(n) then
          raise exception 'Zusatzzähler % muss eine ganze Zahl von 0 bis 99 sein.', k;
        end if;
      end loop;
    end loop;
    v_counters := p_counters;
  end if;

  insert into ghost_games (player_id, discipline, score1, score2, counters)
  values (pid, nullif(trim(p_discipline), ''), p_score1, p_score2, v_counters);
  update players set last_ghost_game_at = now() where id = pid;
  perform compute_ghost_badges();
end;
$$;

revoke all on function public.record_ghost_game(text, integer, integer, jsonb) from public, anon;
grant execute on function public.record_ghost_game(text, integer, integer, jsonb) to authenticated;
