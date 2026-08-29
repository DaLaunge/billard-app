-- Selbstständige Konto-Löschung (DSGVO) + rudimentäres Feedback-Ticketsystem.
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

-- ============================================================
-- 1) Selbstständige Konto-Löschung
-- ============================================================
-- Kein hartes DELETE auf players moeglich/sinnvoll: matches.player1_id/
-- player2_id haengen an der Spieler-Zeile, ein Hard-Delete wuerde entweder
-- an der Fremdschluessel-Regel scheitern oder (bei CASCADE) die Match-
-- Historie ANDERER Spieler mitreissen und deren Rating/Statistik zerstoeren.
-- Stattdessen: die Spieler-Zeile wird anonymisiert (Name, Farbe, Motto,
-- Einladungscode, Login-Verknuepfung entfernt), die reinen Ergebniszahlen
-- bereits gespielter Matches bleiben bestehen, damit die Statistik der
-- uebrigen Mitglieder korrekt bleibt - aber ohne jeden Bezug mehr zur
-- Person. Das faellt unter Erwaegungsgrund 26 DSGVO nicht mehr unter
-- "personenbezogene Daten". Das echte Login (auth.users) wird zusaetzlich
-- vollstaendig geloescht - das geht per SQL direkt (kein Service-Role-Key
-- noetig), weil die Funktion mit den Rechten des SQL-Editors angelegt wird.

create or replace function public.self_delete_account()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_auth_id uuid;
begin
  select id, auth_user_id into v_me, v_auth_id from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;

  -- Eigene, rein persoenliche Daten vollstaendig entfernen.
  delete from ping_replies where player_id = v_me;
  delete from pings where player_id = v_me;
  delete from challenges where challenger_id = v_me or challenged_id = v_me;
  delete from ghost_games where player_id = v_me;

  -- Spieler-Zeile anonymisieren statt loeschen (Match-Historie anderer bleibt intakt).
  update players set
    nickname = 'Ehemaliges Mitglied ' || substr(v_me::text, 1, 8),
    avatar_color = null,
    motto = null,
    invite_code = null,
    selected_badge = null,
    auth_user_id = null,
    blocked = true
  where id = v_me;

  -- Login-Konto vollstaendig und unwiderruflich entfernen. Muss NACH dem
  -- obigen UPDATE laufen (auth_user_id dort schon auf null gesetzt), damit
  -- eine etwaige ON DELETE CASCADE-Regel auf players.auth_user_id nicht
  -- die gerade erst anonymisierte Zeile mitreisst.
  delete from auth.users where id = v_auth_id;
end;
$$;

-- ============================================================
-- 2) Feedback-Ticketsystem (rudimentaer)
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  category text not null default 'other' check (category in ('bug', 'idea', 'other')),
  message text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_select_admin" on public.feedback;
create policy "feedback_select_admin" on public.feedback
  for select using (is_admin());

-- Kein Insert/Update fuer normale Nutzer per RLS - laeuft ausschliesslich
-- ueber die SECURITY DEFINER-Funktionen unten (gleiches Muster wie
-- create_ping / create_challenge etc.).

create or replace function public.submit_feedback(p_category text, p_message text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'Nachricht darf nicht leer sein.';
  end if;
  insert into feedback (player_id, category, message)
    values (v_me, coalesce(p_category, 'other'), trim(p_message));
end;
$$;

create or replace function public.admin_set_feedback_status(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  update feedback set status = p_status where id = p_id;
end;
$$;
