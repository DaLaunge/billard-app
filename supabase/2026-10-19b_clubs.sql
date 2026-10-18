-- Clubs ("Clans"), Phase 1 von KONZEPT_CLUBS.md.
--
-- Jeder angemeldete Spieler (kein Gast) kann einen Club gruenden und ist dann dessen Leiter ("owner"). Die Leitung
-- laesst sich erweitern (weitere "admin") und uebergeben (club_transfer_owner). Ein Club ist als TAG im Profil
-- erkennbar: Kuerzel (2-5 Zeichen, A-Z/0-9, eindeutig) + optionale Farbe; der Tag des Hauptclubs steht im Profil.
--
-- Beitritt nur per Einladungs-Code (clubs.join_code, per Link /?club=CODE oder Eingabe in der App) - niemand wird
-- ohne eigenes Zutun getaggt. Der Code ist fuer normale Spieler NICHT lesbar (Spalten-Rechte), nur die Leitung holt
-- ihn per club_join_code(). Alle Schreibzugriffe laufen ueber RPCs.
--
-- Rollen: owner (genau einer je Club) > admin > member.
--   * owner: alles, Leitung uebergeben, Club loeschen, Admins ernennen/absetzen
--   * admin: Mitglieder entfernen (keine admins/owner), weitere admins ernennen, Name/Tag/Farbe, Code erneuern
--   * App-Admins (players.role = 'admin') duerfen jeden Club moderieren (loeschen, umbenennen, Mitglieder entfernen).
-- Missbrauchsbremse: ein Spieler darf hoechstens 3 Clubs leiten (App-Admins unbegrenzt).
--
-- NICHT veraendert: Rating, matches (keine Neuberechnung, kein updated_at-Touch - matches.club_id bleibt NULL fuer
-- Bestand), register_player(). Die neuen club_id-Spalten werden in Phase 2 beim Speichern gesetzt.
--
-- Spieler OHNE Club sind ausdruecklich normal (kein Pflichtfeld, keine Meldung, im Filter "Alle" wie bisher enthalten).
-- Niemand wird ohne eigenes Zutun getaggt.
--
-- BACKFILL (letzter Abschnitt): Club "Stammclub" (Tag HOME) mit dem aeltesten App-Admin als Leiter; alle anderen treten per
-- Code/Link bei. Wer stattdessen alle bestehenden Spieler automatisch aufnehmen will, aktiviert den markierten Block.
--
-- Test, dann Produktion. Idempotent.

-- 1) Tabellen -------------------------------------------------------------------------------------------------------
create table if not exists public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 40),
  tag        text not null check (tag ~ '^[A-Z0-9]{2,5}$'),
  color      text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  join_code  text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists clubs_tag_unique  on public.clubs (upper(tag));
create unique index if not exists clubs_name_unique on public.clubs (lower(name));

create table if not exists public.club_members (
  club_id   uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, player_id)
);
create index if not exists club_members_player on public.club_members (player_id);
create unique index if not exists club_members_one_owner on public.club_members (club_id) where role = 'owner';

alter table public.players     add column if not exists home_club_id uuid references public.clubs(id) on delete set null;
alter table public.matches     add column if not exists club_id uuid references public.clubs(id) on delete set null;
alter table public.tournaments add column if not exists club_id uuid references public.clubs(id) on delete set null;
alter table public.pings       add column if not exists club_id uuid references public.clubs(id) on delete set null;
alter table public.plannings   add column if not exists club_id uuid references public.clubs(id) on delete set null;

-- 2) Rechte ---------------------------------------------------------------------------------------------------------
alter table public.clubs        enable row level security;
alter table public.club_members enable row level security;

drop policy if exists clubs_select on public.clubs;
create policy clubs_select on public.clubs for select to authenticated using (true);
drop policy if exists club_members_select on public.club_members;
create policy club_members_select on public.club_members for select to authenticated using (true);

-- join_code bewusst NICHT lesbar: Spalten-Rechte statt Tabellen-Recht
revoke all on public.clubs from authenticated, anon;
grant select (id, name, tag, color, created_by, created_at) on public.clubs to authenticated;
grant all on public.clubs to service_role;
revoke all on public.club_members from authenticated, anon;
grant select on public.club_members to authenticated;
grant all on public.club_members to service_role;

-- 3) Hilfsfunktionen -----------------------------------------------------------------------------------------------
create or replace function public.club_role(p_club uuid, p_player uuid default null)
 returns text language sql stable security definer set search_path to 'public'
as $$ select role from club_members where club_id = p_club and player_id = coalesce(p_player, current_player_id()); $$;

create or replace function public.my_club_ids()
 returns uuid[] language sql stable security definer set search_path to 'public'
as $$ select coalesce(array_agg(club_id), '{}') from club_members where player_id = current_player_id(); $$;

create or replace function public.shares_club(p_player uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from club_members a join club_members b on b.club_id = a.club_id
                      where a.player_id = current_player_id() and b.player_id = p_player); $$;

-- darf der Aufrufer diesen Club leiten (owner/admin oder App-Admin)?
create or replace function public.club_can_manage(p_club uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select is_admin() or coalesce(club_role(p_club) in ('owner', 'admin'), false); $$;

-- 4) Schreib-RPCs ----------------------------------------------------------------------------------------------------
create or replace function public.create_club(p_name text, p_tag text, p_color text default null)
 returns clubs language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := current_player_id();
  v_name text := trim(p_name);
  v_tag text := upper(trim(p_tag));
  v_row clubs;
begin
  if me is null then raise exception 'Nicht eingeloggt.'; end if;
  if exists (select 1 from players where id = me and coalesce(is_guest, false)) then raise exception 'Gäste können keinen Club gründen.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'Der Clubname braucht 2 bis 40 Zeichen.'; end if;
  if v_tag !~ '^[A-Z0-9]{2,5}$' then raise exception 'Das Kürzel braucht 2 bis 5 Zeichen (A-Z, 0-9).'; end if;
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Ungültige Farbe.'; end if;
  if not is_admin() and (select count(*) from club_members where player_id = me and role = 'owner') >= 3 then
    raise exception 'Du leitest bereits 3 Clubs.';
  end if;
  insert into clubs (name, tag, color, created_by) values (v_name, v_tag, p_color, me) returning * into v_row;
  insert into club_members (club_id, player_id, role) values (v_row.id, me, 'owner');
  update players set home_club_id = v_row.id where id = me and home_club_id is null;
  return v_row;
exception when unique_violation then
  raise exception 'Name oder Kürzel ist schon vergeben.';
end;
$function$;

create or replace function public.update_club(p_club uuid, p_name text, p_tag text, p_color text default null)
 returns clubs language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_name text := trim(p_name);
  v_tag text := upper(trim(p_tag));
  v_row clubs;
begin
  if not club_can_manage(p_club) then raise exception 'Nur die Club-Leitung darf das.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'Der Clubname braucht 2 bis 40 Zeichen.'; end if;
  if v_tag !~ '^[A-Z0-9]{2,5}$' then raise exception 'Das Kürzel braucht 2 bis 5 Zeichen (A-Z, 0-9).'; end if;
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Ungültige Farbe.'; end if;
  update clubs set name = v_name, tag = v_tag, color = p_color where id = p_club returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'Name oder Kürzel ist schon vergeben.';
end;
$function$;

-- Code nur fuer die Leitung; p_rotate = true gibt einen neuen Code aus (alte Links/Codes verfallen)
create or replace function public.club_join_code(p_club uuid, p_rotate boolean default false)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_code text;
begin
  if not club_can_manage(p_club) then raise exception 'Nur die Club-Leitung darf das.'; end if;
  if p_rotate then
    update clubs set join_code = upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)) where id = p_club returning join_code into v_code;
  else
    select join_code into v_code from clubs where id = p_club;
  end if;
  return v_code;
end;
$function$;

create or replace function public.join_club(p_code text)
 returns clubs language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := current_player_id();
  v_row clubs;
begin
  if me is null then raise exception 'Nicht eingeloggt.'; end if;
  if exists (select 1 from players where id = me and coalesce(is_guest, false)) then raise exception 'Gäste können keinem Club beitreten.'; end if;
  select * into v_row from clubs where join_code = upper(trim(p_code));
  if not found then raise exception 'Diesen Club-Code gibt es nicht (mehr).'; end if;
  insert into club_members (club_id, player_id) values (v_row.id, me) on conflict do nothing;
  update players set home_club_id = v_row.id where id = me and home_club_id is null;
  return v_row;
end;
$function$;

create or replace function public.leave_club(p_club uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare me uuid := current_player_id();
begin
  if club_role(p_club, me) = 'owner' then raise exception 'Übergib zuerst die Leitung oder lösche den Club.'; end if;
  delete from club_members where club_id = p_club and player_id = me;
  update players set home_club_id = (select club_id from club_members where player_id = me order by joined_at limit 1)
   where id = me and home_club_id = p_club;
end;
$function$;

create or replace function public.set_home_club(p_club uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare me uuid := current_player_id();
begin
  if club_role(p_club, me) is null then raise exception 'Du bist in diesem Club kein Mitglied.'; end if;
  update players set home_club_id = p_club where id = me;
end;
$function$;

-- Rolle eines Mitglieds: 'admin' ernennen (owner und admin), 'member' (= absetzen, nur owner)
create or replace function public.club_set_role(p_club uuid, p_player uuid, p_role text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  mine text := club_role(p_club);
  target text := club_role(p_club, p_player);
begin
  if p_role not in ('admin', 'member') then raise exception 'Ungültige Rolle.'; end if;
  if target is null then raise exception 'Der Spieler ist kein Mitglied.'; end if;
  if target = 'owner' then raise exception 'Die Leitung wird über „Leitung übergeben“ geändert.'; end if;
  if p_role = 'admin' then
    if not (is_admin() or coalesce(mine in ('owner', 'admin'), false)) then raise exception 'Nur die Club-Leitung darf das.'; end if;
  else
    if not (is_admin() or coalesce(mine = 'owner', false)) then raise exception 'Nur der Club-Gründer darf Admins absetzen.'; end if;
  end if;
  update club_members set role = p_role where club_id = p_club and player_id = p_player;
end;
$function$;

create or replace function public.club_transfer_owner(p_club uuid, p_player uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  me uuid := current_player_id();
  v_owner uuid;
begin
  select player_id into v_owner from club_members where club_id = p_club and role = 'owner';
  if not (is_admin() or coalesce(v_owner = me, false)) then raise exception 'Nur der Club-Gründer darf die Leitung übergeben.'; end if;
  if club_role(p_club, p_player) is null then raise exception 'Der neue Leiter muss Mitglied sein.'; end if;
  if p_player = v_owner then return; end if;
  update club_members set role = 'admin' where club_id = p_club and player_id = v_owner;
  update club_members set role = 'owner' where club_id = p_club and player_id = p_player;
end;
$function$;

create or replace function public.club_remove_member(p_club uuid, p_player uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  mine text := club_role(p_club);
  target text := club_role(p_club, p_player);
begin
  if target is null then return; end if;
  if target = 'owner' then raise exception 'Der Club-Gründer kann nicht entfernt werden (erst Leitung übergeben).'; end if;
  if not (is_admin() or coalesce(mine = 'owner' or (mine = 'admin' and target = 'member'), false)) then
    raise exception 'Dazu fehlen dir die Rechte.';
  end if;
  delete from club_members where club_id = p_club and player_id = p_player;
  update players set home_club_id = (select club_id from club_members where player_id = p_player order by joined_at limit 1)
   where id = p_player and home_club_id = p_club;
end;
$function$;

create or replace function public.delete_club(p_club uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not (is_admin() or coalesce(club_role(p_club) = 'owner', false)) then raise exception 'Nur der Club-Gründer darf den Club löschen.'; end if;
  delete from clubs where id = p_club;   -- Mitglieder: cascade; home_club_id/club_id: set null
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array[
    'club_role(uuid, uuid)', 'my_club_ids()', 'shares_club(uuid)', 'club_can_manage(uuid)',
    'create_club(text, text, text)', 'update_club(uuid, text, text, text)', 'club_join_code(uuid, boolean)',
    'join_club(text)', 'leave_club(uuid)', 'set_home_club(uuid)', 'club_set_role(uuid, uuid, text)',
    'club_transfer_owner(uuid, uuid)', 'club_remove_member(uuid, uuid)', 'delete_club(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- 5) BACKFILL: Stammclub mit Leiter (andere treten per Code bei) ---------------------------------------------------
do $$
declare
  v_owner uuid;
  v_club uuid;
begin
  if exists (select 1 from clubs) then return; end if;     -- nur beim ersten Mal
  select id into v_owner from players where role = 'admin' and not coalesce(is_guest, false) order by created_at limit 1;
  if v_owner is null then return; end if;
  insert into clubs (name, tag, created_by) values ('Stammclub', 'HOME', v_owner) returning id into v_club;
  insert into club_members (club_id, player_id, role) values (v_club, v_owner, 'owner');
  update players set home_club_id = v_club where id = v_owner and home_club_id is null;

  /* OPTIONAL - alle echten Spieler zu Mitgliedern machen (Kommentar entfernen):
  insert into club_members (club_id, player_id)
    select v_club, p.id from players p
     where p.id <> v_owner and not coalesce(p.is_guest, false) and not coalesce(p.is_ghost, false);
  update players set home_club_id = v_club
   where home_club_id is null and not coalesce(is_guest, false) and not coalesce(is_ghost, false);
  */
end $$;

-- Kontrolle: Clubs mit Mitgliederzahl
select c.name, c.tag, count(m.player_id) as mitglieder, count(*) filter (where m.role = 'owner') as leiter
  from clubs c left join club_members m on m.club_id = c.id group by c.id, c.name, c.tag;
