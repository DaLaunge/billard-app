-- Match-Liste inkrementell laden statt bei jedem loadData() komplett.
--
-- Hintergrund: die App hat bei jedem Start und nach jedem Speichern ALLE
-- Matches geladen (Sept. 2026: 644 Matches, ~450 KB pro Aufruf, ~80 % des
-- gesamten Supabase-Egress). Jetzt merkt sich jedes Geraet die Matches
-- (src/lib/matchCache.js) und holt nur noch, was sich seit dem letzten Mal
-- geaendert hat. Dafuer braucht es zwei Dinge:
--
-- 1) matches.updated_at - bei jedem UPDATE per Trigger neu gesetzt (auch
--    Bestaetigung, Turnier-Korrektur usw.). Neue Zeilen bekommen now() als
--    Default. Bestehende Zeilen bekommen beim Hinzufuegen der Spalte den
--    Zeitpunkt dieser Migration - harmlos, Geraete ohne Cache laden ohnehin
--    alles.
-- 2) deleted_matches - geloeschte Match-IDs (per Trigger), damit Geraete sie
--    auch aus ihrem Cache entfernen. Eintraege aelter als 30 Tage werden beim
--    naechsten Loeschen mit aufgeraeumt: Geraete laden spaetestens alle 14
--    Tage ohnehin komplett neu.
--
-- In Test UND Produktion ausfuehren. Idempotent. Die App funktioniert auch
-- ohne diese Migration (sie laedt dann weiter alles komplett).

alter table public.matches
  add column if not exists updated_at timestamptz not null default now();
create index if not exists matches_updated_at_idx on public.matches (updated_at);

create or replace function public.trg_matches_touch_updated_at()
returns trigger
language plpgsql as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists matches_touch_updated_at on public.matches;
create trigger matches_touch_updated_at
  before update on public.matches
  for each row execute function public.trg_matches_touch_updated_at();

create table if not exists public.deleted_matches (
  match_id uuid primary key,
  deleted_at timestamptz not null default now()
);
create index if not exists deleted_matches_deleted_at_idx on public.deleted_matches (deleted_at);
alter table public.deleted_matches enable row level security;
drop policy if exists mitglieder_lesen_deleted_matches on public.deleted_matches;
create policy mitglieder_lesen_deleted_matches on public.deleted_matches
  for select to authenticated using (true);

create or replace function public.trg_matches_log_delete()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into deleted_matches (match_id) values (old.id)
  on conflict (match_id) do update set deleted_at = now();
  delete from deleted_matches where deleted_at < now() - interval '30 days';
  return old;
end;
$function$;

drop trigger if exists matches_log_delete on public.matches;
create trigger matches_log_delete
  after delete on public.matches
  for each row execute function public.trg_matches_log_delete();
