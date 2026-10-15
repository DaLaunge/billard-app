-- Pruefung: zaehlt ein Match gegen einen Gast irgendwo? (Nutzer-Meldung 2026-10-15:
-- DaLaunge verlor 60:80 gegen "Max ziervogel" (Gast), Rating sank trotzdem.)
--
-- Schreibt NICHTS dauerhaft: legt in einer Transaktion einen Gast und ein bestaetigtes
-- 14/1-Match 60:80 gegen den Spieler an (der Trigger rechnet dabei wie im echten Betrieb),
-- vergleicht Rating/Anker/Verlauf VORHER und NACHHER und bricht am Ende mit
-- RAISE EXCEPTION ab -> alles wird zurueckgerollt. Das Ergebnis steht in der Fehlermeldung.
--
-- Spieler wechseln: unten bei v_nick. Im SQL-Editor ausfuehren (Test, dann Prod).

do $$
declare
  v_nick   text := null;   -- null = automatisch: Spieler mit dem juengsten Einzel-Match (kein Gast)
  v_disc   text;
  v_me     uuid;
  v_guest  uuid;
  v_out    text := '';
  r_before numeric; r_after numeric; g_before int; g_after int;
  a_before int; a_after int; s_before numeric; s_after numeric;
  guest_ratings int; guest_anchors int; guest_snaps int;
  badges_before int; badges_after int;
  v_real uuid; r_real numeric; g_real int;
begin
  if v_nick is not null then
    select m.player1_id, m.discipline into v_me, v_disc
    from matches m join players p on p.id = m.player1_id
    where p.nickname = v_nick and not p.is_guest and m.confirmed and m.player1b_id is null
    order by m.played_at desc limit 1;
  else
    select m.player1_id, m.discipline into v_me, v_disc
    from matches m
    where m.confirmed and m.player1b_id is null and m.score1 <> m.score2
      and not exists (select 1 from players p
                      where p.id in (m.player1_id, m.player2_id) and (p.is_guest or p.is_ghost))
    order by m.played_at desc limit 1;
  end if;
  if v_me is null then raise exception 'Kein passender Spieler/Match gefunden'; end if;
  select nickname into v_nick from players where id = v_me;

  select rating, games_played into r_before, g_before from ratings where player_id = v_me and discipline = v_disc;
  select count(*) into a_before from elo_anchors where player_id = v_me;
  select rating into s_before from rating_snapshots where player_id = v_me and discipline = v_disc order by snap_date desc limit 1;
  select count(*) into badges_before from player_badges where player_id = v_me;

  insert into players (nickname, is_guest) values ('Pruef-Gast-' || substr(gen_random_uuid()::text, 1, 6), true)
    returning id into v_guest;

  -- wie report_match(): Gast als Gegner -> sofort bestaetigt
  insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed)
  values (v_me, v_guest, 60, 80, v_disc, v_me, true);

  select rating, games_played into r_after, g_after from ratings where player_id = v_me and discipline = v_disc;
  select count(*) into a_after from elo_anchors where player_id = v_me;
  select rating into s_after from rating_snapshots where player_id = v_me and discipline = v_disc order by snap_date desc limit 1;
  select count(*) into badges_after from player_badges where player_id = v_me;
  select count(*) into guest_ratings from ratings where player_id = v_guest;
  select count(*) into guest_anchors from elo_anchors where player_id = v_guest;
  select count(*) into guest_snaps from rating_snapshots where player_id = v_guest;

  -- Gegenprobe: ein Match gegen einen NORMALEN Spieler muss weiter neu rechnen
  select p.id into v_real from players p
    where not p.is_guest and not p.is_ghost and p.id <> v_me
      and exists (select 1 from ratings r where r.player_id = p.id)
    order by p.created_at limit 1;
  if v_real is not null then
    insert into matches (player1_id, player2_id, score1, score2, discipline, reported_by, confirmed)
    values (v_me, v_real, 80, 60, v_disc, v_me, true);
    select rating, games_played into r_real, g_real from ratings where player_id = v_me and discipline = v_disc;
  end if;

  v_out := format(E'\nSpieler: %s (juengstes Einzel-Match in %s)\nRating %s: %s -> %s  (%s)\nSpiele: %s -> %s  (%s)\nAnker: %s -> %s\nVerlauf heute: %s -> %s  (%s)\nErfolge: %s -> %s\nGast: Ratings %s, Anker %s, Snapshots %s (alle muessen 0 sein)\nGegenprobe normales Match (80:60 gegen echten Spieler): Rating %s, Spiele %s (%s)',
    v_nick, v_disc, v_disc, r_before::numeric(10,3), r_after::numeric(10,3),
    case when r_before::text = r_after::text then 'UNVERAENDERT - ok' else 'VERAENDERT - FEHLER' end,
    g_before, g_after, case when g_before = g_after then 'ok' else 'FEHLER' end,
    a_before, a_after,
    s_before, s_after, case when s_before is not distinct from s_after then 'ok' else 'FEHLER' end,
    badges_before, badges_after, guest_ratings, guest_anchors, guest_snaps,
    r_real::numeric(10,3), g_real,
    case when v_real is null then 'kein Vergleichsspieler'
         when g_real = g_after + 1 and r_real::text is distinct from r_after::text then 'rechnet neu - ok'
         else 'FEHLER: keine Neuberechnung' end);

  raise exception 'GASTMATCH-PRUEFUNG (zurueckgerollt):%', v_out;
end $$;
