-- Einladungslink fuer Turniere (Nutzer-Wunsch 2026-10-27): ein QR-Code / Link pro Turnier, /?turnier=<Turnier-id>.
--   1. Wer in der App angemeldet ist, wird beim Oeffnen sofort angemeldet (vorhandene tournament_register()).
--   2. Wer nicht angemeldet ist, bekommt die Wahl "Anmelden" oder "Als Gast mitspielen". Anmelden = normaler Anmeldevorgang; die Turnierleitung
--      wird dabei als Werber gutgeschrieben (players.invited_by, Erfolge fuer geworbene Spieler). Gast = nur ein Name, kein Login.
-- Die Turnier-id (uuid) ist der Schluessel und nicht erratbar; Gaeste werden nur in der Anmeldephase angelegt.
-- Beide Funktionen sind ohne Login aufrufbar (anon), weil sich ein Gast gerade NICHT anmeldet.
--
-- Test, dann Produktion. Idempotent.

-- 1) Infos fuer die Einladungsseite (ohne Login). Liefert zusaetzlich den aktuellen Einladungscode der Turnierleitung (invites), den der Client
--    beim "Anmelden" als Werbe-Code merkt. Hat die Turnierleitung noch keinen, wird einer angelegt.
create or replace function public.tournament_invite_info(p_tournament_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tour tournaments;
  v_org  players;
  v_code text;
begin
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then return null; end if;
  select * into v_org from players where id = v_tour.organizer_id;

  if v_tour.status = 'setup' and v_org.id is not null and not coalesce(v_org.is_guest, false) and not coalesce(v_org.is_ghost, false) then
    select code into v_code from invites
      where inviter_id = v_org.id and revoked_at is null
      order by created_at desc limit 1;
    if v_code is null then
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      insert into invites (code, inviter_id) values (v_code, v_org.id);
    end if;
  end if;

  return jsonb_build_object(
    'id', v_tour.id,
    'name', v_tour.name,
    'format', v_tour.format,
    'discipline', v_tour.discipline,
    'status', v_tour.status,
    'organizer', v_org.nickname,
    'players', (select count(*) from tournament_players where tournament_id = v_tour.id),
    'ref', v_code
  );
end;
$function$;

-- 2) Als Gast mitspielen (ohne Login): legt einen Gast an (oder nimmt den vorhandenen Gast gleichen Namens) und meldet ihn an.
create or replace function public.tournament_join_guest(p_tournament_id uuid, p_nickname text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tour  tournaments;
  v_nick  text := trim(coalesce(p_nickname, ''));
  v_guest players;
begin
  select * into v_tour from tournaments where id = p_tournament_id;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if v_tour.status <> 'setup' then raise exception 'Die Anmeldung für dieses Turnier ist nicht mehr offen.'; end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then raise exception 'Der Name muss 2 bis 30 Zeichen lang sein.'; end if;
  if (select count(*) from tournament_players where tournament_id = p_tournament_id) >= 64 then
    raise exception 'Das Turnier ist voll.';
  end if;

  select * into v_guest from players where nickname = v_nick and is_guest;
  if not found then
    if (select count(*) from players where is_guest and created_at > now() - interval '10 minutes') >= 40 then
      raise exception 'Gerade sehr viele Gast-Anmeldungen - bitte in ein paar Minuten nochmal versuchen.';
    end if;
    begin
      insert into players (nickname, is_guest) values (v_nick, true) returning * into v_guest;
    exception when unique_violation then
      raise exception 'Der Name "%" ist schon vergeben - bitte einen anderen Namen verwenden (z. B. mit Zusatz).', v_nick;
    end;
  end if;

  insert into tournament_players (tournament_id, player_id) values (p_tournament_id, v_guest.id) on conflict do nothing;
  return jsonb_build_object('player_id', v_guest.id, 'nickname', v_guest.nickname);
end;
$function$;

revoke all on function public.tournament_invite_info(uuid) from public;
revoke all on function public.tournament_join_guest(uuid, text) from public;
grant execute on function public.tournament_invite_info(uuid) to anon, authenticated;
grant execute on function public.tournament_join_guest(uuid, text) to anon, authenticated;

-- Kontrolle
select proname, proacl from pg_proc where proname in ('tournament_invite_info', 'tournament_join_guest');
