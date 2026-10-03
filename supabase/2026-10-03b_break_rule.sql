-- Nutzer-Wunsch: "Baue bei jedem Turniermodus einen Schalter ein, der
-- entscheidet ob Winner-Break oder Wechselbreak. ... Als Defaultwert nimm
-- Wechselbreak." - Wer das naechste Rack anstoesst: 'winner' = der Sieger des
-- vorigen Racks, 'alternate' = abwechselnd (Wechselbreak, Vorgabe).
--
-- break_rule steht am Turnier bzw. an der Winner-Stays-Runde (eine Einstellung
-- fuer alle Partien dort). Gesetzt wird sie NICHT ueber create_tournament()/
-- winner_stays_create_session() (die haben schon viele Parameter und wurden
-- oft neu definiert), sondern nach dem Anlegen ueber set_break_rule() - das
-- dient zugleich dem spaeteren Umschalten durch die Turnierleitung. Die
-- Spalte hat die Vorgabe 'alternate', bestehende Turniere/Runden gelten damit
-- als Wechselbreak.
--
-- Normale Matches (Neues Match) speichern die Regel bewusst NICHT: dort ist
-- sie nur eine Anzeige-/Merkhilfe waehrend der Aufzeichnung (pro Geraet in
-- localStorage). Ein UPDATE auf matches wuerde zudem den kompletten
-- Rating-Neuaufbau ausloesen (siehe matches_rebuild_ratings).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

alter table public.tournaments
  add column if not exists break_rule text not null default 'alternate';
alter table public.winner_stays_sessions
  add column if not exists break_rule text not null default 'alternate';

do $$
begin
  alter table public.tournaments
    add constraint tournaments_break_rule_check check (break_rule in ('alternate', 'winner'));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.winner_stays_sessions
    add constraint winner_stays_sessions_break_rule_check check (break_rule in ('alternate', 'winner'));
exception when duplicate_object then null;
end $$;

create or replace function public.set_break_rule(p_kind text, p_id uuid, p_rule text)
returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := current_player_id();
  v_org uuid;
  v_status text;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if p_rule not in ('alternate', 'winner') then raise exception 'Ungültige Anstoß-Regel.'; end if;

  if p_kind = 'tournament' then
    select organizer_id, status into v_org, v_status from tournaments where id = p_id;
    if not found then raise exception 'Turnier nicht gefunden.'; end if;
    if not (is_admin() or v_org = v_me) then raise exception 'Nur die Turnierleitung kann das ändern.'; end if;
    if v_status = 'finished' then raise exception 'Das Turnier ist beendet.'; end if;
    update tournaments set break_rule = p_rule where id = p_id;
  elsif p_kind = 'winner_stays' then
    select organizer_id, status into v_org, v_status from winner_stays_sessions where id = p_id;
    if not found then raise exception 'Runde nicht gefunden.'; end if;
    if not (is_admin() or v_org = v_me) then raise exception 'Nur die Leitung dieser Runde kann das ändern.'; end if;
    if v_status = 'finished' then raise exception 'Diese Runde ist beendet.'; end if;
    update winner_stays_sessions set break_rule = p_rule where id = p_id;
  else
    raise exception 'Unbekannte Art.';
  end if;
end;
$function$;
