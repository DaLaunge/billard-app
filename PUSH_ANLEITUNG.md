# Push-Benachrichtigungen einrichten

Einmalig pro Supabase-Projekt (erst Test, dann Produktion). Ohne diese Schritte
funktionieren die Stufen „Aus“ und „In der App“ trotzdem, nur „Push“ verschickt nichts.

## 1. Schlüssel

Du brauchst ein VAPID-Schlüsselpaar und ein frei gewähltes Secret. Beide
Projekte (Test und Produktion) können dasselbe Paar nutzen.

- `VAPID_PUBLIC_KEY`: öffentlich, kommt in die App (Vercel + `.env`)
- `VAPID_PRIVATE_KEY`: geheim, kommt NUR in die Supabase-Secrets
- `PUSH_WEBHOOK_SECRET`: geheim, schützt die Edge Function vor fremden Aufrufen

Neu erzeugen, falls nötig: `npx web-push generate-vapid-keys`

**Achtung:** Wechselt das Schlüsselpaar später, sind alle bestehenden Abos
ungültig. Dann müssen alle „Push“ einmal neu einschalten.

## 2. Migration

`supabase/2026-09-23_push_notifications.sql` im SQL-Editor ausführen.

## 3. Edge Function `send-push`

Supabase-Dashboard → Edge Functions → „Deploy a new function“ → „Via Editor“:

- Name: `send-push`
- Inhalt: `supabase/functions/send-push/index.ts`
- Unter den Einstellungen der Funktion **„Enforce JWT verification“ AUSschalten**.
  Die Funktion prüft stattdessen selbst das `PUSH_WEBHOOK_SECRET`.

Alternativ über die CLI:
`supabase functions deploy send-push --no-verify-jwt --project-ref <ref>`

Danach unter Edge Functions → Secrets anlegen:

| Name | Wert |
|---|---|
| `VAPID_PUBLIC_KEY` | öffentlicher Schlüssel |
| `VAPID_PRIVATE_KEY` | privater Schlüssel |
| `VAPID_SUBJECT` | `mailto:deine@adresse` |
| `PUSH_WEBHOOK_SECRET` | das Secret |

## 4. Vault-Secrets für die Datenbank

Im SQL-Editor (Projekt-Ref anpassen):

```sql
select vault.create_secret('https://<projekt-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
select vault.create_secret('<PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');
```

## 5. App

`VITE_VAPID_PUBLIC_KEY=<öffentlicher Schlüssel>` in `.env` (lokal) und bei
Vercel unter Environment Variables eintragen, danach neu deployen.

## Testen

1. Profil → „Profil bearbeiten“ → Benachrichtigungen → „Push“,
   dann die Erlaubnis bestätigen.
2. Mit einem zweiten Konto einen Live-Ping setzen oder den Account herausfordern.
3. Kommt nichts an, im SQL-Editor nachsehen:
   - `select * from notifications order by id desc limit 5;` zeigt, ob der Trigger gefeuert hat.
   - `select * from net._http_response order by id desc limit 5;` zeigt die Antwort der Edge Function.
   - Edge Functions → send-push → Logs zeigt Fehler beim Versand.

## Hinweise

- **iPhone:** erst ab iOS 16.4 und nur, wenn die App über „Zum Home-Bildschirm“
  installiert ist. Im normalen Safari-Tab gibt es kein Push.
- **Android/Desktop:** Chrome, Edge und Firefox.
