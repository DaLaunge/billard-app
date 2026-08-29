-- Fix v2: Der SECURITY-DEFINER-Ansatz aus 2026-08-29_avatar_photo_fix_rls.sql
-- hat das Problem NICHT geloest (live erneut getestet, exakt derselbe Fehler:
-- "new row violates row-level security policy"). Live-Diagnose zeigte: die
-- Funktion owns_avatar_object(...) liefert bei direktem RPC-Aufruf korrekt
-- true, aber der eigentliche Upload durch die Storage-API schlaegt trotzdem
-- fehl - das deutet darauf hin, dass auth.uid() innerhalb der Storage-
-- Policy-Auswertung (bzw. in einer von dort aufgerufenen Funktion, die eine
-- ANDERE Tabelle abfragt) in diesem Projekt nicht zuverlaessig aufgeloest wird.
--
-- Wechsel auf das offizielle Supabase-Standardmuster fuer nutzereigene
-- Dateien: Pfad "<auth_user_id>/avatar.jpg" (ein Ordner pro Login) statt
-- "<player_id>.jpg", geprueft ueber storage.foldername(name) direkt gegen
-- auth.uid() - keine Subquery/Funktion mehr noetig. Das ist das mit Abstand
-- am haeufigsten verwendete, offiziell dokumentierte Muster fuer Storage-RLS.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

drop policy if exists "avatar_write_own" on storage.objects;
create policy "avatar_write_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- self_delete_account() an den neuen Pfad anpassen ("<auth_user_id>/avatar.jpg"
-- statt "<player_id>.jpg").
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
