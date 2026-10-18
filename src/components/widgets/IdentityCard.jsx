import { useState } from "react";
import { QrCode, Settings } from "lucide-react";
import { t } from "../../lib/i18n";
import { initials, fmtDate } from "../../lib/format";
import Ball from "../Ball";
import DecayBadge from "./DecayBadge";
import ClubEmblem from "./ClubEmblem";
import ClubLogoModal from "./ClubLogoModal";
import { useClubData, clubsOfPlayer } from "../../lib/clubStore";
import { EmojiText } from "../Emoji";

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
   gleichzeitig zu sehen sein koennen (siehe StatistikScreen.jsx).
   onSettings (nur eigenes Profil, seit 2026-09-26): Zahnrad fuer "Profil
   bearbeiten" links neben dem QR-Symbol in derselben Ecke - vorher stand
   es rechts oben im Bildschirmkopf, weit weg von der Karte, zu der es
   gehoert. Beide sitzen in EINEM absolut positionierten Container, damit
   das jeweils vorhandene Symbol immer buendig rechts steht. */
export default function IdentityCard({ nickname, gesamt, motto, since, stats, colorOf, badgeOf, photoOf,
  onHeadClick, onInvite, onSettings, actions, sideActions, photoSize = 88, playerId }) {
  // Clubs (Hauptclub zuerst) als Emblem links und rechts NEBEN der Kugel - dort ist Platz, und die Kugel bleibt frei (kein Wappen
  // darauf, kein Tag-Streifen darunter). Mehr als zwei Clubs: "+n" unter dem zweiten, die Vollansicht kennt alle.
  // Wer in keinem Club ist, bekommt einfach nichts.
  const clubs = clubsOfPlayer(useClubData(), playerId);
  const [viewClub, setViewClub] = useState(null);
  const extra = Math.max(0, clubs.length - 2);
  const head = (
    <>
      <div className="id-avatar-row">
        <div className="id-avatar-side left">{clubs[0] && <ClubEmblem club={clubs[0]} onOpen={setViewClub} />}</div>
        <Ball nick={nickname} color={colorOf(nickname)} label={initials(nickname)} badge={badgeOf(nickname)} photo={photoOf(nickname)} size={photoSize} />
        <div className="id-avatar-side right">
          {clubs[1] && <ClubEmblem club={clubs[1]} onOpen={setViewClub} />}
          {extra > 0 && (
            <span className="club-more" role="button" tabIndex={0} title={t("Alle Clubs ansehen")} aria-label={t("Alle Clubs ansehen")}
              onClick={(e) => { e.stopPropagation(); setViewClub(clubs[0]); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setViewClub(clubs[0]); } }}>+{extra}</span>
          )}
        </div>
      </div>
      <h3 className="id-card-name">{nickname}</h3>
      <div className="id-card-rating">
        {gesamt ? gesamt.rating : "-"}
        {gesamt?.vorlaeufig && <span className="prov-badge">{t("vorlaeufig")}</span>}
      </div>
      {motto && <p className="id-card-motto">"<EmojiText>{motto}</EmojiText>"</p>}
      {since && <p className="id-card-since">{t("Dabei seit {date}", { date: fmtDate(since) })}</p>}
    </>
  );
  return (
    <section className="stat-block id-card">
      {(() => {
        const headEl = onHeadClick
          ? <button className="id-card-head" onClick={onHeadClick}>{head}</button>
          : <div className="id-card-head">{head}</div>;
        // Runde Aktionsknoepfe links und rechts unter dem Avatar (fremde Profile: Match starten / Herausfordern)
        return sideActions
          ? <div className="id-card-hero">{sideActions.left}{headEl}{sideActions.right}</div>
          : headEl;
      })()}
      {viewClub && <ClubLogoModal club={viewClub} clubs={clubs} onClose={() => setViewClub(null)} />}
      <DecayBadge player={gesamt} className="id-card-decay-warn" iconSize={20} pulse />
      {(onSettings || onInvite) && (
        <div className="id-card-corner">
          {onSettings && (
            <button className="id-card-icon-btn" onClick={onSettings} aria-label={t("Einstellungen")} title={t("Einstellungen")}>
              <Settings size={18} />
            </button>
          )}
          {onInvite && (
            <button className="id-card-icon-btn" onClick={onInvite} aria-label={t("Freund einladen")} title={t("Freund einladen")}>
              <QrCode size={18} />
            </button>
          )}
        </div>
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
