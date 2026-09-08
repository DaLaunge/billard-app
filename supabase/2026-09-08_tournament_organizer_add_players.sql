-- Nutzer-Feedback: die Selbst-Anmeldung ("Turnier beitreten") ist gut, aber
-- die Turnierleitung moechte Spieler wie vorher auch weiterhin MANUELL
-- hinzufuegen koennen (der alte PlayerMultiPicker-Auswahlschirm hat gut
-- gefallen) - als Ergaenzung zur Selbst-Anmeldung, nicht als Ersatz. Beide
-- Wege fuehren zum selben Ziel (eine Zeile in tournament_players) und
-- funktionieren nur waehrend status='setup', genau wie tournament_register/
-- tournament_unregister. Symmetrisch dazu kann die Turnierleitung auch
-- jeden Spieler (egal ob selbst angemeldet oder manuell hinzugefuegt)
-- wieder entfernen, bevor das Turnier startet.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.tournament_organizer_add_players(p_tournament_id uuid, p_player_ids uuid[])
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
  v_players uuid[];
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann Spieler hinzufügen.';
  end if;
  if v_tour.status <> 'setup' then raise exception 'Spieler können nur während der Anmeldephase hinzugefügt werden.'; end if;

  select array_agg(distinct x) into v_players from unnest(p_player_ids) x;
  if coalesce(array_length(v_players, 1), 0) = 0 then raise exception 'Keine Spieler ausgewählt.'; end if;
  if exists (
    select 1 from unnest(v_players) pid
    where not exists (select 1 from players where id = pid)
       or exists (select 1 from players where id = pid and coalesce(is_ghost, false))
  ) then
    raise exception 'Auswahl enthält einen ungültigen Spieler oder den Ghost.';
  end if;

  insert into tournament_players (tournament_id, player_id)
  select p_tournament_id, pid from unnest(v_players) pid
  on conflict do nothing;
end;
$function$;

create or replace function public.tournament_organizer_remove_player(p_tournament_id uuid, p_player_id uuid)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_tour tournaments;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if not (is_admin() or v_tour.organizer_id = v_me) then
    raise exception 'Nur der Turnierleiter oder ein Admin kann Spieler entfernen.';
  end if;
  if v_tour.status <> 'setup' then raise exception 'Spieler können nur während der Anmeldephase entfernt werden.'; end if;
  delete from tournament_players where tournament_id = p_tournament_id and player_id = p_player_id;
end;
$function$;
