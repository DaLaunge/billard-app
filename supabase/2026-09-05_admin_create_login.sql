-- Admin kann für einen Spieler OHNE bestehenden Login (noch nie per
-- Magic-Link eingeloggt) direkt einen E-Mail+Passwort-Login anlegen und
-- verknüpfen - übersteuert das "ohne Login"-Flag bewusst, statt es
-- abzuschaffen. Das neue Passwort muss (wie bei admin_set_password) beim
-- nächsten Login sofort ersetzt werden.
--
-- Schreibt direkt in auth.users/auth.identities, weil die Edge Function
-- "admin-create-user" in diesem (Test-)Projekt nicht vorhanden/erreichbar
-- ist. Bildet dieselben Spalten nach, die Supabase beim reduzierten
-- E-Mail+Passwort-Signup selbst setzt (siehe bestehende Zeilen aus
-- self-registrierten Spielern) - inkl. auth.identities-Zeile, damit der
-- Account wie ein normaler Signup aussieht. Bekannter Trade-off: das ist
-- internes Auth-Schema, kein offiziell dokumentiertes API - falls Supabase
-- das Schema künftig ändert, muss diese Funktion mitgezogen werden.
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
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_new_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_new_password, extensions.gen_salt('bf')), now(),
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

  update players set auth_user_id = v_new_id, must_change_password = true where id = p_player;
end;
$$;

grant execute on function admin_create_login(uuid, text, text) to authenticated;
