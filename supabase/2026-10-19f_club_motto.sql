-- Club-Motto (Ergaenzung zu 2026-10-19b_clubs.sql): ein kurzer Spruch des Clubs (hoechstens 80 Zeichen), den die Club-Leitung setzt und der im
-- Club-Profil ("Clubs entdecken", Klick auf einen Club-Tag) steht. Fuer alle lesbar wie Name und Kuerzel (Spalten-Recht).
--
-- update_club() bekommt einen fuenften Parameter p_motto: null = Motto bleibt unveraendert, '' (leer) = Motto loeschen. Die alte Fassung mit vier
-- Parametern wird ersetzt (sonst waeren zwei Ueberladungen mehrdeutig); eine noch nicht aktualisierte App ruft mit vier Parametern auf und trifft
-- die neue Fassung ueber den Vorgabewert - ihr Aufruf aendert das Motto also nie.
--
-- Voraussetzung: 2026-10-19b_clubs.sql. Test, dann Produktion. Idempotent.

alter table public.clubs add column if not exists motto text;
alter table public.clubs drop constraint if exists clubs_motto_len;
alter table public.clubs add constraint clubs_motto_len check (motto is null or char_length(motto) <= 80);
grant select (motto) on public.clubs to authenticated;

drop function if exists public.update_club(uuid, text, text, text);

create or replace function public.update_club(p_club uuid, p_name text, p_tag text, p_color text default null, p_motto text default null)
 returns clubs language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_name text := trim(p_name);
  v_tag text := upper(trim(p_tag));
  v_row clubs;
begin
  if not club_can_manage(p_club) then raise exception 'Nur die Club-Leitung darf das.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'Der Clubname braucht 2 bis 40 Zeichen.'; end if;
  if v_tag !~ '^[A-Z0-9]{2,5}$' then raise exception 'Das Kürzel braucht 2 bis 5 Zeichen (A-Z, 0-9).'; end if;
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Ungültige Farbe.'; end if;
  if p_motto is not null and char_length(trim(p_motto)) > 80 then raise exception 'Das Motto darf höchstens 80 Zeichen haben.'; end if;
  update clubs
     set name = v_name, tag = v_tag, color = p_color,
         motto = case when p_motto is null then motto else nullif(trim(p_motto), '') end
   where id = p_club returning * into v_row;
  return v_row;
exception when unique_violation then
  raise exception 'Name oder Kürzel ist schon vergeben.';
end;
$function$;

revoke execute on function public.update_club(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_club(uuid, text, text, text, text) to authenticated, service_role;

-- Kontrolle: Spalte da, nur eine Fassung von update_club
select (select count(*) from information_schema.columns where table_name = 'clubs' and column_name = 'motto') as motto_spalte,
       (select count(*) from pg_proc where proname = 'update_club') as update_club_fassungen;
