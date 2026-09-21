-- Zwei Dinge in einem Aufwasch:
--
-- 1) Werbe-Erfolge (recruit1/3/5) wurden NIE vergeben. Grund war nicht die
--    Badge-Logik selbst - compute_recruit_badges() ist korrekt -, sondern
--    dass players.invited_by praktisch nie gesetzt wurde (in der Testdatenbank:
--    0 von 26 Spielern). Der Einladungs-Code aus ?ref=... lag clientseitig im
--    sessionStorage, und der ist PRO TAB. Der Magic-Link aus der Mail oeffnet
--    praktisch immer einen neuen Tab (oder gleich das In-App-Webview der
--    Mail-App), also war der Code beim Registrieren weg -> p_ref = null ->
--    kein invited_by -> kein Erfolg. Der Client speichert den Code jetzt im
--    localStorage und haengt ihn zusaetzlich an die Magic-Link-Rueckkehradresse.
--    Hier serverseitig noch der zweite Teil: register_player() ruft am Ende
--    compute_recruit_badges() auf, damit der Werber seinen Erfolg sofort
--    bekommt und nicht erst beim naechsten bestaetigten Match (bisher der
--    einzige Zeitpunkt, an dem die Badge-Berechnung ueberhaupt lief).
--
-- 2) Einladungs-Codes sind nicht mehr einmalig. Bisher galt ein Code nur fuer
--    EINE Anmeldung (siehe 2026-08-31_single_use_invites.sql, gedacht gegen
--    Farming per Screenshot). In der Praxis will man aber denselben QR-Code
--    einem ganzen Tisch zeigen und mehrere Leute gleichzeitig anmelden lassen.
--    Ein Code bleibt deshalb gueltig, bis der Besitzer ihn per
--    regenerate_my_invite() selbst ersetzt (dann wird der alte gesperrt).
--    Der Farming-Schutz von damals faellt damit bewusst weg.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

-- revoked_at: gesetzt = Code gilt nicht mehr (vom Nutzer ersetzt).
-- use_count : wie oft der Code schon eingeloest wurde.
-- used_by/used_at bleiben bestehen und zeigen jetzt die JUENGSTE Einloesung
-- (Alt-Daten und admin_delete_player() bleiben so unveraendert nutzbar).
alter table public.invites
  add column if not exists revoked_at timestamptz,
  add column if not exists use_count  integer not null default 0;

-- Bereits eingeloeste Alt-Codes waren als Einmal-Codes kommuniziert und sollen
-- nicht nachtraeglich wieder gueltig werden.
update public.invites
   set revoked_at = coalesce(used_at, now()),
       use_count  = 1
 where used_by is not null
   and revoked_at is null;

create index if not exists invites_active_idx
  on public.invites(inviter_id) where revoked_at is null;

-- Aktueller, gueltiger Code des eingeloggten Spielers; legt bei Bedarf einen an.
-- Unveraendert gegenueber vorher bis auf das Filterkriterium: nicht mehr
-- "noch nicht eingeloest", sondern "nicht gesperrt".
create or replace function public.get_or_create_my_invite()
returns text
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me   uuid := current_player_id();
  v_code text;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;

  select code into v_code from invites
    where inviter_id = v_me and revoked_at is null
    order by created_at desc limit 1;

  if v_code is null then
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into invites (code, inviter_id) values (v_code, v_me);
  end if;

  return v_code;
end;
$function$;

-- Sperrt alle aktuellen Codes des Spielers und liefert einen frischen zurueck.
create or replace function public.regenerate_my_invite()
returns text
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me   uuid := current_player_id();
  v_code text;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;

  update invites set revoked_at = now()
   where inviter_id = v_me and revoked_at is null;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into invites (code, inviter_id) values (v_code, v_me);
  return v_code;
end;
$function$;

grant execute on function public.get_or_create_my_invite() to authenticated;
grant execute on function public.regenerate_my_invite()   to authenticated;

-- register_player(): Code wird jetzt ueber revoked_at statt used_by geprueft
-- (mehrfach einloesbar), zaehlt die Einloesungen mit und stoesst direkt die
-- Werbe-Erfolge an.
create or replace function public.register_player(p_nickname text, p_ref text default null::text)
returns players
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_nick      text := trim(p_nickname);
  v_row       players;
  v_inviter   uuid;
  v_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt.';
  end if;
  if exists (select 1 from players where auth_user_id = auth.uid()) then
    raise exception 'Zu diesem Login existiert bereits ein Spieler.';
  end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then
    raise exception 'Nickname muss 2 bis 30 Zeichen lang sein.';
  end if;

  if p_ref is not null and trim(p_ref) <> '' then
    select id, inviter_id into v_invite_id, v_inviter
      from invites where code = upper(trim(p_ref)) and revoked_at is null;
  end if;

  -- Alt-Spieler übernehmen – aber NIE den Ghost oder einen Gast
  update players
     set auth_user_id = auth.uid(),
         invited_by   = coalesce(invited_by, v_inviter)
   where nickname = v_nick
     and auth_user_id is null
     and not is_ghost
     and not coalesce(is_guest, false)
  returning * into v_row;

  if not found then
    insert into players (auth_user_id, nickname, invited_by)
    values (auth.uid(), v_nick, v_inviter)
    returning * into v_row;
  end if;

  if v_invite_id is not null then
    update invites
       set used_by   = v_row.id,
           used_at   = now(),
           use_count = use_count + 1
     where id = v_invite_id;
  end if;

  -- Werbe-Erfolg sofort gutschreiben statt erst beim naechsten Match.
  if v_inviter is not null then
    perform compute_recruit_badges();
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'Der Nickname "%" ist bereits vergeben.', v_nick;
end;
$function$;

-- Nachtraeglich: Werber, die laut players.invited_by schon jemanden geworben
-- haben, aber (mangels Badge-Lauf) noch keinen Erfolg bekommen haben.
select compute_recruit_badges();
