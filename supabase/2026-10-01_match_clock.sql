-- Spieldauer pro Match aus der Uhr im Ergebnis-Schritt (widgets/MatchClock.jsx).
--
-- net_ms   = reine Spielzeit OHNE Pausen (Zeit, in der die Uhr lief)
-- total_ms = Dauer MIT Pausen (net_ms + angehaltene Zeit)
--
-- Eigene Tabelle (wie match_counters): jedes UPDATE auf matches loest einen
-- kompletten Rating-Neuaufbau aus (~1 s) - die Dauer darf das nie verteuern.
-- Kein Eintrag = Dauer unbekannt (aeltere Matches, Ghost, Uhr nie gelaufen).
-- Geschrieben nur ueber set_match_clock(), direkt nach dem Melden, von der
-- meldenden Person. Lesen duerfen alle angemeldeten Mitglieder.

create table if not exists public.match_clock (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  net_ms     integer not null check (net_ms >= 0),
  total_ms   integer not null check (total_ms >= net_ms),
  updated_at timestamptz not null default now()
);

alter table public.match_clock enable row level security;

drop policy if exists match_clock_select on public.match_clock;
create policy match_clock_select on public.match_clock
  for select to authenticated using (true);

-- Seit 2026-10-30 keine automatischen Rechte mehr auf neue public-Tabellen.
grant select on public.match_clock to authenticated;
grant select, insert, update, delete on public.match_clock to service_role;

create or replace function public.set_match_clock(p_match_id uuid, p_net_ms bigint, p_total_ms bigint)
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me  uuid;
  v_rep uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  select reported_by into v_rep from matches where id = p_match_id;
  if v_me is null or v_rep is null or v_rep <> v_me then
    raise exception 'Nur die meldende Person darf die Spieldauer setzen.';
  end if;
  -- Plausibilitaet: 0 bis 24 h, mit Pausen nie kuerzer als ohne.
  if p_net_ms is null or p_total_ms is null or p_net_ms < 0 or p_total_ms < p_net_ms or p_total_ms > 86400000 then
    raise exception 'Ungültige Spieldauer.';
  end if;

  insert into match_clock (match_id, net_ms, total_ms)
  values (p_match_id, p_net_ms, p_total_ms)
  on conflict (match_id) do update set net_ms = excluded.net_ms, total_ms = excluded.total_ms, updated_at = now();
end;
$function$;

revoke all on function public.set_match_clock(uuid, bigint, bigint) from public, anon;
grant execute on function public.set_match_clock(uuid, bigint, bigint) to authenticated;
