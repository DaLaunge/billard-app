-- Einmal-Einladungen statt dauerhaftem persoenlichem Code: verhindert, dass
-- jemand einen Screenshot seines Codes macht und sich selbst ueber mehrere
-- Geraete/Accounts einlaedt, um die Werbe-Erfolge zu farmen. Jeder generierte
-- Code ist nach einmaliger Einloesung ungueltig; beim naechsten Besuch von
-- "Freund einladen" wird automatisch ein neuer erzeugt.
--
-- players.invite_code bleibt unangetastet stehen (nur Alt-Daten, wird nicht
-- mehr gelesen/geschrieben) - so bleibt der Umbau risikoarm rueckgaengig
-- machbar, falls je noetig.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  inviter_id uuid not null references public.players(id) on delete cascade,
  used_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists invites_inviter_idx on public.invites(inviter_id);

alter table public.invites enable row level security;
-- Kein Select/Insert/Update fuer normale Nutzer per RLS - laeuft
-- ausschliesslich ueber die SECURITY DEFINER-Funktionen unten.

-- Liefert den aktuellen, noch nicht eingeloesten Einladungscode des
-- eingeloggten Spielers; erzeugt bei Bedarf einen neuen.
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
    where inviter_id = v_me and used_by is null
    order by created_at desc limit 1;

  if v_code is null then
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into invites (code, inviter_id) values (v_code, v_me);
  end if;

  return v_code;
end;
$function$;

-- register_player(): identisch zur bisherigen Logik, nur die Herkunft des
-- Einladungs-Codes wechselt von players.invite_code (dauerhaft) auf die
-- neue invites-Tabelle (einmalig, wird beim Einloesen als "used" markiert).
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
      from invites where code = upper(trim(p_ref)) and used_by is null;
  end if;

  -- Alt-Spieler übernehmen – aber NIE den Ghost
  update players
     set auth_user_id = auth.uid(),
         invited_by   = coalesce(invited_by, v_inviter)
   where nickname = v_nick
     and auth_user_id is null
     and not is_ghost
  returning * into v_row;

  if not found then
    insert into players (auth_user_id, nickname, invited_by)
    values (auth.uid(), v_nick, v_inviter)
    returning * into v_row;
  end if;

  if v_invite_id is not null then
    update invites set used_by = v_row.id, used_at = now() where id = v_invite_id;
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'Der Nickname "%" ist bereits vergeben.', v_nick;
end;
$function$;
