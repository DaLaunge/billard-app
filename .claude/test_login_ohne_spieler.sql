-- NUR TEST-PROJEKT. Legt bestätigte Logins OHNE Spielerprofil an (wie ein Neuling vor der Namenswahl).
-- Anmelden in der App ueber den Tab "Passwort": zz.neu1@example.com ... zz.neu3@example.com, Passwort: Neuling#2026
-- Nach dem Anmelden kommt die Namenswahl, danach greift die Turnier-Einladung. Mehrfach ausfuehrbar (vorhandene werden uebersprungen).
do $$
declare v_id uuid; v_mail text;
begin
  foreach v_mail in array array['zz.neu1@example.com','zz.neu2@example.com','zz.neu3@example.com'] loop
    continue when exists (select 1 from auth.users where email = v_mail);
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_mail, extensions.crypt('Neuling#2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('sub', v_id::text, 'email', v_mail, 'email_verified', true, 'phone_verified', false),
      false, false, now(), now(), '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_mail, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now());
  end loop;
end $$;
