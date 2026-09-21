-- Sicherheitsnetz fuer die Werbe-Erfolge, damit der Fall "Zuordnung steht in
-- der Datenbank, Erfolg fehlt trotzdem" kuenftig gar nicht mehr entstehen kann.
--
-- Bisher wurde compute_recruit_badges() nur an bestimmten Stellen aufgerufen:
-- frueher ausschliesslich ueber den Badge-Trigger an bestaetigten Matches,
-- seit 2026-09-21 zusaetzlich am Ende von register_player(). Jeder andere Weg,
-- auf dem players.invited_by gesetzt wird - ein Nachtrag per SQL, ein spaeter
-- ergaenztes Admin-Werkzeug -, laesst die Erfolge dagegen unberuehrt, bis
-- zufaellig irgendwann ein Match bestaetigt wird. Genau das ist beim Nachtragen
-- der Alt-Werbungen am 21.09. passiert und sah von aussen wie ein Fehler in der
-- Badge-Logik aus, obwohl die Logik korrekt war und schlicht niemand sie
-- aufgerufen hat.
--
-- Der Trigger unten haengt die Berechnung direkt an die Datenaenderung: sobald
-- invited_by geschrieben wird - egal von wem, egal auf welchem Weg -, laufen
-- die Werbe-Erfolge nach. Anweisungs-Trigger (statement level), weil
-- compute_recruit_badges() ohnehin alle Werber auf einmal neu bewertet; ein
-- Zeilen-Trigger wuerde bei einem Sammel-Update nur unnoetig oft dasselbe tun.
--
-- Ausserdem wird compute_recruit_badges() hier zum ersten Mal ueberhaupt in
-- einer Migrationsdatei festgeschrieben. Die Funktion existierte bisher nur
-- direkt in den beiden Datenbanken, war also nicht versioniert - beim Suchen
-- des Fehlers musste erst per Abfrage geklaert werden, ob Test und Produktion
-- dieselbe Fassung haben (sie hatten es). Die Definition unten ist exakt die
-- bestehende, inhaltlich aendert sich nichts.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion:
-- wofsutwidaitloeiwnma) - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.compute_recruit_badges()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into player_badges (player_id, badge_key)
  select r.invited_by, t.key
  from (select invited_by, count(*) as n from players
        where invited_by is not null group by invited_by) r
  cross join (values ('recruit1',1),('recruit3',3),('recruit5',5)) as t(key, thr)
  where r.n >= t.thr
  on conflict do nothing;
end;
$function$;

create or replace function public.trg_compute_recruit_badges()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  perform compute_recruit_badges();
  return null;
end;
$function$;

drop trigger if exists players_recruit_badges on public.players;
create trigger players_recruit_badges
  after insert or update of invited_by on public.players
  for each statement execute function public.trg_compute_recruit_badges();

-- Einmalig mitlaufen lassen, damit vorhandene Zuordnungen sofort stimmen.
select compute_recruit_badges();
