-- Benachrichtigungen (In-App + Push aufs Handy).
--
-- Ein Ereignis (Herausforderung, zu bestaetigendes Match, "du bist dran" im
-- Turnier/bei Winner Stays, Live-Ping, Planung, Zusage) landet IMMER als
-- Zeile in `notifications` - das ist der Posteingang, den die App im Modus
-- "In der App" abfragt und als Toast zeigt. Hat der Empfaenger
-- zusaetzlich auf einem Geraet "Push" gewaehlt, liegt dafuer
-- ein Eintrag in `push_subscriptions`, und notify_players() stoesst per
-- pg_net die Edge Function `send-push` an, die die eigentliche Web-Push-
-- Nachricht verschickt. Die Texte werden HIER (einmal, deutsch + englisch)
-- gebaut, damit App und Push garantiert dasselbe sagen.
--
-- Die Trigger haengen bewusst an den TABELLEN, nicht an den RPCs - so
-- bleibt keine der vielen Stellen, die z.B. winner_stays_entries umsortieren
-- oder Turniertische vergeben, ohne Benachrichtigung, und die RPCs selbst
-- bleiben unangetastet. notify_players() faengt jeden eigenen Fehler ab:
-- eine kaputte Benachrichtigung darf NIE das eigentliche Speichern (Match,
-- Ping, ...) zuruecksetzen.
--
-- Nach dem Einspielen einmalig pro Projekt die beiden Vault-Secrets anlegen
-- (siehe PUSH_ANLEITUNG.md) - ohne sie laeuft alles ausser dem eigentlichen
-- Push-Versand (Posteingang/In-App funktioniert trotzdem).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

create extension if not exists pg_net with schema extensions;

-- --- Tabellen ---------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  lang         text not null default 'de',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_player_idx on public.push_subscriptions(player_id);
-- Kein direkter Zugriff aus dem Client - nur ueber die RPCs unten.
alter table public.push_subscriptions enable row level security;

create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  kind        text not null,
  title_de    text not null,
  body_de     text not null default '',
  title_en    text not null,
  body_en     text not null default '',
  nav         jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_player_idx on public.notifications(player_id, id);
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (player_id = public.current_player_id());

-- Posteingang nach 14 Tagen aufraeumen - die App zeigt ohnehin nur frische
-- Eintraege als Toast.
do $$
begin
  perform cron.unschedule('cleanup_notifications');
exception when others then null;
end $$;
select cron.schedule('cleanup_notifications', '17 3 * * *',
  $$delete from public.notifications where created_at < now() - interval '14 days'$$);

-- --- RPCs fuer den Client ---------------------------------------------------

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'de')
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then
    raise exception 'Kein Spielerprofil zu diesem Login.';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' then
    raise exception 'Ungueltiges Push-Abo.';
  end if;
  -- Upsert ueber den Endpoint: meldet sich auf demselben Geraet ein anderer
  -- Spieler an, gehoert das Abo ab jetzt ihm (sonst bekaeme der vorige
  -- Nutzer weiter die Nachrichten des Geraets).
  insert into push_subscriptions(player_id, endpoint, p256dh, auth, lang)
  values (v_me, p_endpoint, p_p256dh, p_auth, case when p_lang = 'en' then 'en' else 'de' end)
  on conflict (endpoint) do update
    set player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth,
        lang = excluded.lang, updated_at = now();
end;
$function$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  delete from push_subscriptions where endpoint = p_endpoint and player_id = current_player_id();
end;
$function$;

grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- --- Zentrale Versandfunktion ----------------------------------------------

create or replace function public.notify_players(
  p_ids uuid[], p_kind text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text,
  p_nav jsonb default null, p_exclude uuid default null)
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_rec    record;
  v_nid    bigint;
  v_subs   jsonb := '[]'::jsonb;
  v_url    text;
  v_secret text;
begin
  for v_rec in
    select p.id from players p
     where p.id = any(p_ids)
       and p.id is distinct from p_exclude
       and p.auth_user_id is not null
       and not coalesce(p.is_ghost, false)
       and not coalesce(p.is_guest, false)
       and not coalesce(p.blocked, false)
  loop
    insert into notifications(player_id, kind, title_de, body_de, title_en, body_en, nav)
    values (v_rec.id, p_kind, p_title_de, coalesce(p_body_de, ''), p_title_en, coalesce(p_body_en, ''), p_nav)
    returning id into v_nid;

    select v_subs || coalesce(jsonb_agg(jsonb_build_object(
             'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
             'lang', s.lang, 'notification_id', v_nid)), '[]'::jsonb)
      into v_subs
      from push_subscriptions s where s.player_id = v_rec.id;
  end loop;

  if jsonb_array_length(v_subs) = 0 then return; end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then return; end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object(
                 'subscriptions', v_subs, 'kind', p_kind, 'nav', p_nav,
                 'title_de', p_title_de, 'body_de', coalesce(p_body_de, ''),
                 'title_en', p_title_en, 'body_en', coalesce(p_body_en, '')));
exception when others then
  raise warning 'notify_players(%): %', p_kind, sqlerrm;
end;
$function$;

-- Nur fuer die Trigger - nicht aus dem Client aufrufbar (sonst koennte jeder
-- beliebige Nachrichten an alle schicken).
revoke all on function public.notify_players(uuid[], text, text, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- Alle aktiven Spieler (fuer Live-Pings / Planungen).
create or replace function public.all_active_player_ids()
returns uuid[]
language sql stable security definer set search_path to 'public' as $function$
  select coalesce(array_agg(id), '{}') from players
   where auth_user_id is not null and not coalesce(is_ghost, false)
     and not coalesce(is_guest, false) and not coalesce(blocked, false);
$function$;
revoke all on function public.all_active_player_ids() from public, anon, authenticated;

create or replace function public.nick_of(p_id uuid)
returns text
language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select nickname::text from players where id = p_id), '?');
$function$;
revoke all on function public.nick_of(uuid) from public, anon, authenticated;

-- --- Trigger: Herausforderungen --------------------------------------------

create or replace function public.trg_notify_challenge()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_msg text := nullif(trim(coalesce(new.message, '')), '');
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    perform notify_players(array[new.challenged_id], 'challenge',
      '⚔️ Herausforderung', nick_of(new.challenger_id) || ' fordert dich heraus' || coalesce(': „' || v_msg || '“', '.'),
      '⚔️ Challenge',      nick_of(new.challenger_id) || ' challenges you'      || coalesce(': "' || v_msg || '"', '.'),
      jsonb_build_object('tab', 'live'));
  elsif tg_op = 'UPDATE' and old.status = 'open' and new.status = 'declined' then
    perform notify_players(array[new.challenger_id], 'challenge_declined',
      '⚔️ Herausforderung abgelehnt', nick_of(new.challenged_id) || ' hat deine Herausforderung abgelehnt.',
      '⚔️ Challenge declined',       nick_of(new.challenged_id) || ' declined your challenge.',
      jsonb_build_object('tab', 'live'));
  end if;
  return null;
end;
$function$;

drop trigger if exists notify_challenge on public.challenges;
create trigger notify_challenge after insert or update of status on public.challenges
  for each row execute function public.trg_notify_challenge();

-- --- Trigger: Match bestaetigen --------------------------------------------
-- Einzel: das gemeldete Match wartet auf den Gegner des Meldenden.
-- Doppel: dafuer gibt es je Spieler eine match_confirmations-Zeile (pending).
-- Turnier- und Winner-Stays-Matches haben ihre eigenen Ablaeufe.

create or replace function public.trg_notify_match_pending()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_to uuid;
begin
  if new.confirmed or new.tournament_id is not null or new.winner_stays_session_id is not null
     or new.player1b_id is not null or new.reported_by is null then
    return null;
  end if;
  v_to := case when new.reported_by = new.player1_id then new.player2_id else new.player1_id end;
  perform notify_players(array[v_to], 'match_confirm',
    '✅ Match bestätigen', nick_of(new.reported_by) || ' hat ' || new.score1 || ':' || new.score2 || ' (' || new.discipline || ') gemeldet.',
    '✅ Confirm match',    nick_of(new.reported_by) || ' reported ' || new.score1 || ':' || new.score2 || ' (' || new.discipline || ').',
    jsonb_build_object('tab', 'stats'));
  return null;
end;
$function$;

drop trigger if exists notify_match_pending on public.matches;
create trigger notify_match_pending after insert on public.matches
  for each row execute function public.trg_notify_match_pending();

create or replace function public.trg_notify_match_confirmation()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_m matches;
begin
  if new.status <> 'pending' then return null; end if;
  select * into v_m from matches where id = new.match_id;
  if v_m.id is null or v_m.confirmed then return null; end if;
  perform notify_players(array[new.player_id], 'match_confirm',
    '✅ Doppel bestätigen', nick_of(v_m.reported_by) || ' hat ' || v_m.score1 || ':' || v_m.score2 || ' (' || v_m.discipline || ') gemeldet.',
    '✅ Confirm doubles',   nick_of(v_m.reported_by) || ' reported ' || v_m.score1 || ':' || v_m.score2 || ' (' || v_m.discipline || ').',
    jsonb_build_object('tab', 'stats'), v_m.reported_by);
  return null;
end;
$function$;

drop trigger if exists notify_match_confirmation on public.match_confirmations;
create trigger notify_match_confirmation after insert on public.match_confirmations
  for each row execute function public.trg_notify_match_confirmation();

-- --- Trigger: Turnier "du bist dran" ---------------------------------------
-- Gleiche Bedingung wie checkTourneyReady() in App.jsx: beide Spieler UND
-- der Tisch stehen fest, noch kein Ergebnis, Turnier laeuft.

create or replace function public.notify_tournament_match(p_tm tournament_matches, p_name text)
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  perform notify_players(array[p_tm.player1_id], 'tourney_ready',
    '🏆 Du bist dran – Tisch ' || p_tm.table_number, p_name || ': gegen ' || nick_of(p_tm.player2_id),
    '🏆 You''re up – table ' || p_tm.table_number,  p_name || ': vs ' || nick_of(p_tm.player2_id),
    jsonb_build_object('tab', 'turnierdetail', 'tournamentId', p_tm.tournament_id));
  perform notify_players(array[p_tm.player2_id], 'tourney_ready',
    '🏆 Du bist dran – Tisch ' || p_tm.table_number, p_name || ': gegen ' || nick_of(p_tm.player1_id),
    '🏆 You''re up – table ' || p_tm.table_number,  p_name || ': vs ' || nick_of(p_tm.player1_id),
    jsonb_build_object('tab', 'turnierdetail', 'tournamentId', p_tm.tournament_id));
end;
$function$;
revoke all on function public.notify_tournament_match(tournament_matches, text) from public, anon, authenticated;

create or replace function public.trg_notify_tournament_ready()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_t tournaments;
begin
  if new.is_bye or coalesce(new.void, false) or new.match_id is not null or new.table_number is null
     or new.player1_id is null or new.player2_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.table_number is not distinct from new.table_number
     and old.player1_id is not distinct from new.player1_id
     and old.player2_id is not distinct from new.player2_id then
    return null;
  end if;
  -- Beim Turnierstart vergibt tournament_start() die ersten Tische, BEVOR
  -- es den Status auf 'running' setzt - die gehen ueber den Trigger auf
  -- tournaments darunter raus.
  select * into v_t from tournaments where id = new.tournament_id;
  if v_t.id is null or v_t.status <> 'running' then return null; end if;
  perform notify_tournament_match(new, v_t.name);
  return null;
end;
$function$;

drop trigger if exists notify_tournament_ready on public.tournament_matches;
create trigger notify_tournament_ready after insert or update of table_number, player1_id, player2_id on public.tournament_matches
  for each row execute function public.trg_notify_tournament_ready();

create or replace function public.trg_notify_tournament_started()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_tm tournament_matches;
begin
  if new.status <> 'running' or old.status = 'running' then return null; end if;
  for v_tm in
    select * from tournament_matches
     where tournament_id = new.id and not is_bye and not coalesce(void, false)
       and match_id is null and table_number is not null
       and player1_id is not null and player2_id is not null
  loop
    perform notify_tournament_match(v_tm, new.name);
  end loop;
  return null;
end;
$function$;

drop trigger if exists notify_tournament_started on public.tournaments;
create trigger notify_tournament_started after update of status on public.tournaments
  for each row execute function public.trg_notify_tournament_started();

-- --- Trigger: Winner Stays "du bist dran" ----------------------------------
-- Am Tisch = queue_position 0 oder 1 (wie checkWinnerStaysReady in App.jsx).
-- Benachrichtigt nur beim NACHRUECKEN an den Tisch, nicht den Sieger, der
-- ohnehin dort stehen bleibt.

create or replace function public.trg_notify_winner_stays_ready()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_s winner_stays_sessions;
  v_title_de text; v_title_en text;
begin
  if new.queue_position not in (0, 1) or coalesce(new.is_paused, false) then return null; end if;
  if tg_op = 'UPDATE' and old.queue_position in (0, 1) then return null; end if;
  select * into v_s from winner_stays_sessions where id = new.session_id;
  if v_s.id is null or v_s.status <> 'running' then return null; end if;

  v_title_de := '🎱 Du bist dran' || coalesce(' – Tisch ' || v_s.table_number, '');
  v_title_en := '🎱 You''re up'   || coalesce(' – table ' || v_s.table_number, '');
  perform notify_players(array_remove(array[new.player1_id, new.player2_id], null), 'ws_ready',
    v_title_de, 'Winner Stays: ' || v_s.name,
    v_title_en, 'Winner Stays: ' || v_s.name,
    jsonb_build_object('tab', 'winnerstays', 'winnerStaysId', new.session_id));
  return null;
end;
$function$;

drop trigger if exists notify_winner_stays_ready on public.winner_stays_entries;
create trigger notify_winner_stays_ready after insert or update of queue_position, is_paused on public.winner_stays_entries
  for each row execute function public.trg_notify_winner_stays_ready();

-- --- Trigger: Live / Planung / Zusagen -------------------------------------

create or replace function public.trg_notify_ping()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_msg text := nullif(trim(coalesce(new.message, '')), '');
  v_loc text := nullif(trim(coalesce(new.location, '')), '');
begin
  perform notify_players(all_active_player_ids(), 'ping',
    '🟢 ' || nick_of(new.player_id) || ' ist live', concat_ws(' · ', v_loc, v_msg),
    '🟢 ' || nick_of(new.player_id) || ' is live',  concat_ws(' · ', v_loc, v_msg),
    jsonb_build_object('tab', 'live'), new.player_id);
  return null;
end;
$function$;

drop trigger if exists notify_ping on public.pings;
create trigger notify_ping after insert on public.pings
  for each row execute function public.trg_notify_ping();

create or replace function public.trg_notify_planning()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_msg text := nullif(trim(coalesce(new.message, '')), '');
begin
  perform notify_players(all_active_player_ids(), 'planning',
    '📅 ' || nick_of(new.player_id) || ' will spielen', concat_ws(' · ', to_char(new.planned_date, 'DD.MM.'), v_msg),
    '📅 ' || nick_of(new.player_id) || ' wants to play', concat_ws(' · ', to_char(new.planned_date, 'DD/MM'), v_msg),
    jsonb_build_object('tab', 'live'), new.player_id);
  return null;
end;
$function$;

drop trigger if exists notify_planning on public.plannings;
create trigger notify_planning after insert on public.plannings
  for each row execute function public.trg_notify_planning();

create or replace function public.trg_notify_ping_reply()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_owner uuid;
  v_msg text := nullif(trim(coalesce(new.message, '')), '');
begin
  if tg_table_name = 'ping_replies' then
    select player_id into v_owner from pings where id = new.ping_id;
  else
    select player_id into v_owner from plannings where id = new.planning_id;
  end if;
  if v_owner is null then return null; end if;
  perform notify_players(array[v_owner], 'reply',
    '👍 ' || nick_of(new.player_id) || ' hat zugesagt', coalesce(v_msg, ''),
    '👍 ' || nick_of(new.player_id) || ' is in',       coalesce(v_msg, ''),
    jsonb_build_object('tab', 'live'), new.player_id);
  return null;
end;
$function$;

drop trigger if exists notify_ping_reply on public.ping_replies;
create trigger notify_ping_reply after insert on public.ping_replies
  for each row execute function public.trg_notify_ping_reply();

drop trigger if exists notify_planning_reply on public.planning_replies;
create trigger notify_planning_reply after insert on public.planning_replies
  for each row execute function public.trg_notify_ping_reply();
