-- Ortsvorschlag bei Duellen: Wer das Duell ausschreibt kann ein Lokal angeben, der Herausgeforderte kann ein anderes vorschlagen.
-- Voraussetzung: 2026-10-27b_locations.sql (Tabelle locations). Test, dann Produktion. Idempotent.
--
-- * challenges.location_id = der aktuelle Ortsvorschlag (Lokal aus dem Katalog), challenges.location_by = wer ihn zuletzt gesetzt hat.
-- * set_challenge_location(p_challenge_id, p_location_id): nur die beiden Beteiligten, nur solange das Duell offen ist;
--   p_location_id = null entfernt den Vorschlag.
-- * Die App liest die zwei Spalten getrennt vom restlichen Duell (ohne diese Datei fehlt nur der Ortsvorschlag).

alter table public.challenges add column if not exists location_id uuid references public.locations(id) on delete set null;
alter table public.challenges add column if not exists location_by uuid references public.players(id) on delete set null;

create or replace function public.set_challenge_location(p_challenge_id uuid, p_location_id uuid)
returns void
language plpgsql security definer set search_path = public as $function$
declare
  me uuid := current_player_id();
  v_c public.challenges;
begin
  if me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  select * into v_c from challenges where id = p_challenge_id;
  if not found then raise exception 'Duell nicht gefunden.'; end if;
  if me not in (v_c.challenger_id, v_c.challenged_id) then raise exception 'Nur für die Beteiligten.'; end if;
  if v_c.status <> 'open' then raise exception 'Das Duell ist nicht mehr offen.'; end if;
  if p_location_id is not null and not exists (select 1 from locations where id = p_location_id) then raise exception 'Lokal nicht gefunden.'; end if;
  update challenges set location_id = p_location_id, location_by = case when p_location_id is null then null else me end where id = p_challenge_id;
end;
$function$;

revoke all on function public.set_challenge_location(uuid, uuid) from public, anon;
grant execute on function public.set_challenge_location(uuid, uuid) to authenticated;
