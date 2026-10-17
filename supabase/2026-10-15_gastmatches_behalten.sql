-- Gast-Matches bleiben erhalten und beruehren nie Rating oder Statistik (Nutzer-Wunsch 2026-10-15).
-- "Gast-Match" = JEDES Match, an dem mindestens ein Gast beteiligt ist (auch registrierter Spieler
-- gegen Gast, auch Doppel). Voraussetzung: 2026-09-15d (cleanup_stale_guest_players) ist eingespielt.
--
-- 1) cleanup_stale_guest_players() loescht nur noch Gaeste OHNE jedes Match. Bisher wurde jeder
--    Gast nach 14 Tagen Ruhe samt seinen Matches (Protokolle, Download) geloescht.
-- 2) Rating-Neuberechnung (trg_rebuild_ratings) laeuft nur noch, wenn die Aenderung mindestens ein
--    Match OHNE Gast beruehrt. Ein Gast-Match rechnet also weder Ratings noch Verlauf neu (spart
--    ~1 s je Eintrag und verschiebt keine Verfallswerte). Die Berechnung selbst filtert Gaeste
--    ohnehin (elo_anchor_rows bzw. rebuild_elo: "not exists ... p.is_guest").
--
-- Test, dann Produktion. Idempotent. Danach 2026-10-15_gastmatch_pruefung.sql laufen lassen.

-- ---------- 2) Neuberechnung nur bei Matches ohne Gast ----------
create or replace function public.rating_rebuild_needed()
 returns boolean
 language plpgsql
 volatile
 set search_path to 'public'
as $function$
declare v text;
begin
  v := coalesce(current_setting('app.rating_dirty', true), '');
  perform set_config('app.rating_dirty', '', true);   -- gilt nur fuer dieses eine Statement
  return v = '1';
exception when others then
  return true;   -- im Zweifel lieber neu rechnen
end;
$function$;

create or replace function public.trg_matches_rating_relevance()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  begin
    if tg_op in ('INSERT', 'UPDATE') and not exists (
         select 1 from players p
         where p.id in (new.player1_id, new.player2_id, new.player1b_id, new.player2b_id) and p.is_guest) then
      perform set_config('app.rating_dirty', '1', true);
    end if;
    if tg_op in ('DELETE', 'UPDATE') and not exists (
         select 1 from players p
         where p.id in (old.player1_id, old.player2_id, old.player1b_id, old.player2b_id) and p.is_guest) then
      perform set_config('app.rating_dirty', '1', true);
    end if;
  exception when others then
    perform set_config('app.rating_dirty', '1', true);
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

drop trigger if exists matches_rating_relevance on public.matches;
create trigger matches_rating_relevance
  before insert or update or delete on public.matches
  for each row execute function public.trg_matches_rating_relevance();

drop trigger if exists matches_rebuild_ratings on public.matches;
create trigger matches_rebuild_ratings
  after insert or update or delete on public.matches
  for each statement
  when (public.rating_rebuild_needed())
  execute function public.trg_rebuild_ratings();

-- ---------- 1) Aufraeumjob: nur Gaeste ganz ohne Match ----------
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
        select 1 from matches m2
        where m2.player1_id = p.id or m2.player2_id = p.id or m2.player1b_id = p.id or m2.player2b_id = p.id
      )
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
