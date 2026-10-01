-- Optionale Zusatzzaehler pro Match: Fluke, Runout, Scratch, Foul.
--
-- Eigene Tabelle statt einer Spalte an matches: matches_rebuild_ratings feuert
-- bei JEDEM INSERT/UPDATE/DELETE auf matches und berechnet alle Ratings neu
-- (~1 s, serialisiert ueber den Advisory Lock). Die Zaehler duerfen das
-- Rating weder beruehren noch verteuern, und ein nachtraegliches Setzen der
-- Zaehler waere sonst ein zweiter kompletter Neuaufbau pro gemeldetem Match.
--
-- counters (jsonb): {"fluke":[a,b], "runout":[a,b], "scratch":[a,b], "foul":[a,b]}
--   Index 0 = die MELDENDE Seite (matches.reported_by, im Doppel deren Team),
--   Index 1 = die andere Seite. Nicht score1/score2: bei Turnierpartien steht
--   die meldende Person nicht immer auf Platz 1 der Partie.
--   Fehlende Schluessel = nicht gezaehlt. Werte ganze Zahlen 0..99.
--
-- Geschrieben wird nur ueber set_match_counters() - direkt nach dem Melden, durch
-- die meldende Person. Lesen duerfen alle angemeldeten Mitglieder (wie matches).
-- Die App liest die Tabelle noch nicht; sie ist die Grundlage fuer eine spaetere
-- Statistik.

create table if not exists public.match_counters (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  counters   jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.match_counters enable row level security;

drop policy if exists match_counters_select on public.match_counters;
create policy match_counters_select on public.match_counters
  for select to authenticated using (true);

-- Seit 2026-10-30 vergibt Supabase fuer neue public-Tabellen keine Rechte mehr
-- automatisch (siehe CLAUDE.md, Known gotchas).
grant select on public.match_counters to authenticated;
grant select, insert, update, delete on public.match_counters to service_role;

create or replace function public.set_match_counters(p_match_id uuid, p_counters jsonb)
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me  uuid;
  v_rep uuid;
  k     text;
  i     integer;
  n     numeric;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  select reported_by into v_rep from matches where id = p_match_id;
  if v_me is null or v_rep is null or v_rep <> v_me then
    raise exception 'Nur die meldende Person darf Zusatzzähler setzen.';
  end if;

  if p_counters is null or jsonb_typeof(p_counters) <> 'object' then
    raise exception 'Ungültige Zusatzzähler.';
  end if;

  for k in select jsonb_object_keys(p_counters) loop
    if k not in ('fluke', 'runout', 'scratch', 'foul') then
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

  insert into match_counters (match_id, counters)
  values (p_match_id, p_counters)
  on conflict (match_id) do update set counters = excluded.counters, updated_at = now();
end;
$function$;

revoke all on function public.set_match_counters(uuid, jsonb) from public, anon;
grant execute on function public.set_match_counters(uuid, jsonb) to authenticated;
