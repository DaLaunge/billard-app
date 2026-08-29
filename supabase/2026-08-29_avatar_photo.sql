-- Profilfoto-Upload: Storage-Bucket, Policies, neue Spalte + RPC.
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.
--
-- Kosten-Ueberlegung: pro Spieler existiert hoechstens EINE Foto-Datei
-- (Pfad "<player_id>.jpg", wird bei jedem neuen Upload ueberschrieben statt
-- eine neue Version anzulegen) - kein Anwachsen des Speicherverbrauchs durch
-- wiederholte Uploads. Die App komprimiert das Bild vor dem Hochladen
-- clientseitig auf max. 1000px Kantenlaenge, JPEG-Qualitaet ~0.82 (typisch
-- 80-200 KB) - das reicht fuer eine bildschirmfuellende Ansicht auf einem
-- Handy und haelt sowohl Speicher- als auch Bandbreitenverbrauch im
-- Gratis-Kontingent gering, auch bei vielen Mitgliedern.

alter table public.players add column if not exists avatar_photo_at timestamptz;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Oeffentlich lesbar (kein Policy-Bedarf fuer SELECT bei public=true), aber
-- Schreiben/Loeschen nur fuer den eigenen Dateinamen "<eigene player_id>.jpg".
drop policy if exists "avatar_write_own" on storage.objects;
create policy "avatar_write_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and name = (select id::text from players where auth_user_id = auth.uid()) || '.jpg'
  );

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and name = (select id::text from players where auth_user_id = auth.uid()) || '.jpg'
  );

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and name = (select id::text from players where auth_user_id = auth.uid()) || '.jpg'
  );

-- avatar_photo_at dient zugleich als Existenz-Flag (null = kein Foto) und als
-- Cache-Buster fuer die Bild-URL, damit nach einem Reupload nicht noch das
-- alte, gecachte Bild angezeigt wird.
create or replace function public.set_avatar_photo(p_has_photo boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update players set avatar_photo_at = case when p_has_photo then now() else null end
    where auth_user_id = auth.uid();
end;
$$;

-- self_delete_account() (aus 2026-08-26_account_deletion_and_feedback.sql)
-- um das Entfernen der Foto-Datei erweitern, damit eine Loeschung
-- wirklich rueckstandsfrei ist.
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

  -- Eigene, rein persoenliche Daten vollstaendig entfernen.
  delete from ping_replies where player_id = v_me;
  delete from pings where player_id = v_me;
  delete from challenges where challenger_id = v_me or challenged_id = v_me;
  delete from ghost_games where player_id = v_me;
  delete from storage.objects where bucket_id = 'avatars' and name = v_me::text || '.jpg';

  -- Spieler-Zeile anonymisieren statt loeschen (Match-Historie anderer bleibt intakt).
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

  -- Login-Konto vollstaendig und unwiderruflich entfernen. Muss NACH dem
  -- obigen UPDATE laufen (auth_user_id dort schon auf null gesetzt), damit
  -- eine etwaige ON DELETE CASCADE-Regel auf players.auth_user_id nicht
  -- die gerade erst anonymisierte Zeile mitreisst.
  delete from auth.users where id = v_auth_id;
end;
$$;
