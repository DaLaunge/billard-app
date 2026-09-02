-- Neue Erfolgskategorie "Mitgliedschaft": wie lange ist ein Spieler schon
-- dabei (players.created_at)? 1 Woche / 1 Monat / 1 Quartal / 6 Monate /
-- 1 Jahr, danach jaehrlich (aktuell bis 10 Jahre vorbereitet - weitere
-- Jahre spaeter einfach nach demselben Muster ergaenzen).
--
-- Ghost-Konten (is_ghost) werden bewusst ausgenommen - kein echtes
-- Mitglied. compute_membership_badges() wird wie die anderen
-- compute_*_badges()-Funktionen nur ueber admin_recompute_badges()
-- aufgerufen (manuell durch einen Admin, "Nur Erfolge neu berechnen") -
-- genau wie compute_recruit_badges()/compute_141_badges() bisher auch.
--
-- Achtung: "on conflict (badge_key)" setzt voraus, dass badge_key der
-- Primary/Unique-Key von badge_catalog ist (wie ueberall sonst in der App
-- als natuerlicher Schluessel verwendet). Falls das nicht stimmt, schlaegt
-- der insert unten mit einer klaren Fehlermeldung fehl - bitte dann kurz
-- Bescheid geben.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

insert into public.badge_catalog (badge_key, name, description, emoji, category, sort) values
  ('member_1w',  '1 Woche dabei',     '1 Woche dabei',   '🌱', 'Mitgliedschaft', 1),
  ('member_1m',  '1 Monat dabei',     '1 Monat dabei',   '🌿', 'Mitgliedschaft', 2),
  ('member_1q',  'Ein Quartal dabei', '3 Monate dabei',  '🍀', 'Mitgliedschaft', 3),
  ('member_6m',  'Halbes Jahr dabei', '6 Monate dabei',  '🌳', 'Mitgliedschaft', 4),
  ('member_1y',  '1 Jahr dabei',      '1 Jahr dabei',    '🎂', 'Mitgliedschaft', 5),
  ('member_2y',  '2 Jahre dabei',     '2 Jahre dabei',   '🎉', 'Mitgliedschaft', 6),
  ('member_3y',  '3 Jahre dabei',     '3 Jahre dabei',   '🏅', 'Mitgliedschaft', 7),
  ('member_4y',  '4 Jahre dabei',     '4 Jahre dabei',   '🎖️', 'Mitgliedschaft', 8),
  ('member_5y',  '5 Jahre dabei',     '5 Jahre dabei',   '🏆', 'Mitgliedschaft', 9),
  ('member_6y',  '6 Jahre dabei',     '6 Jahre dabei',   '💎', 'Mitgliedschaft', 10),
  ('member_7y',  '7 Jahre dabei',     '7 Jahre dabei',   '👑', 'Mitgliedschaft', 11),
  ('member_8y',  '8 Jahre dabei',     '8 Jahre dabei',   '🌟', 'Mitgliedschaft', 12),
  ('member_9y',  '9 Jahre dabei',     '9 Jahre dabei',   '🔥', 'Mitgliedschaft', 13),
  ('member_10y', '10 Jahre dabei',    '10 Jahre dabei',  '🚀', 'Mitgliedschaft', 14)
on conflict (badge_key) do nothing;

create or replace function public.compute_membership_badges()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into player_badges (player_id, badge_key)
  select p.id, th.badge_key
  from players p
  cross join (values
    ('member_1w',  interval '1 week'),
    ('member_1m',  interval '1 month'),
    ('member_1q',  interval '3 months'),
    ('member_6m',  interval '6 months'),
    ('member_1y',  interval '1 year'),
    ('member_2y',  interval '2 years'),
    ('member_3y',  interval '3 years'),
    ('member_4y',  interval '4 years'),
    ('member_5y',  interval '5 years'),
    ('member_6y',  interval '6 years'),
    ('member_7y',  interval '7 years'),
    ('member_8y',  interval '8 years'),
    ('member_9y',  interval '9 years'),
    ('member_10y', interval '10 years')
  ) as th(badge_key, min_age)
  where p.created_at is not null
    and not p.is_ghost
    and p.created_at + th.min_age <= now()
    and not exists (
      select 1 from player_badges pb
      where pb.player_id = p.id and pb.badge_key = th.badge_key
    );
end;
$function$;

-- admin_recompute_badges() um den neuen Aufruf ergaenzt (Rest 1:1 wie
-- bisher, siehe von dir bereitgestellte Definition).
create or replace function public.admin_recompute_badges()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin() then raise exception 'Nur für Admins.'; end if;
  perform compute_badges();
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_recruit_badges') then
    perform compute_recruit_badges();
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
             where ns.nspname = 'public' and p.proname = 'compute_141_badges') then
    perform compute_141_badges();
  end if;
  perform compute_ghost_badges();
  perform compute_opponent_streak_badges();
  perform compute_challenge_badges();
  perform compute_membership_badges();
  return 'ok';
end;
$function$;
