-- Admin kann die Login-Mail eines Spielers ändern/setzen - wichtig, weil
-- Login zwingend E-Mail+Passwort braucht (kein Login nur per Spielername),
-- die Tester ihre (ggf. frei erfundene) Adresse also kennen müssen. Ändert
-- direkt auth.users.email + die zugehörige auth.identities-Zeile, ohne
-- Supabases "E-Mail ändern"-Bestätigungsmail-Flow (derselbe No-Mail-Ansatz
-- wie admin_create_login/admin_create_user).
create or replace function admin_set_email(p_player uuid, p_new_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_new_email));
  v_auth_id uuid;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  if exists (select 1 from players where id = p_player and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost-Spieler hat keinen Login.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ungültige E-Mail-Adresse.';
  end if;

  select auth_user_id into v_auth_id from players where id = p_player;
  if v_auth_id is null then raise exception 'Dieser Spieler hat noch keinen Login - nutze "Login einrichten".'; end if;
  if exists (select 1 from auth.users where email = v_email and is_sso_user = false and id <> v_auth_id) then
    raise exception 'Diese E-Mail-Adresse wird bereits verwendet.';
  end if;

  update auth.users set email = v_email, updated_at = now() where id = v_auth_id;
  update auth.identities
  set identity_data = identity_data || jsonb_build_object('email', v_email),
      updated_at = now()
  where user_id = v_auth_id and provider = 'email';
end;
$$;

grant execute on function admin_set_email(uuid, text) to authenticated;

-- admin_player_logins() zeigt jetzt zusätzlich die aktuelle Login-Mail an,
-- damit die Verwaltung nicht extra in der Datenbank nachsehen muss.
drop function if exists admin_player_logins();
create function admin_player_logins()
returns table(player_id uuid, nickname text, role text, is_ghost boolean, blocked boolean,
              must_change_password boolean, email text,
              last_seen timestamp with time zone, created_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  return query
  select p.id, p.nickname::text, p.role, coalesce(p.is_ghost, false), coalesce(p.blocked, false),
         coalesce(p.must_change_password, false), u.email::text,
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
