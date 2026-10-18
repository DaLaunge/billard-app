-- Farbthema "Petrol" (teal) faellt weg (Gruen und Petrol waren kaum zu unterscheiden), neu ist "Pink" (pink, knalliges Rosa).
-- Der kurzlebige Entwurf "Beere" (berry) wird zu pink. "Lila" (purple) bleibt als Schluessel, heisst und sieht aber als "Indigo"
-- blauvioletter aus (nur Aenderung in der App).
-- Wer Petrol gewaehlt hatte, bekommt Gruen (sieht fast gleich aus). 'teal' bleibt als erlaubter Wert stehen, damit eine noch
-- nicht aktualisierte App-Version nicht mit einem Fehler scheitert (die App bildet teal selbst auf green ab).
--
-- Test, dann Produktion. Idempotent.

update public.players set theme_key = 'green' where theme_key = 'teal';
update public.players set theme_key = 'pink' where theme_key = 'berry';

alter table public.players drop constraint if exists players_theme_key_check;
alter table public.players add constraint players_theme_key_check
  check (theme_key in ('green', 'black', 'red', 'blue', 'purple', 'brown', 'teal', 'berry', 'pink', 'custom'));

create or replace function public.set_theme(p_theme_key text, p_theme_custom jsonb default null)
 returns players
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me  uuid := current_player_id();
  v_row players;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if p_theme_key not in ('green', 'black', 'red', 'blue', 'purple', 'brown', 'teal', 'berry', 'pink', 'custom') then
    raise exception 'Unbekanntes Farbthema.';
  end if;

  update players
     set theme_key    = p_theme_key,
         theme_custom = case when p_theme_key = 'custom' then p_theme_custom else null end
   where id = v_me
  returning * into v_row;

  return v_row;
end;
$function$;

-- Kontrolle
select theme_key, count(*) from players group by 1 order by 1;
