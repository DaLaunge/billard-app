-- Karten-Layout: Nutzer koennen die Karten auf Statistik (spaeter auch
-- Live/Profil) per Drag & Drop in eine eigene Reihenfolge bringen (Nutzer-
-- Feedback: "lange druecken, dann verschieben"). Gespeichert als EIN
-- flaches jsonb-Objekt am Spieler-Datensatz, ein Schluessel je Bildschirm
-- (aktuell nur "stats"), Wert ist die Karten-ID-Reihenfolge als Array - wie
-- diese Reihenfolge auf Spalten (Desktop) bzw. eine Stapel-Reihenfolge
-- (Handy) aufgeteilt wird, entscheidet der Client (siehe
-- src/lib/cardLayout.js), nicht die Datenbank. Analog zu theme_key/
-- start_tab direkt am Spieler-Datensatz gespeichert, damit die Reihenfolge
-- geraeteuebergreifend erhalten bleibt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

alter table public.players
  add column if not exists card_layout jsonb not null default '{}'::jsonb;

-- Speichert die Karten-Reihenfolge fuer EINEN Bildschirm (ueberschreibt nur
-- diesen einen Schluessel im jsonb-Objekt, andere Bildschirme bleiben
-- unangetastet).
create or replace function public.set_card_layout(p_screen text, p_order text[])
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
     set card_layout = jsonb_set(coalesce(card_layout, '{}'::jsonb), array[p_screen], to_jsonb(p_order))
   where id = v_me
  returning * into v_row;

  return v_row;
end;
$function$;

-- Setzt die Karten-Reihenfolge zurueck - ein einzelner Bildschirm (p_screen
-- gesetzt) oder alle auf einmal (p_screen NULL, z.B. ueber den
-- "Zuruecksetzen"-Knopf im Profil, der auch Kugelfarbe/Design/Startseite
-- zuruecksetzt).
create or replace function public.reset_card_layout(p_screen text default null)
returns players
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me  uuid := current_player_id();
  v_row players;
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;

  update players
     set card_layout = case when p_screen is null then '{}'::jsonb
                             else card_layout - p_screen end
   where id = v_me
  returning * into v_row;

  return v_row;
end;
$function$;

grant execute on function public.set_card_layout(text, text[]) to authenticated;
grant execute on function public.reset_card_layout(text) to authenticated;
