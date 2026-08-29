-- Fix: Foto-Upload schlug mit "new row violates row-level security policy" fehl,
-- obwohl Bucket, Spalte und RPC alle korrekt angelegt waren (live geprüft).
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.
--
-- Ursache: die urspruengliche Policy hat direkt eine Subquery gegen
-- "players" in die storage.objects-Policy geschrieben:
--   name = (select id::text from players where auth_user_id = auth.uid()) || '.jpg'
-- Die Storage-API von Supabase fuehrt Objekt-Schreibzugriffe ueber einen
-- eigenen internen Verbindungskontext aus - dabei liefert genau diese
-- verschachtelte Subquery gegen eine ANDERE Tabelle offenbar keine Zeile
-- zurueck (vermutlich weil der RLS-Kontext von "players" dort nicht
-- gleich durchgereicht wird wie bei normalen PostgREST-Anfragen), wodurch
-- die gesamte Bedingung zu NULL/false wird und JEDER Insert abgelehnt wird -
-- unabhaengig vom eingeloggten Nutzer.
--
-- Fix: dieselbe Loesung, die im Rest der App schon ueberall funktioniert -
-- die Aufloesung auth.uid() -> players.id in eine SECURITY DEFINER-Funktion
-- auslagern (laeuft mit erhoehten Rechten, unabhaengig von RLS-Kontext-
-- Eigenheiten anderer Tabellen), statt die Subquery direkt in der Policy.

create or replace function public.owns_avatar_object(p_object_name text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_me uuid;
begin
  select id into v_me from players where auth_user_id = auth.uid();
  return v_me is not null and p_object_name = v_me::text || '.jpg';
end;
$$;

drop policy if exists "avatar_write_own" on storage.objects;
create policy "avatar_write_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and owns_avatar_object(name));

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and owns_avatar_object(name));

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and owns_avatar_object(name));
