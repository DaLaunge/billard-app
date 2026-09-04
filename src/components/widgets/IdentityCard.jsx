import { useState } from "react";
import { QrCode, AlertTriangle } from "lucide-react";
import { t } from "../../lib/i18n";
import { initials, fmtDate, isDecaying } from "../../lib/format";
import Ball from "../Ball";

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
   unberuehrt. Der Punkteverfall-Hinweis (Warndreieck) spiegelt das an der
   oberen linken Ecke - selber Grund: kein verschachteltes <button>, Text
   in der Mitte bleibt unberuehrt. Bewusst NUR das Symbol (auffaellig,
   pulsierend), die Erklaerung kommt als Klick-Popup statt Dauertext, damit
   die Karte fuer die meisten (nicht verfallenden) Spieler unveraendert
   bleibt. */
export default function IdentityCard({ nickname, gesamt, motto, since, stats, colorOf, badgeOf, photoOf,
  onHeadClick, onInvite, actions, photoSize = 88 }) {
  const [decayInfoOpen, setDecayInfoOpen] = useState(false);
  const decaying = isDecaying(gesamt?.letzte_partie);
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
      {decaying && (
        <button className="id-card-decay-warn" onClick={() => setDecayInfoOpen(true)}
          aria-label={t("Punkteverfall - mehr erfahren")} title={t("Punkteverfall - mehr erfahren")}>
          <AlertTriangle size={20} />
        </button>
      )}
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
      {decayInfoOpen && (
        <div className="modal-overlay" onClick={() => setDecayInfoOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3><AlertTriangle size={18} /> {t("Punkteverfall")}</h3>
            <p>{t("Ohne bestaetigte Matches sinkt ein Rating mit der Zeit wieder Richtung 500 (Startwert) - so bleibt die Rangliste auch bei laengeren Pausen aussagekraeftig.")}</p>
            <p>{t("Einfach ein Match spielen und bestaetigen lassen, um den Verfall zu stoppen.")}</p>
            <div className="sp-controls">
              <button className="btn primary" onClick={() => setDecayInfoOpen(false)}>{t("Verstanden")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
