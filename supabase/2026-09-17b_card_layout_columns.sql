-- Kartenreihenfolge Stufe 2: statt EINEM flachen Array pro Bildschirm (siehe
-- 2026-09-17_card_layout.sql) jetzt ein jsonb-Objekt mit ZWEI Arrays
-- ({"middle": [...], "right": [...]}) - Nutzer-Feedback nach dem ersten
-- Test: die Aufteilung auf die Spalten wurde bisher automatisch aus einer
-- laufenden Hoehensumme berechnet, das fuehlte sich beim Ziehen
-- unvorhersehbar an ("Karten verschieben sich 2 oder 3 Karten weiter statt
-- den Platz zu tauschen"), weil eine einzelne verschobene Karte die
-- Spaltenzuordnung mehrerer anderer Karten mit veraendern konnte. Jetzt legt
-- der Nutzer beide Spalten direkt per Drag & Drop fest (siehe cardLayout.js),
-- keine automatische Umverteilung mehr.
--
-- p_order (text[]) wird zu p_layout (jsonb), weil die gespeicherte Struktur
-- kein flaches Array mehr ist - die alte Funktion mit anderer Signatur muss
-- daher explizit gedroppt werden (CREATE OR REPLACE ersetzt nur bei
-- identischer Parameterliste, sonst entstuende eine zweite, ungenutzte
-- Ueberladung).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen (nach 2026-09-17_card_layout.sql).

drop function if exists public.set_card_layout(text, text[]);

create or replace function public.set_card_layout(p_screen text, p_layout jsonb)
returns players
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me  uuid := current_player_id();
  v_row players;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if p_screen not in ('stats') then
    raise exception 'Unbekannte Ansicht.';
  end if;

  update players
     set card_layout = jsonb_set(coalesce(card_layout, '{}'::jsonb), array[p_screen], p_layout)
   where id = v_me
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.set_card_layout(text, jsonb) to authenticated;
