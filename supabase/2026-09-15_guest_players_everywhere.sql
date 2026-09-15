-- Gast-Spieler ueber Turniere hinaus (Nutzer-Feedback): Gaeste sollen auch bei
-- normalen (Nicht-Turnier-)Matches mitspielen koennen, nicht nur wenn ein
-- Turnierleiter sie waehrend der Turnier-Anmeldephase anlegt
-- (tournament_organizer_add_guest(), siehe 2026-09-10_tournament_guests.sql).
-- Dazu kommt ein Gast-Login direkt im Anmeldescreen (Supabase Anonymous
-- Sign-In), damit auch jemand ohne Account kurz als Gast in der App
-- auftauchen kann. Beides nutzt die bestehende players.is_guest-Spalte
-- (Punkt 2 aus dem Feedback - kein Ranking-Einfluss fuer Gast UND Gegner -
-- ist dadurch schon generisch ueber rebuild_elo() abgedeckt, siehe dort;
-- diese Migration aendert rebuild_elo() bewusst NICHT).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- =========================================================================
-- 1) add_guest_player(): wie tournament_organizer_add_guest(), aber ohne
--    Turnier-Anmeldung und ohne Organisator/Admin-Einschraenkung - jeder
--    eingeloggte Spieler (auch ein per Gast-Login eingeloggter Gast) darf
--    fuer ein normales Match einen neuen Gast anlegen.
-- =========================================================================
create or replace function public.add_guest_player(p_nickname text)
returns players
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me   uuid := current_player_id();
  v_nick text := trim(coalesce(p_nickname, ''));
  v_guest players;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if v_nick = '' then raise exception 'Name fehlt.'; end if;
  if char_length(v_nick) > 30 then raise exception 'Name ist zu lang (max. 30 Zeichen).'; end if;

  begin
    insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
  exception when unique_violation then
    raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
  end;

  return v_guest;
end;
$function$;

grant execute on function public.add_guest_player(text) to authenticated;

-- =========================================================================
-- 2) guest_self_signup(): Gegenstueck zu register_player(), aber nur fuer
--    anonyme Sessions (Supabase Anonymous Sign-In vom Login-Screen aus) -
--    legt IMMER eine frische is_guest-Zeile an, nie eine Alt-Account-
--    Uebernahme (siehe Fix an register_player() unten), damit ein Gast nie
--    versehentlich die Historie eines echten Mitglieds "erbt".
-- =========================================================================
create or replace function public.guest_self_signup(p_nickname text)
returns players
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_nick        text := trim(coalesce(p_nickname, ''));
  v_is_anon     boolean;
  v_row         players;
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt.'; end if;
  select is_anonymous into v_is_anon from auth.users where id = auth.uid();
  if not coalesce(v_is_anon, false) then
    raise exception 'Gast-Anmeldung ist nur fuer anonyme Sessions vorgesehen.';
  end if;
  if exists (select 1 from players where auth_user_id = auth.uid()) then
    raise exception 'Zu diesem Login existiert bereits ein Spieler.';
  end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then
    raise exception 'Nickname muss 2 bis 30 Zeichen lang sein.';
  end if;

  begin
    insert into players (auth_user_id, nickname, is_guest)
    values (auth.uid(), v_nick, true)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
  end;

  return v_row;
end;
$function$;

grant execute on function public.guest_self_signup(text) to authenticated;

-- =========================================================================
-- 3) register_player(): identisch zur bisherigen Logik (siehe
--    2026-08-31_single_use_invites.sql), nur die Alt-Account-Uebernahme
--    schliesst jetzt zusaetzlich is_guest aus (bisher nur is_ghost) - sonst
--    wuerde ein echtes Mitglied, das zufaellig denselben Namen wie ein
--    bestehender Gast waehlt, dessen Gast-Zeile uebernehmen und waere
--    danach dauerhaft (is_guest bleibt true) vom Ranking ausgeschlossen.
-- =========================================================================
create or replace function public.register_player(p_nickname text, p_ref text default null::text)
returns players
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_nick      text := trim(p_nickname);
  v_row       players;
  v_inviter   uuid;
  v_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht eingeloggt.';
  end if;
  if exists (select 1 from players where auth_user_id = auth.uid()) then
    raise exception 'Zu diesem Login existiert bereits ein Spieler.';
  end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then
    raise exception 'Nickname muss 2 bis 30 Zeichen lang sein.';
  end if;

  if p_ref is not null and trim(p_ref) <> '' then
    select id, inviter_id into v_invite_id, v_inviter
      from invites where code = upper(trim(p_ref)) and used_by is null;
  end if;

  -- Alt-Spieler übernehmen – aber NIE den Ghost oder einen Gast
  update players
     set auth_user_id = auth.uid(),
         invited_by   = coalesce(invited_by, v_inviter)
   where nickname = v_nick
     and auth_user_id is null
     and not is_ghost
     and not coalesce(is_guest, false)
  returning * into v_row;

  if not found then
    insert into players (auth_user_id, nickname, invited_by)
    values (auth.uid(), v_nick, v_inviter)
    returning * into v_row;
  end if;

  if v_invite_id is not null then
    update invites set used_by = v_row.id, used_at = now() where id = v_invite_id;
  end if;

  return v_row;
end;
$function$;

-- =========================================================================
-- 4) report_match(): identisch zur bisherigen Logik (siehe
--    2026-09-02_141_run_log.sql), nur die Auto-Bestaetigung gilt jetzt
--    zusaetzlich, wenn Gegner ODER Melder ein Gast ist (nicht nur wenn der
--    Gegner der Ghost ist) - ein Gast kann nicht bestaetigen, also darf das
--    Match nicht auf eine Bestaetigung warten.
-- =========================================================================
create or replace function public.report_match(
  p_opponent_id uuid, p_my_score integer, p_opp_score integer, p_discipline text,
  p_high_run_me integer default null::integer, p_high_run_opp integer default null::integer,
  p_deficit_me integer default null::integer, p_deficit_opp integer default null::integer,
  p_avg_me numeric default null::numeric, p_avg_opp numeric default null::numeric,
  p_twoball_me integer default null::integer, p_twoball_opp integer default null::integer,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me           uuid := current_player_id();
  v_opp_ghost    boolean;
  v_opp_guest    boolean;
  v_me_guest     boolean;
  v_auto_confirm boolean;
  v_row          matches;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login. Bitte zuerst registrieren.'; end if;
  if p_opponent_id = v_me then raise exception 'Gegen dich selbst kannst du nicht spielen. ;-)'; end if;
  if not exists (select 1 from players where id = p_opponent_id) then
    raise exception 'Gegner nicht gefunden.'; end if;
  if p_my_score = p_opp_score then
    raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select is_ghost, coalesce(is_guest, false) into v_opp_ghost, v_opp_guest from players where id = p_opponent_id;
  select coalesce(is_guest, false) into v_me_guest from players where id = v_me;
  v_auto_confirm := coalesce(v_opp_ghost, false) or v_opp_guest or v_me_guest;

  insert into matches (player1_id, player2_id, score1, score2, discipline,
                       reported_by, confirmed, high_run1, high_run2, deficit1, deficit2,
                       avg1, avg2, twoball1, twoball2, run_log)
  values (v_me, p_opponent_id, p_my_score, p_opp_score, trim(p_discipline),
          v_me, v_auto_confirm,
          p_high_run_me, p_high_run_opp, p_deficit_me, p_deficit_opp,
          p_avg_me, p_avg_opp, p_twoball_me, p_twoball_opp, p_run_log)
  returning * into v_row;
  return v_row;
end;
$function$;

-- =========================================================================
-- 5) report_doubles(): identisch zur bisherigen Logik (siehe
--    2026-09-02_doubles_run_log.sql), nur: sind Partner/Gegner1/Gegner2/ich
--    selbst irgendeiner ein Gast, wird sofort bestaetigt und es werden
--    KEINE match_confirmations-Zeilen angelegt (ein Gast kann nicht
--    bestaetigen - sonst wuerde das Doppel ewig auf seine Bestaetigung
--    warten).
-- =========================================================================
create or replace function public.report_doubles(
  p_partner_id uuid, p_opp1_id uuid, p_opp2_id uuid,
  p_my_score integer, p_opp_score integer, p_discipline text,
  p_run_log jsonb default null
)
 returns matches
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me       uuid := current_player_id();
  v_row      matches;
  ids        uuid[];
  v_has_guest boolean;
begin
  if v_me is null then raise exception 'Kein Spielerprofil zu diesem Login.'; end if;
  ids := array[v_me, p_partner_id, p_opp1_id, p_opp2_id];
  -- alle vier verschieden?
  if (select count(distinct x) from unnest(ids) x) <> 4 then
    raise exception 'Für ein Doppel braucht es vier verschiedene Spieler.';
  end if;
  if exists (select 1 from players where id = any(ids) and coalesce(is_ghost, false)) then
    raise exception 'Der Ghost kann bei einem Doppel nicht mitspielen.';
  end if;
  if exists (select 1 from unnest(ids) x where not exists (select 1 from players where id = x)) then
    raise exception 'Ein Spieler wurde nicht gefunden.';
  end if;
  if p_my_score = p_opp_score then raise exception 'Unentschieden gibt es beim Billard nicht.'; end if;
  if coalesce(trim(p_discipline), '') = '' then raise exception 'Disziplin fehlt.'; end if;

  select exists (select 1 from players where id = any(ids) and coalesce(is_guest, false)) into v_has_guest;

  insert into matches (player1_id, player1b_id, player2_id, player2b_id,
                       score1, score2, discipline, reported_by, confirmed, run_log)
  values (v_me, p_partner_id, p_opp1_id, p_opp2_id,
          p_my_score, p_opp_score, trim(p_discipline), v_me, v_has_guest, p_run_log)
  returning * into v_row;

  -- die drei anderen müssen bestätigen - ausser es ist ein Gast dabei
  if not v_has_guest then
    insert into match_confirmations (match_id, player_id) values
      (v_row.id, p_partner_id), (v_row.id, p_opp1_id), (v_row.id, p_opp2_id);
  end if;

  return v_row;
end;
$function$;
