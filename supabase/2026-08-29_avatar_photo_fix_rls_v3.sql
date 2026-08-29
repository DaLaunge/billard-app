-- Fix v3 (die eigentliche Ursache): Ein Upload ist intern ein
-- "INSERT ... RETURNING *" - ohne passende SELECT-Policy auf storage.objects
-- darf Postgres die eingefuegte Zeile nicht zurueckgeben und lehnt den
-- gesamten Vorgang mit "new row violates row-level security policy" ab -
-- unabhaengig davon, wie die INSERT-Policy aussieht (deshalb scheiterten
-- auch v1, v2 und sogar eine komplett offene Test-Policy identisch).
-- Live durch einen Vergleich mit einer zweiten KI gefunden und bestaetigt:
-- Sobald eine SELECT-Policy fuer storage.objects existiert, funktioniert
-- der Upload sofort.
--
-- Raeumt die Test-Policies auf und setzt den finalen, sicheren Zustand:
-- Schreiben/Lesen/Aendern/Loeschen nur auf den eigenen Ordner
-- "<auth_user_id>/avatar.jpg" (die SELECT-Policy braucht keinen groesseren
-- Radius - das Betrachten fremder Fotos laeuft ueber die oeffentliche
-- Bucket-URL, die komplett unabhaengig von RLS ist).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

drop policy if exists "avatar_write_own_TEST" on storage.objects;
drop policy if exists "avatar_select_TEST" on storage.objects;
drop policy if exists "sandbox_open_TEST" on storage.objects;
drop policy if exists "sandbox_select_TEST" on storage.objects;

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
