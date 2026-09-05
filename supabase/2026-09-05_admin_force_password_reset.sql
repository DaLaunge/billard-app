-- Admin kann für einen Spieler ein neues Passwort setzen; der Spieler muss es
-- direkt nach dem nächsten Login durch ein eigenes ersetzen.

alter table players add column if not exists must_change_password boolean not null default false;

-- Setzt den Auth-Passwort-Hash direkt (kein Edge-Function-Aufruf nötig) und
-- markiert den Spieler als "muss Passwort ändern". pgcrypto (Schema
-- "extensions") liegt bei Supabase immer bei und erzeugt denselben
-- bcrypt-Hash-Typ, den GoTrue selbst für encrypted_password verwendet.
create or replace function admin_set_password(p_player uuid, p_new_password text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_auth_id uuid;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  if exists (select 1 from players where id = p_player and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost-Spieler hat keinen Login.';
  end if;
  if coalesce(length(p_new_password), 0) < 6 then
    raise exception 'Passwort braucht mindestens 6 Zeichen.';
  end if;

  select auth_user_id into v_auth_id from players where id = p_player;
  if v_auth_id is null then raise exception 'Dieser Spieler hat noch keinen Login.'; end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_auth_id;

  update players set must_change_password = true where id = p_player;
end;
$$;

-- Vom Spieler selbst aufgerufen, nachdem er (via supabase.auth.updateUser)
-- erfolgreich ein eigenes Passwort gesetzt hat.
create or replace function clear_must_change_password()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update players set must_change_password = false where id = current_player_id();
end;
$$;

grant execute on function admin_set_password(uuid, text) to authenticated;
grant execute on function clear_must_change_password() to authenticated;

-- admin_player_logins() liefert jetzt zusätzlich must_change_password, damit
-- die Verwaltung sieht, wessen Reset noch aussteht. Rückgabetyp ändert sich,
-- daher DROP + Neuanlage statt CREATE OR REPLACE.
drop function if exists admin_player_logins();
create function admin_player_logins()
returns table(player_id uuid, nickname text, role text, is_ghost boolean, blocked boolean,
              must_change_password boolean, last_seen timestamp with time zone, created_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  return query
  select p.id, p.nickname::text, p.role, coalesce(p.is_ghost, false), coalesce(p.blocked, false),
         coalesce(p.must_change_password, false),
         greatest(
           u.last_sign_in_at,
           (select max(m.played_at)  from matches m     where m.player1_id = p.id or m.player2_id = p.id),
           (select max(pg.created_at) from pings pg       where pg.player_id = p.id),
           (select max(gg.played_at)  from ghost_games gg where gg.player_id = p.id)
         ) as last_seen,
         p.created_at
  from players p
  left join auth.users u on u.id = p.auth_user_id
  order by coalesce(p.is_ghost, false), last_seen desc nulls last, p.nickname;
end;
$$;

grant execute on function admin_player_logins() to authenticated;
