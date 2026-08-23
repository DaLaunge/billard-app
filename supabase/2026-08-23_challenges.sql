-- Herausforderungen (Challenges)
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen: zuerst Test, und erst wenn
-- das Feature auf main geht, auch in Produktion.
--
-- Konzept: Spieler A fordert Spieler B heraus ("offen"). Es gibt keinen
-- expliziten Annahme-Schritt - sobald A und B ein bestaetigtes Match
-- gegeneinander eintragen, wird die offene Herausforderung automatisch
-- als "erledigt" markiert. B kann eine offene Herausforderung auch
-- ablehnen, A kann sie zurueckziehen. Herausforderungen laufen nach
-- 14 Tagen ab (werden dafuer nicht aktiv "expired" gesetzt, sondern beim
-- Anzeigen/Zaehlen anhand von expires_at herausgefiltert - kein Cron noetig).

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.players(id) on delete cascade,
  challenged_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'fulfilled', 'cancelled', 'declined')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  resolved_at timestamptz,
  resolved_match_id uuid references public.matches(id) on delete set null,
  constraint challenges_not_self check (challenger_id <> challenged_id)
);

create index if not exists challenges_challenger_idx on public.challenges(challenger_id);
create index if not exists challenges_challenged_idx on public.challenges(challenged_id);

alter table public.challenges enable row level security;

drop policy if exists "challenges_select_own" on public.challenges;
create policy "challenges_select_own" on public.challenges
  for select using (
    challenger_id in (select id from public.players where auth_user_id = auth.uid())
    or challenged_id in (select id from public.players where auth_user_id = auth.uid())
  );

-- Kein Insert/Update fuer normale Nutzer per RLS - laeuft ausschliesslich
-- ueber die SECURITY DEFINER-Funktionen unten (gleiches Muster wie
-- create_ping / reply_ping etc.).

create or replace function public.create_challenge(p_challenged_id uuid)
returns public.challenges
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_row public.challenges;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;
  if v_me = p_challenged_id then
    raise exception 'Du kannst dich nicht selbst herausfordern.';
  end if;

  select * into v_row from challenges
    where challenger_id = v_me and challenged_id = p_challenged_id
      and status = 'open' and expires_at > now();
  if found then
    return v_row;
  end if;

  insert into challenges (challenger_id, challenged_id)
    values (v_me, p_challenged_id)
    returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.cancel_challenge(p_challenge_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  update challenges set status = 'cancelled', resolved_at = now()
    where id = p_challenge_id and challenger_id = v_me and status = 'open';
  if not found then
    raise exception 'Herausforderung nicht gefunden oder nicht deine.';
  end if;
end;
$$;

create or replace function public.decline_challenge(p_challenge_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  update challenges set status = 'declined', resolved_at = now()
    where id = p_challenge_id and challenged_id = v_me and status = 'open';
  if not found then
    raise exception 'Herausforderung nicht gefunden oder nicht deine.';
  end if;
end;
$$;

-- Automatisches Erfuellen: sobald ein Einzel-Match zwischen den beiden
-- Spielern bestaetigt wird (confirmed = true), wird eine offene, noch
-- nicht abgelaufene Herausforderung zwischen ihnen als "fulfilled" markiert.
create or replace function public.fulfill_challenges_on_match()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.confirmed is distinct from true then
    return new;
  end if;
  if new.player1b_id is not null then
    return new; -- Doppel: keine automatische Zuordnung
  end if;
  update challenges
    set status = 'fulfilled', resolved_at = now(), resolved_match_id = new.id
    where status = 'open'
      and expires_at > now()
      and ((challenger_id = new.player1_id and challenged_id = new.player2_id)
        or (challenger_id = new.player2_id and challenged_id = new.player1_id));
  return new;
end;
$$;

drop trigger if exists trg_fulfill_challenges on public.matches;
create trigger trg_fulfill_challenges
  after insert or update of confirmed on public.matches
  for each row execute function public.fulfill_challenges_on_match();

-- Katalog-Eintraege fuer den neuen Erfolg "Herausforderungen angenommen".
-- WICHTIG: Das macht den Erfolg nur sichtbar (Live-Zaehler in der Erfolge-
-- Ansicht funktioniert damit sofort). Ob ihn ein Spieler tatsaechlich
-- "freischaltet" (Eintrag in player_badges), haengt von eurer bestehenden
-- Neuberechnungs-Funktion ab ("Erfolge neu berechnen" im Adminbereich) -
-- die kenne ich nicht und muesste separat um diese drei badge_keys
-- erweitert werden. sort-Werte ggf. an eure bestehende Nummerierung anpassen.
insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('challenge_accepted_1', 'Treue', 900, '⚔️', 'Angenommen', '1 Herausforderung angenommen'),
  ('challenge_accepted_5', 'Treue', 901, '🗡️', 'Kampflustig', '5 Herausforderungen angenommen'),
  ('challenge_accepted_15', 'Treue', 902, '🏹', 'Gladiator', '15 Herausforderungen angenommen')
on conflict (badge_key) do nothing;
