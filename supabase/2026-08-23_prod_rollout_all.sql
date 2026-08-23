-- Gesamt-Rollout fuers PRODUKTIONS-Supabase-Projekt (wofsutwidaitloeiwnma).
-- Fasst alle bisher nur im Test-Projekt (hadamdvpnwslztsxmwdr) eingespielten
-- Skripte vom 2026-08-23 zusammen, jeweils schon mit den korrigierten
-- Emojis - die zwei separaten Fix-Skripte fuer die Kollisionen sind hier
-- nicht mehr noetig.
--
-- In EINEM Rutsch im Supabase SQL-Editor (Produktionsprojekt) ausfuehren.
-- Alles ist idempotent (if not exists / or replace / on conflict do
-- nothing) - ein versehentliches zweites Ausfuehren schadet nicht.
-- In eine explizite Transaktion gepackt, damit bei einem Fehler wirklich
-- alles zurückgerollt wird (die "Statements laufen doch nicht als eine
-- Transaktion"-Falle aus dem Test-Lauf, siehe unten).
--
-- ANNAHME: Die 7 Emoji-Fixes am Ende (ghost5/peak600/ghost25/disc1/
-- comeback/ghost1000/matches100) gehen davon aus, dass der Produktions-
-- Katalog dieselben vorbestehenden Dopplungen hat wie das Testprojekt
-- (gleiche Seed-Daten, gleiche App). Das kann ich nicht verifizieren, da
-- ich keinen Zugriff aufs Produktionsprojekt habe. Die UPDATEs setzen die
-- Emojis unabhaengig vom bisherigen Wert fest auf den korrekten Endstand,
-- sind also auch dann sicher, wenn dort zufaellig schon ein anderer Wert
-- stand - nur falls diese sieben badge_keys dort NICHT existieren, laufen
-- die UPDATEs einfach ins Leere (kein Fehler).

begin;

-- ============================================================
-- 1) Herausforderungen (Challenges) - Tabelle, RLS, RPCs, Trigger
-- ============================================================

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
-- Freischalten (player_badges-Eintrag) haengt weiterhin von eurer
-- bestehenden Neuberechnungs-Funktion ab, die separat erweitert werden
-- muesste - hier wird der Erfolg nur sichtbar/anzeigbar gemacht.
insert into badge_catalog (badge_key, category, sort, emoji, name, description) values
  ('challenge_accepted_1', 'Treue', 900, '🥊', 'Angenommen', '1 Herausforderung angenommen'),
  ('challenge_accepted_5', 'Treue', 901, '🪓', 'Kampflustig', '5 Herausforderungen angenommen'),
  ('challenge_accepted_15', 'Treue', 902, '🏹', 'Gladiator', '15 Herausforderungen angenommen')
on conflict (badge_key) do nothing;

-- ============================================================
-- 2) badge_catalog oeffentlich lesbar machen
-- ============================================================
-- Nur Erfolgs-Definitionen (Emoji/Name/Beschreibung/Kategorie), keine
-- Nutzerdaten. Schreibrechte bleiben unveraendert.

alter table public.badge_catalog enable row level security;

drop policy if exists "badge_catalog_select_public" on public.badge_catalog;
create policy "badge_catalog_select_public" on public.badge_catalog
  for select using (true);

-- ============================================================
-- 3) Vorbestehende Emoji-Dopplungen bereinigen
-- ============================================================
-- Mehrere Erfolgs-Familien haben eine Emoji-Eskalation (Serien, Riesen-
-- toeter, Zu-Null, Schnitt, Koenig) - die bleibt unangetastet, nur das
-- jeweils nicht dazugehoerige Badge bekommt ein neues Emoji.

update badge_catalog set emoji = '🕸️' where badge_key = 'ghost5';       -- war 🎯 (Kollision mit streak3)
update badge_catalog set emoji = '🛰️' where badge_key = 'peak600';      -- war 🚀 (Kollision mit streak7)
update badge_catalog set emoji = '🧟' where badge_key = 'ghost25';      -- war 🧊 (Kollision mit shutout)
update badge_catalog set emoji = '🔬' where badge_key = 'disc1';        -- war 🎳 (Kollision mit tb1)
update badge_catalog set emoji = '🌅' where badge_key = 'comeback';     -- war 📈 (Kollision mit avg3)
update badge_catalog set emoji = '🧿' where badge_key = 'ghost1000';    -- war 👑 (Kollision mit king4)
update badge_catalog set emoji = '🪪' where badge_key = 'matches100';   -- war 🎱 (Kollision mit avg1)

commit;

-- Danach zur Kontrolle ausfuehren - sollte leer zurueckkommen:
-- select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
--   from badge_catalog group by emoji having count(*) > 1;
