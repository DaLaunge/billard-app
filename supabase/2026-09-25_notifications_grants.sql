-- Tabellen-Berechtigungen fuer die Benachrichtigungen nachgereicht.
--
-- `2026-09-23_push_notifications.sql` legt `notifications` und
-- `push_subscriptions` an, schaltet RLS ein und vergibt `grant execute` auf
-- save_push_subscription()/delete_push_subscription() - aber KEINE
-- Berechtigung auf den Tabellen selbst. Die App liest `notifications` jedoch
-- direkt als Tabelle (supabase.from("notifications"), siehe die
-- Posteingang-Abfrage in src/App.jsx), nicht ueber eine RPC.
--
-- Solange Supabase neuen Tabellen in `public` automatisch Data-API-Zugriff
-- gibt, faellt das nicht auf. Sobald nicht (siehe den GRANT-Punkt unter
-- "Known gotchas" in CLAUDE.md), scheitert genau diese Abfrage mit
-- "permission denied" - und zwar OHNE dass die RLS-Policy schuld waere: RLS
-- filtert Zeilen, das GRANT oeffnet die Tabelle ueberhaupt erst. Der
-- Unterschied ist von aussen schwer zu sehen, deshalb hier explizit.
--
-- Eigene Datei statt einer Ergaenzung in der Migration vom 23.09.: die kann
-- auf einem Projekt schon gelaufen sein, dort wuerde eine nachtraegliche
-- Zeile im alten File nie ankommen. Dieses File ist gefahrlos mehrfach
-- ausfuehrbar.

-- Lesen des eigenen Posteingangs. Bewusst NUR select: schreiben darf hier
-- niemand ausser notify_players() (SECURITY DEFINER), und die Policy
-- "notifications_select_own" aus der Migration erlaubt ohnehin nur die
-- eigenen Zeilen.
grant select on public.notifications to authenticated;

-- service_role umgeht zwar RLS, braucht aber trotzdem das Tabellenrecht -
-- sonst laufen Wartungs-/Admin-Zugriffe ueber die Data API ins Leere.
grant select, insert, update, delete on public.notifications to service_role;

-- `push_subscriptions` fasst der Client ausschliesslich ueber die beiden
-- SECURITY-DEFINER-RPCs an und hat bewusst gar keine RLS-Policy, bleibt fuer
-- `authenticated` also zu. Nur service_role bekommt hier ein Recht, damit ein
-- spaeterer direkter Blick in die Abos nicht an einem fehlenden GRANT
-- scheitert.
grant select, insert, update, delete on public.push_subscriptions to service_role;
