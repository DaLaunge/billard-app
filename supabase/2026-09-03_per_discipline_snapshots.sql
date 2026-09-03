-- snapshot_ratings() bisher NUR fuer "Gesamt" (mit taeglichem
-- Inaktivitaets-Verfall relativ zum elo_anchors-Anker). Jetzt zusaetzlich
-- fuer alle anderen Disziplinen (10 Ball, 9 Ball, 8 Ball, 14/1 Endlos,
-- Doppel), damit spaeter ein Verlauf ueber mehrere/alle Disziplinen
-- gebaut werden kann.
--
-- WICHTIGER UNTERSCHIED zu Gesamt: elo_anchors hat nur eine Zeile pro
-- Spieler (keine discipline-Spalte) - es gibt also keinen Verfalls-Anker
-- pro Einzeldisziplin. Die neuen Snapshots uebernehmen daher einfach den
-- aktuellen Live-Wert aus "ratings". Das bildet den taeglichen
-- Inaktivitaets-Verfall bei laengerer Spielpause NICHT ab wie bei Gesamt
-- (ratings aktualisiert sich nur, wenn tatsaechlich ein Match gespielt
-- wird) - fuer echte Verfalls-Parität braeuchte elo_anchors zusaetzlich
-- eine discipline-Spalte plus eine entsprechende Erweiterung von
-- rebuild_elo(), das ist hier bewusst NICHT enthalten (naechster
-- moeglicher Ausbauschritt, siehe Chat).
--
-- In Supabase SQL-Editor ausfuehren. Test und Produktion sind getrennte
-- Supabase-Projekte (Test: hadamdvpnwslztsxmwdr, Produktion: wofsutwidaitloeiwnma)
-- - dieses Skript muss in BEIDEN separat laufen.

create or replace function public.snapshot_ratings()
returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  -- Gesamt: unveraendert, mit Verfall relativ zum letzten Elo-Anker.
  insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
  select a.player_id, current_date, to_char(now(), 'IYYY-"W"IW'), 'Gesamt',
         round(500 + (a.rating - 500)
               * power(0.5, greatest(0, (current_date - a.anchor_at::date) - 30) / 200.0), 1),
         null, a.games < 10, current_date
  from (
    select distinct on (player_id) player_id, anchor_at, rating, games
    from elo_anchors order by player_id, anchor_at desc
  ) a
  on conflict (player_id, snap_date, discipline)
  do update set rating = excluded.rating, provisional = excluded.provisional,
                iso_week = excluded.iso_week, taken_on = excluded.taken_on;

  -- Alle anderen Disziplinen: kein eigener Verfalls-Anker vorhanden
  -- (elo_anchors ist Gesamt-only), daher einfach der aktuelle Live-Wert.
  insert into rating_snapshots (player_id, snap_date, iso_week, discipline, rating, rank, provisional, taken_on)
  select r.player_id, current_date, to_char(now(), 'IYYY-"W"IW'), r.discipline,
         round(r.rating::numeric, 1), null, r.provisional, current_date
  from ratings r
  where r.discipline <> 'Gesamt'
  on conflict (player_id, snap_date, discipline)
  do update set rating = excluded.rating, provisional = excluded.provisional,
                iso_week = excluded.iso_week, taken_on = excluded.taken_on;

  -- Rang jetzt pro Disziplin (vorher nur fuer Gesamt).
  update rating_snapshots s set rank = sub.rnk
  from (select player_id, discipline, rank() over (partition by discipline order by rating desc) as rnk
        from rating_snapshots where snap_date = current_date and not provisional) sub
  where s.player_id = sub.player_id and s.snap_date = current_date and s.discipline = sub.discipline;
end;
$function$;
