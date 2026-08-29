-- Profilfoto-Feature, konsolidiert fuer Produktion.
-- Fasst 2026-08-29_avatar_photo.sql + die drei Fix-Iterationen (fix_rls,
-- fix_rls_v2, fix_rls_v3) zu EINEM sauberen Skript zusammen - im Testprojekt
-- wurden dabei drei Anlaeufe gebraucht, bis der eigentliche Fehler gefunden
-- war (fehlende SELECT-Policy fuer storage.objects; ein Upload ist intern
-- ein "INSERT ... RETURNING *", ohne SELECT-Policy schlaegt die Rueckgabe
-- fehl). Dieses Skript setzt direkt den korrekten Endzustand, ohne die
-- Zwischenschritte nachzuvollziehen.
--
-- In Supabase SQL-Editor des PRODUKTIONS-Projekts ausfuehren
-- (wofsutwidaitloeiwnma). Idempotent - kann gefahrlos erneut laufen.

-- 1) Spalte + Bucket
alter table public.players add column if not exists avatar_photo_at timestamptz;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- 2) Policies: Schreiben/Lesen/Aendern/Loeschen nur auf den eigenen Ordner
-- "<auth_user_id>/avatar.jpg". Die SELECT-Policy ist zwingend noetig (siehe
-- oben), nicht nur fuer normales Lesen - fremde Fotos werden ueber die
-- oeffentliche Bucket-URL angezeigt, komplett unabhaengig von RLS.
drop policy if exists "avatar_write_own" on storage.objects;
create policy "avatar_write_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_select_own" on storage.objects;
create policy "avatar_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) RPC: avatar_photo_at dient als Existenz-Flag (null = kein Foto) und
-- als Cache-Buster fuer die Bild-URL nach einem Reupload.
create or replace function public.set_avatar_photo(p_has_photo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update players set avatar_photo_at = case when p_has_photo then now() else null end
    where auth_user_id = auth.uid();
end;
$$;

-- 4) self_delete_account() um das Entfernen der Foto-Datei erweitern, damit
-- eine Loeschung wirklich rueckstandsfrei ist (Pfad "<auth_user_id>/avatar.jpg").
create or replace function public.self_delete_account()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid;
  v_auth_id uuid;
begin
  select id, auth_user_id into v_me, v_auth_id from players where auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Kein Spielerprofil gefunden.';
  end if;

  delete from ping_replies where player_id = v_me;
  delete from pings where player_id = v_me;
  delete from challenges where challenger_id = v_me or challenged_id = v_me;
  delete from ghost_games where player_id = v_me;
  delete from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = v_auth_id::text;

  update players set
    nickname = 'Ehemaliges Mitglied ' || substr(v_me::text, 1, 8),
    avatar_color = null,
    avatar_photo_at = null,
    motto = null,
    invite_code = null,
    selected_badge = null,
    auth_user_id = null,
    blocked = true
  where id = v_me;

  delete from auth.users where id = v_auth_id;
end;
$$;
