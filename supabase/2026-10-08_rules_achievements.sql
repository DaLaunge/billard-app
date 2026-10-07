-- Erfolge fuer die Regelkunde: "Regeln angesehen" in Stufen 1 / 5 / 10 / 20 / 30 / 40 / 50 / Alle.
--
-- Gezaehlt wird, wie viele VERSCHIEDENE Regelfaelle ein Spieler aufgeklappt hat (rule_views, eine Zeile je
-- Spieler und Fall). Die App meldet jeden Fall einmal ueber record_rule_view().
--
-- "Alle Regeln angesehen" bleibt fuer immer: Erfolge werden nur eingefuegt (insert ... on conflict do nothing),
-- keine compute_*_badges()-Funktion loescht sie, und die Stufe wird NICHT aus der aktuellen Regelzahl neu
-- berechnet. Kommen spaeter Regeln dazu, behaelt, wer "Alle" einmal hatte, den Erfolg; neu ist nur, dass er
-- ihn nicht noch einmal bekommt. Die Gesamtzahl der Regeln kennt nur die App (p_total) - sie ist eine
-- Konstante in src/lib/rulesTotal.js, die das Pruefskript gegen den Katalog kontrolliert. Eine Gesamtzahl
-- unter 50 wird ignoriert (Schutz gegen Manipulation).
--
-- Emoji-Eindeutigkeit wurde gegen den ganzen Katalog geprueft (keines der acht kommt vor).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte Supabase-Projekte
-- (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma) - in BEIDEN separat.

-- 1) Tabelle
create table if not exists public.rule_views (
  player_id  uuid not null references public.players(id) on delete cascade,
  case_id    text not null,
  first_seen timestamptz not null default now(),
  primary key (player_id, case_id)
);
alter table public.rule_views enable row level security;
drop policy if exists rule_views_select_own on public.rule_views;
create policy rule_views_select_own on public.rule_views for select to authenticated
  using (player_id = public.current_player_id());
grant select on public.rule_views to authenticated;
grant select, insert, update, delete on public.rule_views to service_role;

-- 2) Katalog
insert into public.badge_catalog (badge_key, name, description, emoji, category, tier, sort, secret) values
  ('rules_1',   'Regel-Neuling',      '1 Regel angesehen',     '📖', 'Regelkunde', 1, 1, false),
  ('rules_5',   'Regel-Leser',        '5 Regeln angesehen',    '🔍', 'Regelkunde', 2, 2, false),
  ('rules_10',  'Regel-Kenner',       '10 Regeln angesehen',   '📘', 'Regelkunde', 3, 3, false),
  ('rules_20',  'Regel-Profi',        '20 Regeln angesehen',   '📜', 'Regelkunde', 4, 4, false),
  ('rules_30',  'Regel-Experte',      '30 Regeln angesehen',   '⚖️', 'Regelkunde', 5, 5, false),
  ('rules_40',  'Regel-Meister',      '40 Regeln angesehen',   '🎓', 'Regelkunde', 6, 6, false),
  ('rules_50',  'Regel-Gelehrter',    '50 Regeln angesehen',   '🧠', 'Regelkunde', 7, 7, false),
  ('rules_all', 'Regelwerk komplett', 'Alle Regeln angesehen', '📚', 'Regelkunde', 8, 8, false)
on conflict (badge_key) do nothing;

-- 3) Vergabe: meldet einen angesehenen Fall, gibt {count, awarded} zurueck
create or replace function public.record_rule_view(p_case_id text, p_total int default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me      uuid := current_player_id();
  v_count   int;
  v_before  int;
  v_after   int;
begin
  if v_me is null or p_case_id is null or length(trim(p_case_id)) = 0 or length(p_case_id) > 80 then
    return jsonb_build_object('count', 0, 'awarded', 0);
  end if;

  insert into rule_views (player_id, case_id) values (v_me, p_case_id) on conflict do nothing;
  select count(*)::int into v_count from rule_views where player_id = v_me;

  select count(*)::int into v_before from player_badges where player_id = v_me and badge_key like 'rules\_%';

  insert into player_badges (player_id, badge_key)
  select v_me, t.key
    from (values ('rules_1',1),('rules_5',5),('rules_10',10),('rules_20',20),('rules_30',30),('rules_40',40),('rules_50',50)) as t(key, thr)
   where v_count >= t.thr
  on conflict do nothing;

  -- "Alle": die App nennt die aktuelle Regelzahl; einmal erreicht bleibt der Erfolg (nur insert, nie delete).
  if p_total is not null and p_total >= 50 and v_count >= p_total then
    insert into player_badges (player_id, badge_key) values (v_me, 'rules_all') on conflict do nothing;
  end if;

  select count(*)::int into v_after from player_badges where player_id = v_me and badge_key like 'rules\_%';
  return jsonb_build_object('count', v_count, 'awarded', v_after - v_before);
end;
$function$;
grant execute on function public.record_rule_view(text, int) to authenticated;

-- 4) Fortschritts-Zaehler um "rules_viewed" erweitern (Rueckgabetyp aendert sich: erst loeschen, dann neu)
drop function if exists public.my_achievement_counters();
create or replace function public.my_achievement_counters()
returns table(ghost_games integer, tournament_wins integer, tournament_2nd integer, tournament_3rd integer, rules_viewed integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me uuid := current_player_id();
begin
  if v_me is null then
    return query select 0, 0, 0, 0, 0;
    return;
  end if;

  return query
  select
    (select count(*)::int from ghost_games where player_id = v_me),
    (select count(*)::int from tournaments tour
       cross join lateral tournament_final_standings(tour.id) fs
       where tour.status = 'finished' and fs.placement = 1 and fs.player_id = v_me),
    (select count(*)::int from tournaments tour
       cross join lateral tournament_final_standings(tour.id) fs
       where tour.status = 'finished' and fs.placement = 2 and fs.player_id = v_me),
    (select count(*)::int from tournaments tour
       cross join lateral tournament_final_standings(tour.id) fs
       where tour.status = 'finished' and fs.placement = 3 and fs.player_id = v_me),
    (select count(*)::int from rule_views where player_id = v_me);
end;
$function$;
grant execute on function public.my_achievement_counters() to authenticated;

-- Kontrolle: Emoji-Duplikate im Katalog (muss leer sein)
select emoji, array_agg(badge_key order by badge_key) as badge_keys, count(*)
from badge_catalog group by emoji having count(*) > 1;
