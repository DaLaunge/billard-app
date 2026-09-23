// Edge Function "send-push": verschickt Web-Push-Nachrichten.
//
// Wird ausschliesslich von notify_players() in der Datenbank aufgerufen (per
// pg_net, siehe supabase/2026-09-23_push_notifications.sql) - die Datenbank
// schickt die fertigen Texte (de + en) und die Abos der Empfaenger gleich
// mit, hier wird nur noch verschluesselt und verschickt. Abgesichert ueber
// ein gemeinsames Secret im Header statt ueber ein Supabase-JWT, darum mit
// "Verify JWT" = AUS deployen (siehe PUSH_ANLEITUNG.md).
//
// Benoetigte Secrets (Edge Functions -> Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (z.B. mailto:...),
//   PUSH_WEBHOOK_SECRET (derselbe Wert wie im Vault "push_webhook_secret").
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase selbst bereit.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

type Sub = { endpoint: string; p256dh: string; auth: string; lang: string; notification_id: number };

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

Deno.serve(async (req) => {
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const msg = await req.json();
  const subs: Sub[] = Array.isArray(msg.subscriptions) ? msg.subscriptions : [];
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(subs.map(async (s) => {
    const en = s.lang === "en";
    const payload = JSON.stringify({
      id: s.notification_id,
      kind: msg.kind,
      title: en ? msg.title_en : msg.title_de,
      body: en ? msg.body_en : msg.body_de,
      nav: msg.nav ?? null,
    });
    try {
      // TTL 1h: eine "du bist dran"- oder "ist live"-Meldung, die erst
      // Stunden spaeter ankommt (Handy war aus), ist nur noch verwirrend.
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch (e) {
      // 404/410 = Abo existiert beim Push-Dienst nicht mehr (App deinstalliert,
      // Erlaubnis entzogen) -> aufraeumen, sonst versuchen wir es ewig weiter.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else console.error("push failed", code, (e as Error).message);
    }
  }));

  if (gone.length > 0) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("push_subscriptions").delete().in("endpoint", gone);
  }

  return new Response(JSON.stringify({ sent, gone: gone.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
