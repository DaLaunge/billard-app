-- "Neuen Nutzer anlegen" im Verwaltungsbereich rief bisher die Edge Function
-- "admin-create-user" auf, die es in diesem Projekt nicht (mehr) gibt (siehe
-- admin_create_login.sql) - der Button war also tot. Diese Funktion ersetzt
-- den Aufruf komplett durch denselben direkten auth.users/auth.identities-
-- Ansatz wie admin_create_login, plus Anlage der players-Zeile in einem
-- Rutsch. Zweck: Admin kann Test-Accounts (E-Mail+Passwort+Spielername)
-- anlegen, ohne dass Supabase dafür eine Bestätigungsmail verschickt - damit
-- lässt sich das knappe Mail-Kontingent (wenige Mails/Stunde ohne eigenes
-- SMTP) beim Onboarding vieler Tester umgehen. Spielername ist hier bewusst
-- Pflicht (anders als der tote alte Text es versprach): ohne Spielername
-- gäbe es keine Möglichkeit, das erzwungene "Passwort ändern"-Flag zu
-- setzen, solange niemand eingeloggt war, um es selbst zu wählen.
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
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    false, false, now(), now()
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

grant execute on function admin_create_user(text, text, text) to authenticated;
