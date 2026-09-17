-- Nutzer-Feedback: "Wenn kein Protokoll vorhanden ist, gib in der
-- Matchstatistik einen Button mit Fragezeichen an. Beim Klick darauf
-- kannst du angeben, wer die Eingaben gemacht hat und wann. Das kann nur
-- die Turnierleitung sowie ein Admin sein." - fuer Turniermatches ohne
-- run_log (Turnierleitungs-Schnelleingabe, siehe 2026-09-17_...-Protokoll-
-- UI-Klarstellung "n/a") soll die Turnierleitung/ein Admin dokumentieren
-- koennen, wer das Ergebnis wann nachtraeglich eingetragen hat - fuer
-- Transparenz, da hier ja keine automatische Aufzeichnung existiert.
--
-- manual_entry_note: einfaches Freitextfeld statt getrennter "wer"/"wann"-
-- Spalten - flexibler (z.B. "laut Zettel-Mitschrift von X, eingetragen von
-- Y am 17.09. morgens") und fuer eine reine Dokumentationsnotiz voellig
-- ausreichend, ohne ein eigenes Formular mit Spieler-Auswahl + Datumsfeld
-- zu brauchen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.matches add column if not exists manual_entry_note text;

create or replace function public.set_match_manual_entry_note(p_match_id uuid, p_note text)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_match matches;
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_match from matches where id = p_match_id;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if v_match.tournament_id is null then
    raise exception 'Das geht nur bei Turniermatches.';
  end if;
  select * into v_tour from tournaments where id = v_match.tournament_id;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur die Turnierleitung oder ein Admin kann das eintragen.';
  end if;

  update matches set manual_entry_note = nullif(trim(coalesce(p_note, '')), '') where id = p_match_id;
end;
$function$;
