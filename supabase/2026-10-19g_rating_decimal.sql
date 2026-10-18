-- Ratings mit einer Nachkommastelle anzeigen (Nutzer-Wunsch 2026-10-19: "503,4 statt 503 - so sieht man auch bei kleinen Bewegungen, dass
-- sich etwas tut"). Die View rangliste lieferte das Rating bisher auf ganze Zahlen gerundet; neu kommt am ENDE die Spalte rating_dec dazu
-- (auf eine Nachkommastelle gerundet). Die bestehende Spalte rating bleibt unveraendert (ganze Zahl), damit nichts bricht - die App
-- nimmt rating_dec, sobald es da ist, und faellt sonst auf rating zurueck. Es werden keine Ratings neu berechnet, nur die Anzeige-Spalte
-- der View kommt hinzu (create or replace view darf Spalten nur anhaengen, deshalb am Ende).
--
-- Test, dann Produktion. Idempotent. Voraussetzung: 2026-10-18_decay_only_above_500.sql (Spalte ruhend).

create or replace view public.rangliste as
 SELECT r.discipline,
    p.nickname,
    round(r.rating)::integer AS rating,
    r.games_played AS spiele,
    r.provisional AS vorlaeufig,
    lm.letzte_partie::date AS letzte_partie,
    COALESCE(lm.letzte_partie > (now() - '180 days'::interval), false) AS aktiv,
    NOT COALESCE(lm.letzte_partie > (now() - '60 days'::interval), false) AS ruhend,
    round(r.rating, 1) AS rating_dec
   FROM ratings r
     JOIN players p ON p.id = r.player_id
     LEFT JOIN LATERAL ( SELECT max(m.played_at) AS letzte_partie
           FROM matches m
          WHERE m.confirmed
            AND r.player_id IN (m.player1_id, m.player2_id, m.player1b_id, m.player2b_id)
            AND (r.discipline IN ('Gesamt', 'Doppel') OR m.discipline = r.discipline)) lm ON true
  ORDER BY r.discipline, r.provisional, r.rating DESC;

-- Kontrolle: Spalte da, Beispielzeilen
select discipline, nickname, rating, rating_dec from rangliste where discipline = 'Gesamt' order by rating_dec desc limit 5;
