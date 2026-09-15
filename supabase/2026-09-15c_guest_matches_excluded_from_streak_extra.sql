-- Zweiter Nachtrag zu 2026-09-15_guest_players_everywhere.sql: beim erneuten
-- Live-Test (zweites Testmatch gegen einen zweiten Testgast, NACH Anwenden
-- von 2026-09-15b) wurde trotzdem noch der Erfolg "Vierer-Lauf" (streak4,
-- 4 Siege in Folge) vergeben - obwohl 2026-09-15b compute_badges() bereits
-- korrekt fixte und die eigene Nachrechnung derselben Logik per Hand
-- (SELECT auf matches mit exakt derselben Gast-Ausschluss-Bedingung) nur
-- eine echte Serie von 2 ergab.
--
-- Ursache: Es existiert ein ZWEITER, bisher nirgends in diesem Repo
-- eingecheckter Trigger auf matches - "trg_matches_streak_extra" (AFTER
-- INSERT/UPDATE/DELETE, STATEMENT-Level) ruft trg_streak_extra() auf, die
-- wiederum compute_streak_badges() aufruft. Diese Funktion ist komplett
-- unabhaengig von compute_badges() (eigene, feinere Serien-Schwellenwerte
-- streak2/3/4/5/7/10/15/20 statt nur 3/5/10/15/20) und liest ebenfalls
-- direkt aus matches, ganz ohne Gast-Ausschluss - vermutlich spaeter direkt
-- im SQL-Editor ergaenzt, ohne dass dafuer je eine Migrationsdatei angelegt
-- wurde (aehnlich wie compute_ghost_badges()/compute_recruit_badges(), die
-- im bestehenden trg_rebuild_ratings() nur ueber "if exists" bedingt
-- aufgerufen werden, weil sie ebenfalls nicht in jeder Umgebung angelegt
-- sind - compute_streak_badges() ist aber unconditional ueber einen
-- eigenen, separaten Trigger verdrahtet, nicht ueber trg_rebuild_ratings()).
--
-- Diese Migration traegt compute_streak_badges() zum allerersten Mal in
-- die Git-Historie ein (mit demselben Gast-Ausschluss wie compute_badges())
-- und dokumentiert trg_streak_extra()/den Trigger unveraendert mit, damit
-- diese Funktionen kuenftig nicht mehr "unsichtbar" fuer Migrationen sind.
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen, zuerst Test.

create or replace function public.compute_streak_badges()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into player_badges (player_id, badge_key)
  select s.player_id, t.key
  from (
    select player_id, max(streak) as best
    from (
      select player_id, count(*) as streak
      from (
        select player_id, won, (rn - rnw) as grp
        from (
          select player_id, won,
                 row_number() over (partition by player_id order by played_at, mid) as rn,
                 row_number() over (partition by player_id, won order by played_at, mid) as rnw
          from (
            select player1_id as player_id, played_at, id as mid, (score1 > score2) as won
            from matches where confirmed
              and not exists (
                select 1 from players p
                where p.id in (player1_id, player2_id, player1b_id, player2b_id)
                  and p.is_guest
              )
            union all
            select player2_id, played_at, id, (score2 > score1)
            from matches where confirmed
              and not exists (
                select 1 from players p
                where p.id in (player1_id, player2_id, player1b_id, player2b_id)
                  and p.is_guest
              )
          ) r
        ) a
      ) b
      where won
      group by player_id, grp
    ) c
    group by player_id
  ) s
  cross join (values
      ('streak2', 2), ('streak3', 3), ('streak4', 4), ('streak5', 5),
      ('streak7', 7), ('streak10', 10), ('streak15', 15), ('streak20', 20)
    ) as t(key, thr)
  where s.best >= t.thr
  on conflict do nothing;
end;
$function$;

-- trg_streak_extra()/der Trigger selbst aendern sich inhaltlich nicht -
-- hier nur zur Dokumentation "create or replace", damit sie kuenftig in
-- der Migrationshistorie auffindbar sind (die Funktion existierte bereits
-- exakt so; der Trigger "trg_matches_streak_extra" existiert ebenfalls
-- schon und wird hier NICHT neu angelegt, um keine No-Op-Fehler bei
-- bereits vorhandenem Trigger zu riskieren).
create or replace function public.trg_streak_extra()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform compute_streak_badges();
  return null;
end;
$function$;
