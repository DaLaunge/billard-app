-- matches_sync() liefert zusaetzlich matches.walkover (fuer die Rating-Punkte je Match im Reiter
-- "Match-Historie" in "Meine Zahlen": ein Walkover zaehlt nicht fuers Rating, der Client rechnet
-- die Punkte nach, siehe src/lib/ratingHistory.js). Sonst unveraendert gegenueber
-- 2026-09-24c_matches_sync.sql. Der Match-Cache der App steigt dafuer auf CACHE_VERSION 2.
-- Ohne diese Migration fehlt das Feld nur bei Delta-Zeilen; ein Walkover wuerde dann in der
-- Historie wie ein normales Match gerechnet. Test, dann Produktion. Idempotent.

create or replace function public.matches_sync(p_since timestamptz)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at)
      from (
        select m.id, m.played_at, m.score1, m.score2, m.high_run1, m.high_run2, m.discipline,
               m.confirmed, m.reported_by, m.player1_id, m.player2_id, m.player1b_id, m.player2b_id,
               m.run_log, m.tournament_id, m.winner_stays_session_id, m.walkover, m.manual_entry_note, m.updated_at,
               (select jsonb_build_object('name', t.name, 'format', t.format, 'organizer_id', t.organizer_id)
                  from tournaments t where t.id = m.tournament_id) as tournament,
               (select jsonb_build_object('name', w.name, 'is_doubles', w.is_doubles)
                  from winner_stays_sessions w where w.id = m.winner_stays_session_id) as winner_stays_session
        from matches m
        where m.updated_at >= p_since
      ) x), '[]'::jsonb),
    'deleted', coalesce((
      select jsonb_agg(jsonb_build_object('match_id', d.match_id, 'deleted_at', d.deleted_at))
      from deleted_matches d
      where d.deleted_at >= p_since), '[]'::jsonb),
    'count', (select count(*) from matches),
    'hash', (select encode(sha256(convert_to(coalesce(string_agg(id::text, ',' order by id), ''), 'UTF8')), 'hex')
             from matches)
  );
$function$;

revoke all on function public.matches_sync(timestamptz) from public, anon;
grant execute on function public.matches_sync(timestamptz) to authenticated;
