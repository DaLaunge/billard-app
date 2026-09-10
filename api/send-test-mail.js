// Vercel Serverless Function: verschickt eine Testmail direkt per SMTP
// (unabhaengig von Supabase Auth - dort gibt es keine API fuer beliebige
// Betreff/Text-Mails, nur feste Auth-Templates). Dient dazu, die reine
// Sendekapazitaet/-dauer des konfigurierten Mail-Anbieters zu testen,
// bevor er als Supabase-Auth-SMTP eingetragen wird.
//
// Erwartet serverseitige Env-Vars (NICHT VITE_-Praefix - sonst landen sie
// im Client-Bundle!): TEST_SMTP_HOST, TEST_SMTP_PORT, TEST_SMTP_USER,
// TEST_SMTP_PASS. In Vercel unter Project Settings -> Environment
// Variables eintragen.
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Nicht angemeldet." });
    return;
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Ungültige Sitzung." });
    return;
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("role, nickname")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (playerError || player?.role !== "admin") {
    res.status(403).json({ error: "Nur für Admins." });
    return;
  }

  const missing = ["TEST_SMTP_HOST", "TEST_SMTP_USER", "TEST_SMTP_PASS"].filter((k) => !process.env[k]);
  if (missing.length) {
    res.status(500).json({
      error: `SMTP-Umgebungsvariablen fehlen: ${missing.join(", ")} (VERCEL_ENV=${process.env.VERCEL_ENV || "?"})`,
    });
    return;
  }

  const { to, subject, text } = req.body || {};
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "Gültige Empfänger-Adresse nötig." });
    return;
  }

  const now = new Date().toISOString();
  const finalSubject = (subject || "").trim() || `Break & Rank Testmail – ${now}`;
  const finalText = (text || "").trim() ||
    `Testmail von ${player.nickname} über ${process.env.TEST_SMTP_HOST}, gesendet um ${now}.`;

  const port = Number(process.env.TEST_SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.TEST_SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.TEST_SMTP_USER, pass: process.env.TEST_SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"Break & Rank Test" <${process.env.TEST_SMTP_USER}>`,
      to,
      subject: finalSubject,
      text: finalText,
    });
    res.status(200).json({ ok: true, sentAt: now, subject: finalSubject });
  } catch (err) {
    res.status(502).json({ error: err.message || "Mailversand fehlgeschlagen." });
  }
}
