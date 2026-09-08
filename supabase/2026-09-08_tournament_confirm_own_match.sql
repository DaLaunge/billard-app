-- Nutzer-Feedback: bei Turniermatches soll die Bestaetigung sofort und
-- zuverlaessig passieren, nicht erst spaeter, wenn der Gegner selbst wieder
-- sein Handy checkt (der hat es vielleicht gar nicht dabei). Loesung: direkt
-- nach dem Melden kann das Ergebnis auf DEMSELBEN Geraet bestaetigt werden -
-- Handy an den Gegner weiterreichen, der tippt "Jetzt direkt bestätigen".
-- Das durchbricht bewusst das sonstige Prinzip "nur der ANDERE bestaetigt"
-- (die Bestaetigung laeuft technisch weiter unter dem Account der/des
-- Meldenden) - eine gewisse Unsicherheit, die der Nutzer fuer schnellere/
-- zuverlaessigere Turnier-Bestaetigungen bewusst in Kauf nimmt. Gilt
-- ausdruecklich NUR fuer Turniermatches, nicht fuer normale Matches (die
-- laufen weiterhin ausschliesslich ueber confirm_match() durch den Gegner
-- selbst) - und nur direkt im Anschluss ans eigene Melden (reported_by
-- muss dem aufrufenden Account entsprechen), keine generelle Moeglichkeit,
-- fremde Matches im Nachhinein selbst zu bestaetigen.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.tournament_confirm_own_match(p_tournament_match_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tm tournament_matches;
  v_match matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tm from tournament_matches where id = p_tournament_match_id;
  if not found then raise exception 'Turnier-Match nicht gefunden.'; end if;
  if v_tm.match_id is null then raise exception 'Für dieses Match wurde noch kein Ergebnis gemeldet.'; end if;

  select * into v_match from matches where id = v_tm.match_id;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if v_match.confirmed then raise exception 'Match ist bereits bestätigt.'; end if;
  if v_match.reported_by is distinct from v_me then
    raise exception 'Nur direkt nach dem eigenen Melden auf diesem Gerät verfügbar.';
  end if;

  update matches set confirmed = true, confirmed_by = v_me where id = v_tm.match_id;
end;
$function$;
