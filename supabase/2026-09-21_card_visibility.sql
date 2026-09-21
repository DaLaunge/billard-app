-- Karten-Sichtbarkeit: der Nutzer kann einzelne Karten ausblenden
-- (Nutzer-Feedback: "es werden mittlerweile so viele Karten, dass es
-- unuebersichtlich ist"). Gespeichert wird das im selben card_layout-Eintrag
-- pro Bildschirm wie Reihenfolge und Spaltenwahl, als zusaetzliches Feld
-- "hidden" (Array von Karten-ids):
--
--   card_layout = {"stats": {"order": [...], "columns": {...}, "hidden": [...]},
--                  "live":  {"hidden": ["planung"]},
--                  "profil":{"hidden": ["tempo", "tickets"]}}
--
-- Am Schema aendert sich dadurch nichts (card_layout ist jsonb und nimmt das
-- Feld ohne Weiteres auf) - noetig ist nur, dass set_card_layout() neben
-- 'stats' jetzt auch 'live' und 'profil' als Bildschirm akzeptiert. Bisher
-- war Drag & Drop nur auf der Statistik moeglich, Ausblenden gibt es auf
-- allen drei Bildschirmen mit mehreren Karten (Turniere haben nur EINE
-- Liste - dort gaebe es nichts auszublenden, ausser der ganzen Seite).
--
-- Die Liste bleibt bewusst eine harte Aufzaehlung statt "beliebiger Text":
-- so kann ein Tippfehler im Client nicht unbemerkt einen vierten, nie
-- gelesenen Schluessel im card_layout anlegen.
--
-- reset_card_layout() bleibt unveraendert: es loescht den ganzen Eintrag
-- eines Bildschirms (bzw. alle) und raeumt damit "hidden" automatisch mit
-- weg - der "Zuruecksetzen"-Knopf im Profil blendet also auch alle Karten
-- wieder ein.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen (nach
-- 2026-09-17b_card_layout_columns.sql).

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
  if p_screen not in ('stats', 'live', 'profil') then
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
