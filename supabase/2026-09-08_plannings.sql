-- Planung: voraussichtliche Verfuegbarkeit fuer die Zukunft (im Unterschied
-- zu "Live" = jetzt gerade). In Supabase SQL-Editor ausfuehren. Test und
-- Produktion sind getrennte Supabase-Projekte (Test: hadamdvpnwslztsxmwdr,
-- Produktion: wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat
-- laufen: zuerst Test, und erst wenn das Feature auf main geht, auch in
-- Produktion.
--
-- Konzept: ein Spieler traegt ein, an welchem zukuenftigen Tag er
-- voraussichtlich Zeit hat (plus optionaler freier Hinweistext, z.B.
-- "bin flexibel, meldet euch") - bewusst kein festes Zeitfenster, das ist
-- ja gerade der Punkt (grobe Verfuegbarkeit statt muehsamer Terminfindung).
-- Andere Spieler koennen darauf reagieren, indem sie sich mit optionaler
-- Nachricht eintragen ("Bin interessiert") - mehrere Personen koennen auf
-- dieselbe Planung reagieren, alle Reaktionen sind fuer alle sichtbar.
-- Gleicher Aufbau/Muster wie pings/ping_replies, nur mit einem Datum statt
-- einer Stundenzahl: hier duerfen (anders als bei Pings) mehrere Eintraege
-- pro Spieler gleichzeitig bestehen (z.B. Donnerstag UND Samstag), daher
-- kein UNIQUE(player_id) und create_planning loescht auch nichts Bestehendes.
-- Eine Planung verschwindet automatisch am Tag NACH dem geplanten Datum
-- (expires_at), genau wie Pings ueber expires_at gefiltert werden - kein
-- Cron noetig.

create table if not exists public.plannings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  planned_date date not null,
  message text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.planning_replies (
  id uuid primary key default gen_random_uuid(),
  planning_id uuid not null references public.plannings(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  message text,
  created_at timestamptz not null default now(),
  unique (planning_id, player_id)
);

create index if not exists plannings_player_idx on public.plannings(player_id);
create index if not exists plannings_planned_date_idx on public.plannings(planned_date);
create index if not exists planning_replies_planning_idx on public.planning_replies(planning_id);

alter table public.plannings enable row level security;
alter table public.planning_replies enable row level security;

drop policy if exists mitglieder_lesen_plannings on public.plannings;
create policy mitglieder_lesen_plannings on public.plannings for select to authenticated using (true);

drop policy if exists mitglieder_lesen_planning_replies on public.planning_replies;
create policy mitglieder_lesen_planning_replies on public.planning_replies for select to authenticated using (true);

-- Kein Insert/Update/Delete fuer normale Nutzer per RLS - laeuft
-- ausschliesslich ueber die SECURITY DEFINER-Funktionen unten (gleiches
-- Muster wie create_ping / reply_ping / close_ping / unreply_ping).

create or replace function public.create_planning(p_planned_date date, p_message text default null)
returns public.plannings
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
  v_row public.plannings;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if p_planned_date < current_date then
    raise exception 'Das Datum darf nicht in der Vergangenheit liegen.';
  end if;
  if p_planned_date > current_date + 120 then
    raise exception 'Das Datum darf hoechstens 120 Tage in der Zukunft liegen.';
  end if;
  if char_length(coalesce(p_message, '')) > 120 then
    raise exception 'Nachricht darf hoechstens 120 Zeichen haben.';
  end if;

  insert into plannings (player_id, planned_date, message, expires_at)
  values (v_me, p_planned_date, nullif(trim(coalesce(p_message, '')), ''),
          (p_planned_date + 1)::timestamptz)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.close_planning(p_planning_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from plannings where id = p_planning_id and player_id = current_player_id();
end;
$$;

create or replace function public.reply_planning(p_planning_id uuid, p_message text default null)
returns public.planning_replies
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := current_player_id();
  v_planning public.plannings;
  v_row public.planning_replies;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  select * into v_planning from plannings where id = p_planning_id;
  if not found or v_planning.expires_at <= now() then
    raise exception 'Diese Planung ist nicht mehr aktiv.';
  end if;
  if v_planning.player_id = v_me then
    raise exception 'Auf die eigene Planung kannst du nicht antworten.';
  end if;
  if char_length(coalesce(p_message, '')) > 120 then
    raise exception 'Nachricht darf hoechstens 120 Zeichen haben.';
  end if;

  insert into planning_replies (planning_id, player_id, message)
  values (p_planning_id, v_me, nullif(trim(coalesce(p_message, '')), ''))
  on conflict (planning_id, player_id)
  do update set message = excluded.message, created_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.unreply_planning(p_planning_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from planning_replies
  where planning_id = p_planning_id and player_id = current_player_id();
end;
$$;
