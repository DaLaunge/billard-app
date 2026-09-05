-- Bugfix: admin_create_login() und admin_create_user() liessen beim Insert
-- in auth.users vier Token-Spalten (confirmation_token, recovery_token,
-- email_change_token_new, email_change) NULL statt '' - GoTrue erwartet dort
-- aber IMMER einen (leeren) String, niemals NULL, und scannt sie intern in
-- nicht-nullable Go-Strings. Das Ergebnis war kein "Email not confirmed",
-- sondern ein knallharter 500er "Database error querying schema" beim
-- Login-Versuch mit signInWithPassword - live bestaetigt mit dem Testaccount
-- "RaphiTest" (vimewer850@fidhost.com): nach diesem Fix + Passwort neu
-- gesetzt loggt er sauber ein.
--
-- 1) Bestehende, per admin_create_login/admin_create_user angelegte Zeilen
--    reparieren (betrifft aktuell "Raphi" und "RaphiTest" auf Test).
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change is null;

-- 2) Beide Funktionen so neu anlegen, dass künftige Inserts das nicht mehr
--    falsch machen.
create or replace function admin_create_login(p_player uuid, p_email text, p_new_password text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_new_id uuid;
  v_existing_auth uuid;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  if exists (select 1 from players where id = p_player and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost-Spieler kann keinen Login erhalten.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ungültige E-Mail-Adresse.';
  end if;
  if coalesce(length(p_new_password), 0) < 6 then
    raise exception 'Passwort braucht mindestens 6 Zeichen.';
  end if;

  select auth_user_id into v_existing_auth from players where id = p_player;
  if v_existing_auth is not null then
    raise exception 'Dieser Spieler hat bereits einen Login - nutze stattdessen "Neues Passwort setzen".';
  end if;
  if exists (select 1 from auth.users where email = v_email and is_sso_user = false) then
    raise exception 'Diese E-Mail-Adresse wird bereits verwendet.';
  end if;

  v_new_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_new_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    false, false, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (
    gen_random_uuid(), v_new_id::text, v_new_id,
    jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  update players set auth_user_id = v_new_id, must_change_password = true where id = p_player;
end;
$$;

create or replace function admin_create_user(p_email text, p_password text, p_nickname text)
returns players
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := lower(trim(p_email));
  v_nickname text := trim(p_nickname);
  v_new_id uuid;
  v_row players;
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ungültige E-Mail-Adresse.';
  end if;
  if coalesce(length(p_password), 0) < 6 then
    raise exception 'Passwort braucht mindestens 6 Zeichen.';
  end if;
  if char_length(v_nickname) < 2 or char_length(v_nickname) > 30 then
    raise exception 'Spielername braucht 2 bis 30 Zeichen.';
  end if;
  if exists (select 1 from players where nickname = v_nickname::citext) then
    raise exception 'Dieser Spielername ist schon vergeben.';
  end if;
  if exists (select 1 from auth.users where email = v_email and is_sso_user = false) then
    raise exception 'Diese E-Mail-Adresse wird bereits verwendet.';
  end if;

  v_new_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    false, false, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (
    gen_random_uuid(), v_new_id::text, v_new_id,
    jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  insert into players (auth_user_id, nickname, must_change_password)
  values (v_new_id, v_nickname, true)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function admin_create_login(uuid, text, text) to authenticated;
grant execute on function admin_create_user(text, text, text) to authenticated;
