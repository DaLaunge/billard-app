-- Club-Logos (Ergaenzung zu 2026-10-19b_clubs.sql). Bewusst winzig, damit weder Datenbank noch Speicher wachsen:
--   * Die Bilddatei liegt NICHT in der Datenbank, sondern im Storage-Bucket "club-logos" (oeffentlich lesbar, eine Datei je
--     Club: "<club_id>/logo"). In der Tabelle steht nur der Zeitstempel clubs.logo_at (Cache-Version, null = kein Logo).
--   * Der Bucket lehnt serverseitig alles ueber 20 KB ab und erlaubt nur WebP/JPEG/PNG. Die App verkleinert vorher auf
--     128 x 128 Pixel (meist 3-8 KB, hoechstens ~12 KB), so passen tausende Clubs in wenige MB.
--   * Hochladen/Ersetzen/Loeschen darf nur die Club-Leitung (owner/admin) des Ordners, Loeschen zusaetzlich App-Admins.
--     Die oeffentliche URL ist unabhaengig von diesen Regeln lesbar (wie bei den Profilfotos).
--   * Ein Club-Loeschen kann die Datei nicht per SQL entfernen (Supabase sperrt direktes Loeschen auf storage.objects); die
--     App ruft dafuer vorher die Storage-API (siehe 2026-09-09d_fix_avatar_storage_delete.sql).
--
-- Voraussetzung: 2026-10-19b_clubs.sql. Test, dann Produktion. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-logos', 'club-logos', true, 20480, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 20480, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

alter table public.clubs add column if not exists logo_at timestamptz;
grant select (logo_at) on public.clubs to authenticated;

-- Ordnername ("<club_id>") sicher in eine Club-Pruefung uebersetzen (Nicht-UUIDs ergeben false statt eines Fehlers)
create or replace function public.club_can_manage_text(p_folder text)
 returns boolean language sql stable security definer set search_path to 'public'
as $$ select case when p_folder ~ '^[0-9a-fA-F-]{36}$' then club_can_manage(p_folder::uuid) else false end; $$;
revoke execute on function public.club_can_manage_text(text) from public, anon;
grant execute on function public.club_can_manage_text(text) to authenticated, service_role;

-- SELECT-Policy ist noetig, damit ein Upload ("INSERT ... RETURNING") durchgeht (siehe 2026-08-29_avatar_photo_fix_rls_v3.sql)
drop policy if exists "club_logo_select" on storage.objects;
create policy "club_logo_select" on storage.objects for select to authenticated
  using (bucket_id = 'club-logos' and club_can_manage_text((storage.foldername(name))[1]));

drop policy if exists "club_logo_insert" on storage.objects;
create policy "club_logo_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'club-logos' and club_can_manage_text((storage.foldername(name))[1]));

drop policy if exists "club_logo_update" on storage.objects;
create policy "club_logo_update" on storage.objects for update to authenticated
  using (bucket_id = 'club-logos' and club_can_manage_text((storage.foldername(name))[1]));

drop policy if exists "club_logo_delete" on storage.objects;
create policy "club_logo_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'club-logos' and (club_can_manage_text((storage.foldername(name))[1]) or is_admin()));

-- Zeitstempel setzen/loeschen (nur Club-Leitung)
create or replace function public.set_club_logo(p_club uuid, p_has_logo boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not club_can_manage(p_club) then raise exception 'Nur die Club-Leitung darf das Logo ändern.'; end if;
  update clubs set logo_at = case when p_has_logo then now() else null end where id = p_club;
end;
$function$;
revoke execute on function public.set_club_logo(uuid, boolean) from public, anon;
grant execute on function public.set_club_logo(uuid, boolean) to authenticated, service_role;

-- Kontrolle: Bucket mit Limit
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'club-logos';
