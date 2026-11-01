-- Live gehen mit eigenem Standort (ohne Lokal): z. B. an einem privaten Billardtisch.
-- Test, dann Produktion. Idempotent.
--
-- * pings bekommt lat/lng (optional). Ein Live-Eintrag kann dadurch auch ohne Lokal aus dem Katalog eine Position tragen; der Ping
--   (Umkreissuche) und die Routen-Knoepfe nutzen sie.
-- * create_ping(p_location, p_message, p_hours, p_lat, p_lng): die zwei neuen Parameter sind optional. Die alte Fassung mit drei
--   Parametern wird entfernt, damit der Aufruf eindeutig bleibt.
-- * Die App liest lat/lng getrennt vom restlichen Eintrag (ohne diese Datei fehlen nur Position und Route bei Live-Eintraegen ohne Lokal).

alter table public.pings add column if not exists lat double precision;
alter table public.pings add column if not exists lng double precision;

drop function if exists public.create_ping(text, text, integer);

create or replace function public.create_ping(p_location text, p_message text default null, p_hours integer default 3,
                                              p_lat double precision default null, p_lng double precision default null)
returns pings
language plpgsql security definer set search_path = public as $function$
declare v_me uuid := current_player_id(); v_row pings;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  if char_length(trim(coalesce(p_location, ''))) < 2
     or char_length(trim(p_location)) > 60 then
    raise exception 'Ort muss 2 bis 60 Zeichen lang sein.'; end if;
  if char_length(coalesce(p_message, '')) > 120 then
    raise exception 'Nachricht darf höchstens 120 Zeichen haben.'; end if;
  if p_hours < 1 or p_hours > 12 then
    raise exception 'Dauer muss zwischen 1 und 12 Stunden liegen.'; end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Ungültige Position.'; end if;
  delete from pings where player_id = v_me;
  insert into pings (player_id, location, message, expires_at, lat, lng)
  values (v_me, trim(p_location), nullif(trim(coalesce(p_message, '')), ''),
          now() + make_interval(hours => p_hours), p_lat, p_lng)
  returning * into v_row;
  return v_row;
end; $function$;

revoke all on function public.create_ping(text, text, integer, double precision, double precision) from public, anon;
grant execute on function public.create_ping(text, text, integer, double precision, double precision) to authenticated;
