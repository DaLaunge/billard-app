-- Nutzer-Wunsch 2026-10-09: "Gaeste sollten keine Achievements bekommen."
--
-- Gaeste (players.is_guest) zaehlen schon lange nicht fuer Rating, Statistik und
-- match-basierte Erfolge (2026-09-15b/c). Es gab aber zwei Luecken, in denen sie
-- trotzdem Erfolge bekamen: "Mitglied seit 1 Woche" (member_1w, haengt an der
-- Mitgliedsdauer, nicht an einem Match) und - sobald ein Gast ein Turnier gewinnt -
-- die Turnier-Erfolge aus compute_tournament_badges().
--
-- Statt jede compute_*()-Funktion einzeln anzufassen (es sind viele, und die
-- naechste kaeme wieder ohne Schutz), sperrt ein Trigger das Vergeben zentral:
-- BEFORE INSERT auf player_badges verwirft jede Zeile fuer einen Gast (RETURN NULL
-- = Zeile wird still uebersprungen, `on conflict do nothing` und alle INSERT ...
-- SELECT der compute_*()-Funktionen laufen normal weiter, nur ohne Gast-Zeilen).
-- Dazu werden die bereits vergebenen Gast-Erfolge einmalig entfernt.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test. Mehrfaches
-- Ausfuehren ist unschaedlich.

create or replace function public.trg_no_badges_for_guests()
returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if exists (select 1 from players p where p.id = new.player_id and coalesce(p.is_guest, false)) then
    return null;
  end if;
  return new;
end;
$function$;

drop trigger if exists no_badges_for_guests on public.player_badges;
create trigger no_badges_for_guests
  before insert on public.player_badges
  for each row execute function public.trg_no_badges_for_guests();

-- Bereits vergebene Gast-Erfolge entfernen (Test: 11 x member_1w).
delete from public.player_badges b
 using public.players p
 where p.id = b.player_id and coalesce(p.is_guest, false);

-- Kontrolle: muss 0 liefern.
-- select count(*) from public.player_badges b join public.players p on p.id = b.player_id where p.is_guest;
