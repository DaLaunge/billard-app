-- Verwaiste Logins (E-Mail-Adressen ohne Spieler) aufraeumen und kuenftig verhindern (434.7).
-- Hintergrund: Wird ein Spieler geloescht, ohne dass sein Eintrag in auth.users mitgeht (aeltere Loeschwege, Bereinigung per SQL,
-- Gast-/Anonym-Logins), bleibt die E-Mail-Adresse belegt: "Neuen Nutzer anlegen" scheitert mit "bereits registriert", obwohl es
-- keinen Spieler dazu gibt. Vom Nutzer einzuspielen (erst Test, dann Prod). Idempotent.

-- 1) Jeder Weg, einen Spieler zu loeschen, nimmt jetzt auch seinen Login mit (sofern kein anderer Spieler daran haengt)
create or replace function public.trg_players_drop_login()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.auth_user_id is not null
     and not exists (select 1 from public.players p where p.auth_user_id = old.auth_user_id) then
    delete from auth.identities where user_id = old.auth_user_id;
    delete from auth.users where id = old.auth_user_id;
  end if;
  return old;
exception when others then
  -- ein haengender Login darf das Loeschen des Spielers nie verhindern
  return old;
end;
$$;

drop trigger if exists players_drop_login on public.players;
create trigger players_drop_login
  after delete on public.players
  for each row execute function public.trg_players_drop_login();

-- 2) Bereinigung: Logins ohne Spieler. Juenger als 1 Tag bleiben (jemand koennte gerade mitten in der Registrierung sein);
--    wer sich spaeter noch einmal per Link anmeldet, bekommt einfach einen neuen Login.
create or replace function public.admin_cleanup_orphan_logins()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_n integer;
begin
  if auth.uid() is not null and not exists (select 1 from public.players where auth_user_id = auth.uid() and role = 'admin') then
    raise exception 'Nur fuer Admins';
  end if;
  with orphans as (
    select u.id from auth.users u
    where u.created_at < now() - interval '1 day'
      and not exists (select 1 from public.players p where p.auth_user_id = u.id)
  ), di as (
    delete from auth.identities where user_id in (select id from orphans)
  ), du as (
    delete from auth.users where id in (select id from orphans) returning 1
  )
  select count(*) into v_n from du;
  return v_n;
end;
$$;

grant execute on function public.admin_cleanup_orphan_logins() to authenticated;

-- einmalig jetzt ausfuehren (ohne Anmeldung, also im SQL-Editor)
select public.admin_cleanup_orphan_logins() as geloeschte_verwaiste_logins;
