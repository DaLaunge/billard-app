-- Haertung gegen Bot-Missbrauch des neuen Gast-Logins (Supabase Anonymous
-- Sign-In, siehe 2026-09-15_guest_players_everywhere.sql). Besprochen mit
-- Stefan: das eigentliche Risiko ist nicht, dass ein Bot-Gast selbst irgendwo
-- auftaucht (Gast-Matches sind ja schon folgenlos fuers Rating), sondern dass
-- JEDES eingefuegte Match (auch ein wertloses Gast-Match) per Trigger
-- (matches_rebuild_ratings, trg_matches_streak_extra) einen KOMPLETTEN
-- Neuaufbau ueber die gesamte matches-Tabelle auslöst (rebuild_elo(),
-- compute_badges(), compute_streak_badges() - alle "full recompute", nicht
-- inkrementell, siehe CLAUDE.md). Ein Skript, das im Kreis anonym einloggt,
-- einen Gast anlegt und ein Fantasie-Match eintraegt, koennte darueber die
-- Datenbank-CPU auslasten und die App fuer echte Mitglieder lahmlegen -
-- klassisches Resource-Exhaustion-DoS, nicht ueber die Gast-Daten selbst.
--
-- Drei Bausteine, gemeinsam beschlossen:
-- 1) Captcha fuer Anonymous Sign-In (Cloudflare Turnstile) - separat im
--    Supabase-Dashboard + Client-Code, NICHT Teil dieser SQL-Datei.
-- 2) Rate-Limits hier (Verteidigung in der Tiefe, falls Captcha mal umgangen
--    wird oder ein bereits bestehender Gast-Account missbraucht wird).
-- 3) Naechtlicher Aufraeum-Job fuer inaktive Gast-Spieler.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

-- =========================================================================
-- 1) guest_self_signup(): identisch zur bisherigen Logik (siehe
--    2026-09-15_guest_players_everywhere.sql), zusaetzlich ein globales
--    Burst-Limit - nicht mehr als 40 neue Gast-Spieler (egal ob per
--    Gast-Login oder von einem Mitglied ueber add_guest_player() angelegt)
--    innerhalb von 10 Minuten. Ein normaler Vereinsabend kommt da nie in
--    die Naehe, ein Anmelde-Skript in einer Schleife schon.
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
  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
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

-- =========================================================================
-- 2) add_guest_player(): identisch zur bisherigen Logik, dasselbe globale
--    Burst-Limit wie guest_self_signup() (beide fuellen dieselbe Tabelle).
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
  if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
  end if;

  begin
    insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
  exception when unique_violation then
    raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
  end;

  return v_guest;
end;
$function$;

-- =========================================================================
-- 3) report_match(): identisch zur bisherigen Logik, zusaetzlich ein
--    Rate-Limit NUR auf dem Gast-Pfad (v_auto_confirm) - ein einzelner
--    Account darf nicht mehr als 15 Gast-Matches in 10 Minuten melden.
--    Betrifft normale Matches zwischen zwei echten Mitgliedern NICHT (die
--    brauchen ohnehin eine echte Gegner-Bestaetigung, also keine
--    vergleichbare Missbrauchsflaeche).
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

  if (v_opp_guest or v_me_guest) and (
       select count(*) from matches
       where reported_by = v_me and played_at > now() - interval '10 minutes'
         and exists (select 1 from players p where p.id in (matches.player1_id, matches.player2_id) and p.is_guest)
     ) >= 15 then
    raise exception 'Zu viele Gast-Matches in kurzer Zeit - bitte kurz warten.';
  end if;

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
-- 4) report_doubles(): identisch zur bisherigen Logik, gleiches Rate-Limit
--    wie report_match() (niedrigerer Schwellenwert, Doppel sind seltener).
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

  if v_has_guest and (
       select count(*) from matches
       where reported_by = v_me and player1b_id is not null and played_at > now() - interval '10 minutes'
         and exists (select 1 from players p where p.id in (matches.player1_id, matches.player2_id, matches.player1b_id, matches.player2b_id) and p.is_guest)
     ) >= 10 then
    raise exception 'Zu viele Gast-Matches in kurzer Zeit - bitte kurz warten.';
  end if;

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

-- =========================================================================
-- 5) cleanup_stale_guest_players(): neue Funktion, laeuft nur per Cron
--    (kein grant an authenticated - siehe rebuild_elo()/nightly_refresh(),
--    die ebenfalls keinen Grant haben). Loescht Gast-Spieler (sowohl per
--    Gast-Login als auch von einem Mitglied per add_guest_player()/
--    tournament_organizer_add_guest() angelegte), deren letzte Aktivitaet
--    (Erstellung oder letztes Match) laenger als 14 Tage zurueckliegt -
--    ausser sie stecken gerade in einem laufenden/nicht abgeschlossenen
--    Turnier (sonst wuerde ein Turnierbaum mitten im Ablauf ein Loch
--    bekommen). Loeschlogik bewusst als eigenstaendige Kopie von
--    admin_delete_player() (siehe 2026-09-05_admin_delete_player.sql)
--    gehalten statt gemeinsam extrahiert, um die bestehende, funktionierende
--    Admin-Loeschfunktion nicht anzufassen.
-- =========================================================================
create or replace function public.cleanup_stale_guest_players()
returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_guest      record;
  v_cutoff     constant timestamptz := now() - interval '14 days';
  v_deleted    integer := 0;
begin
  for v_guest in
    select p.id, p.auth_user_id
    from players p
    where p.is_guest
      and greatest(
            p.created_at,
            coalesce((select max(m.played_at) from matches m
                       where m.player1_id = p.id or m.player2_id = p.id
                          or m.player1b_id = p.id or m.player2b_id = p.id), p.created_at)
          ) < v_cutoff
      and not exists (
        select 1 from tournament_players tp
        join tournaments t on t.id = tp.tournament_id
        where tp.player_id = p.id and t.status in ('setup', 'running')
      )
  loop
    update tournament_matches set next_match_id = null
      where next_match_id in (select id from tournament_matches where player1_id = v_guest.id or player2_id = v_guest.id or winner_id = v_guest.id);
    update tournament_matches set loser_next_match_id = null
      where loser_next_match_id in (select id from tournament_matches where player1_id = v_guest.id or player2_id = v_guest.id or winner_id = v_guest.id);
    update tournament_matches set match_id = null
      where match_id in (select id from matches where player1_id = v_guest.id or player2_id = v_guest.id or player1b_id = v_guest.id or player2b_id = v_guest.id);
    delete from tournament_matches where player1_id = v_guest.id or player2_id = v_guest.id or winner_id = v_guest.id;
    delete from tournament_players where player_id = v_guest.id;

    update matches set reported_by = null where reported_by = v_guest.id;
    update matches set confirmed_by = null where confirmed_by = v_guest.id;
    update challenges set resolved_match_id = null
      where resolved_match_id in (select id from matches where player1_id = v_guest.id or player2_id = v_guest.id or player1b_id = v_guest.id or player2b_id = v_guest.id);
    delete from match_confirmations where match_id in (select id from matches where player1_id = v_guest.id or player2_id = v_guest.id or player1b_id = v_guest.id or player2b_id = v_guest.id);
    delete from matches where player1_id = v_guest.id or player2_id = v_guest.id or player1b_id = v_guest.id or player2b_id = v_guest.id;

    delete from challenges where challenger_id = v_guest.id or challenged_id = v_guest.id;
    delete from player_badges where player_id = v_guest.id;
    delete from ratings where player_id = v_guest.id;
    delete from rating_snapshots where player_id = v_guest.id;
    delete from elo_anchors where player_id = v_guest.id;
    delete from ghost_games where player_id = v_guest.id;
    delete from ping_replies where player_id = v_guest.id or ping_id in (select id from pings where player_id = v_guest.id);
    delete from pings where player_id = v_guest.id;
    delete from feedback_messages where sender_id = v_guest.id;
    update feedback set player_id = null where player_id = v_guest.id;

    delete from storage.objects where bucket_id = 'avatars' and v_guest.auth_user_id is not null and (storage.foldername(name))[1] = v_guest.auth_user_id::text;
    delete from players where id = v_guest.id;
    if v_guest.auth_user_id is not null then
      delete from auth.identities where user_id = v_guest.auth_user_id;
      delete from auth.users where id = v_guest.auth_user_id;
    end if;

    v_deleted := v_deleted + 1;
  end loop;

  return v_deleted;
end;
$function$;

select cron.schedule('cleanup-stale-guests', '0 4 * * *', $$select public.cleanup_stale_guest_players();$$);
