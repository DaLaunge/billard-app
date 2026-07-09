# Break & Rank – Billard-Vereins-App

Eine PWA (installierbare Web-App) auf Basis von React + Vite + Supabase.

## Voraussetzungen (bereits erledigt, wenn du der Claude-Anleitung gefolgt bist)
- Supabase-Projekt mit Schema, Rating-Engine (Phase 2) und Sicherheitsschicht (Phase 3a)
- Project URL und anon-Key aus Supabase → Settings → API

## Deployment ohne lokale Installation (GitHub + Vercel)

1. **GitHub:** Neues Repository anlegen (z. B. `billard-app`, gerne privat).
   Dann "Add file → Upload files" und ALLE Dateien und Ordner dieses
   Projekts per Drag & Drop hineinziehen (auch die Ordner `src` und
   `public`). Commit ausführen.

2. **Vercel:** Auf vercel.com mit dem GitHub-Konto anmelden →
   "Add New → Project" → das Repository importieren.
   Vercel erkennt Vite automatisch. Vor dem Deploy unter
   **Environment Variables** zwei Einträge anlegen:
   - `VITE_SUPABASE_URL` = deine Project URL (https://xxxx.supabase.co)
   - `VITE_SUPABASE_ANON_KEY` = dein anon public Key
   Dann **Deploy** klicken.

3. **Supabase:** Authentication → URL Configuration:
   - **Site URL** = deine Vercel-Adresse (https://…vercel.app)
   - Bei **Redirect URLs** dieselbe Adresse hinzufügen.
   Ohne diesen Schritt führen die Login-Links ins Leere!

4. **Testen:** App-Adresse am Handy öffnen, mit E-Mail einloggen,
   Nickname registrieren (Alt-Spieler: exakt den alten Nicknamen
   verwenden!), Match melden, vom Gegner bestätigen lassen.

5. **Installieren:** Im Handy-Browser "Zum Startbildschirm hinzufügen" –
   die App verhält sich dann wie eine native App.

## Änderungen später
Jede Änderung an Dateien im GitHub-Repository (auch direkt im
Browser editierbar) löst automatisch ein neues Deployment bei
Vercel aus. Nach 1–2 Minuten ist die neue Version live.
