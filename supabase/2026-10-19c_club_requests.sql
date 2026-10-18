-- Club-Einladungen und -Anfragen (Ergaenzung zu 2026-10-19b_clubs.sql, die vorher eingespielt sein muss).
--
-- Zwei Wege in einen Club, beide brauchen die Zustimmung der Gegenseite:
--   * EINLADUNG: die Club-Leitung (owner/admin) laedt einen Spieler "einfach so" ein; der Spieler muss BESTAETIGEN.
--   * ANFRAGE:   ein Spieler fragt bei einem Club an (er wirbt sich quasi selbst); die Leitung muss BESTAETIGEN.
-- Wollen beide Seiten (Einladung trifft auf Anfrage), kommt der Spieler sofort rein. Daneben bleibt der Einladungs-Code
-- bzw. QR-Link aus 2026-10-19b unveraendert (Beitritt sofort, wer den Code hat).
--
-- Eine Zeile je (Club, Person). Abgelehnt wird NICHT geloescht, sondern 30 Tage gesperrt (status 'declined'): so kann eine
-- Leitung niemanden mit Einladungen bedraengen, und niemand fragt dieselbe Leitung dauernd an. Danach darf neu angefragt/
-- eingeladen werden. Wer sichtbar ist: die betroffene Person, wer die Zeile angelegt hat und die Club-Leitung.
-- Benachrichtigungen: club_invite (an die eingeladene Person), club_request (an Gruender und Admins), club_joined
-- (Rueckmeldung nach Zusage). Eine Absage wird nicht gemeldet.
--
-- Test, dann Produktion. Idempotent.

create table if not exists public.club_requests (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,   -- die eingeladene bzw. anfragende Person
  kind       text not null check (kind in ('invite', 'request')),
  status     text not null default 'pending' check (status in ('pending', 'declined')),
  created_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists club_requests_one on public.club_requests (club_id, player_id);
create index if not exists club_requests_player on public.club_requests (player_id);

alter table public.club_requests enable row level security;
drop policy if exists club_requests_select on public.club_requests;
create policy club_requests_select on public.club_requests for select to authenticated
  using (player_id = current_player_id() or created_by = current_player_id() or club_can_manage(club_id));
revoke all on public.club_requests from authenticated, anon;
grant select on public.club_requests to authenticated;
grant all on public.club_requests to service_role;

-- gemeinsame Aufnahme (Mitglied anlegen, Hauptclub setzen, Anfrage loeschen)
create or replace function public.club_admit(p_club uuid, p_player uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into club_members (club_id, player_id) values (p_club, p_player) on conflict do nothing;
  update players set home_club_id = p_club where id = p_player and home_club_id is null;
  delete from club_requests where club_id = p_club and player_id = p_player;
end;
$function$;

-- Leitung -> Spieler: einladen. Rueckgabe 'invited' oder 'joined' (es lag schon eine Anfrage der Person vor)
create or replace function public.club_invite_player(p_club uuid, p_player uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := current_player_id();
  r club_requests;
  v_club clubs;
  v_me_name text;
begin
  if not club_can_manage(p_club) then raise exception 'Nur die Club-Leitung darf einladen.'; end if;
  if not exists (select 1 from players where id = p_player and auth_user_id is not null
                    and not coalesce(is_guest, false) and not coalesce(is_ghost, false) and not coalesce(blocked, false)) then
    raise exception 'Dieser Spieler kann nicht eingeladen werden.';
  end if;
  if club_role(p_club, p_player) is not null then raise exception 'Der Spieler ist schon Mitglied.'; end if;
  select * into r from club_requests where club_id = p_club and player_id = p_player;
  if found then
    if r.status = 'pending' and r.kind = 'request' then
      perform club_admit(p_club, p_player);
      return 'joined';
    elsif r.status = 'pending' then
      return 'invited';
    elsif r.decided_at > now() - interval '30 days' then
      raise exception 'Der Spieler hat abgelehnt. Eine neue Einladung ist erst nach 30 Tagen möglich.';
    end if;
    update club_requests set kind = 'invite', status = 'pending', created_by = me, created_at = now(), decided_at = null where id = r.id;
  else
    insert into club_requests (club_id, player_id, kind, created_by) values (p_club, p_player, 'invite', me);
  end if;
  select * into v_club from clubs where id = p_club;
  select nickname into v_me_name from players where id = me;
  perform notify_players(array[p_player], 'club_invite', 'Club-Einladung',
    coalesce(v_me_name, 'Jemand') || ' lädt dich in „' || v_club.name || '“ ein.',
    'Club invitation', coalesce(v_me_name, 'Someone') || ' invites you to “' || v_club.name || '”.',
    jsonb_build_object('tab', 'profil'));
  return 'invited';
end;
$function$;

-- Spieler -> Club: anfragen. Rueckgabe 'requested' oder 'joined' (es lag schon eine Einladung vor)
create or replace function public.club_request_join(p_club uuid)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := current_player_id();
  r club_requests;
  v_club clubs;
  v_me_name text;
begin
  if me is null then raise exception 'Nicht eingeloggt.'; end if;
  if exists (select 1 from players where id = me and coalesce(is_guest, false)) then raise exception 'Gäste können keinem Club beitreten.'; end if;
  select * into v_club from clubs where id = p_club;
  if not found then raise exception 'Diesen Club gibt es nicht (mehr).'; end if;
  if club_role(p_club, me) is not null then raise exception 'Du bist schon Mitglied.'; end if;
  select * into r from club_requests where club_id = p_club and player_id = me;
  if found then
    if r.status = 'pending' and r.kind = 'invite' then
      perform club_admit(p_club, me);
      return 'joined';
    elsif r.status = 'pending' then
      return 'requested';
    elsif r.decided_at > now() - interval '30 days' then
      raise exception 'Deine Anfrage wurde abgelehnt. Eine neue Anfrage ist erst nach 30 Tagen möglich.';
    end if;
    update club_requests set kind = 'request', status = 'pending', created_by = me, created_at = now(), decided_at = null where id = r.id;
  else
    insert into club_requests (club_id, player_id, kind, created_by) values (p_club, me, 'request', me);
  end if;
  select nickname into v_me_name from players where id = me;
  perform notify_players(
    (select coalesce(array_agg(player_id), '{}') from club_members where club_id = p_club and role in ('owner', 'admin')),
    'club_request', 'Club-Anfrage',
    coalesce(v_me_name, 'Jemand') || ' möchte in „' || v_club.name || '“ aufgenommen werden.',
    'Club request', coalesce(v_me_name, 'Someone') || ' would like to join “' || v_club.name || '”.',
    jsonb_build_object('tab', 'profil'));
  return 'requested';
end;
$function$;

-- Antwort: Einladung -> nur die eingeladene Person; Anfrage -> nur die Leitung
create or replace function public.club_respond(p_request uuid, p_accept boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := current_player_id();
  r club_requests;
  v_club clubs;
  v_me_name text;
begin
  select * into r from club_requests where id = p_request and status = 'pending';
  if not found then raise exception 'Diese Anfrage gibt es nicht mehr.'; end if;
  if r.kind = 'invite' then
    if r.player_id is distinct from me then raise exception 'Diese Einladung gilt nicht dir.'; end if;
  else
    if not club_can_manage(r.club_id) then raise exception 'Nur die Club-Leitung darf Anfragen beantworten.'; end if;
  end if;
  if not p_accept then
    update club_requests set status = 'declined', decided_at = now() where id = r.id;
    return;
  end if;
  perform club_admit(r.club_id, r.player_id);
  select * into v_club from clubs where id = r.club_id;
  select nickname into v_me_name from players where id = me;
  if r.kind = 'invite' then
    perform notify_players(array[r.created_by], 'club_joined', 'Zusage',
      coalesce(v_me_name, 'Jemand') || ' ist jetzt in „' || v_club.name || '“.',
      'Accepted', coalesce(v_me_name, 'Someone') || ' is now in “' || v_club.name || '”.', jsonb_build_object('tab', 'profil'));
  else
    perform notify_players(array[r.player_id], 'club_joined', 'Willkommen im Club',
      'Du wurdest in „' || v_club.name || '“ aufgenommen.',
      'Welcome to the club', 'You have been accepted into “' || v_club.name || '”.', jsonb_build_object('tab', 'profil'));
  end if;
end;
$function$;

-- Zurueckziehen: wer die Zeile angelegt hat oder die Leitung
create or replace function public.club_cancel_request(p_request uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare r club_requests;
begin
  select * into r from club_requests where id = p_request;
  if not found then return; end if;
  if not (r.created_by is not distinct from current_player_id() or club_can_manage(r.club_id)) then
    raise exception 'Dazu fehlen dir die Rechte.';
  end if;
  delete from club_requests where id = r.id;
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array[
    'club_admit(uuid, uuid)', 'club_invite_player(uuid, uuid)', 'club_request_join(uuid)',
    'club_respond(uuid, boolean)', 'club_cancel_request(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  -- club_admit ist nur Hilfsfunktion der anderen (die pruefen selbst) - nicht direkt aufrufbar
  revoke execute on function public.club_admit(uuid, uuid) from authenticated;
end $$;

-- Kontrolle: Tabelle da, leer
select count(*) as offene_zeilen from club_requests;
