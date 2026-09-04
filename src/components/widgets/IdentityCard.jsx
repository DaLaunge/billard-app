import { QrCode } from "lucide-react";
import { t } from "../../lib/i18n";
import { initials, fmtDate } from "../../lib/format";
import Ball from "../Ball";
import DecayBadge from "./DecayBadge";

/* Vereinheitlichte Identitaets-Karte: grosses, zentriertes Foto im Fokus,
   dann Name, Rating, Motto, "Dabei seit", die 4 Kernzahlen - exakt dieselbe
   Struktur auf Uebersicht/Live/Statistik (immer der eingeloggte Spieler)
   und im Profil (der/die eigene oder ein fremdes). onHeadClick nur
   gesetzt, wenn ein Klick etwas ausloesen soll - auf Uebersicht/Live/
   Statistik fuehrt das zum vollen Profil, auf der Profilseite selbst
   (schon dort) stattdessen zur Foto-Vergroesserung. Seiten-spezifische
   Aktionen (Profil bearbeiten / Match starten / Herausfordern) reicht die
   aufrufende Seite als "actions" rein, damit diese Karte generisch bleibt.
   onInvite nur gesetzt fuer den eigenen Account (nie auf einem fremden
   Profil) - das QR-Symbol steht bewusst NICHT im "head"-Button/-Div (das
   waere ein ungueltiges verschachteltes <button>) und auch nicht im
   normalen Textfluss (das wuerde "Dabei seit" aus der Mitte draengen),
   sondern als eigenes, absolut positioniertes Element in der oberen
   rechten Ecke der Karte - der zentrierte Text darunter bleibt davon
   unberuehrt. Der Rating-Hinweis (DecayBadge, siehe widgets/DecayBadge.jsx
   - Punkteverfall, laengere Inaktivitaet oder vorlaeufiges Rating, je
   nachdem was zutrifft) spiegelt das an der oberen linken Ecke - selber
   Grund. pulse=true, weil hier immer genau eine (die betroffene) Person im
   Fokus steht - im Unterschied zur Rangliste, wo mehrere Treffer
   gleichzeitig zu sehen sein koennen (siehe RanglisteScreen.jsx). */
export default function IdentityCard({ nickname, gesamt, motto, since, stats, colorOf, badgeOf, photoOf,
  onHeadClick, onInvite, actions, photoSize = 88 }) {
  const head = (
    <>
      <Ball color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} photo={photoOf(nickname)} size={photoSize} />
      <h3 className="id-card-name">{nickname}</h3>
      <div className="id-card-rating">
        {gesamt ? gesamt.rating : "-"}
        {gesamt?.vorlaeufig && <span className="prov-badge">{t("vorlaeufig")}</span>}
      </div>
      {motto && <p className="id-card-motto">"{motto}"</p>}
      {since && <p className="id-card-since">{t("Dabei seit {date}", { date: fmtDate(since) })}</p>}
    </>
  );
  return (
    <section className="stat-block id-card">
      {onHeadClick ? (
        <button className="id-card-head" onClick={onHeadClick}>{head}</button>
      ) : (
        <div className="id-card-head">{head}</div>
      )}
      <DecayBadge player={gesamt} className="id-card-decay-warn" iconSize={20} pulse />
      {onInvite && (
        <button className="id-card-invite" onClick={onInvite} aria-label={t("Freund einladen")} title={t("Freund einladen")}>
          <QrCode size={18} />
        </button>
      )}
      <div className="dash-stats id-card-kpis">
        <div><b>{stats?.spiele ?? 0}</b><span>{t("Spiele")}</span></div>
        <div><b>{stats?.siege ?? 0}</b><span>{t("Siege")}</span></div>
        <div><b>{stats?.quote ?? 0} %</b><span>{t("Quote")}</span></div>
        <div><b>{stats ? (stats.streak > 0 ? `+${stats.streak}` : stats.streak) : 0}</b><span>{t("Serie")}</span></div>
      </div>
      {actions}
    </section>
  );
}
