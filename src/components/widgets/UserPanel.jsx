import { useMemo } from "react";
import { computeStats } from "../../lib/stats";
import { numbersParts } from "../../lib/cardLayout";
import IdentityCard from "./IdentityCard";
import NumbersDeck from "./NumbersDeck";

/* Die immer gleiche linke Spalte am PC auf Statistik und Live (und, mit
   denselben Bausteinen, im Profil): Identitaetskarte + "Meine Zahlen"
   (Ratings / Rekorde / Gegner / Tempo als Reiter, siehe NumbersDeck.jsx) - eine
   wiedererkennbare Konstante beim Wechsel zwischen den Tabs (bewusste
   Redundanz am PC fuer den Wiedererkennungswert; am Handy zeigt jede Seite
   weiterhin nur ihren eigenen Fokus, siehe die jeweiligen CSS-Regeln).

   Bis 2026-09-30 stapelte diese Spalte Ratings, Rekorde und Head-to-Head als
   einzelne Karten - und Statistik liess die Ratings weg (hideRatings), das
   Profil zeigte schon die Reiter-Karte. Drei Varianten derselben Spalte;
   Nutzer-Feedback: "In der PC-Version ist auf der linken Spalte immer
   dieselbe Ansicht. Diese variiert nun." Deshalb gibt es hideRatings nicht
   mehr, und welche Reiter erscheinen, kommt aus dem Profil-Layout
   (cardLayout = players.card_layout des eingeloggten Spielers).

   nickname ist NICHT fix "der eingeloggte Spieler" - auf Statistik/Live ist
   das immer "me", auf einem fremden Profil aber die betrachtete Person,
   damit dort weiterhin deren eigene Werte stehen (dort baut das Profil die
   Spalte selbst, mit isMe=false). */
export default function UserPanel({ nickname, matches, rangliste, players, challenges, catalog, earnedBadges,
  colorOf, badgeOf, photoOf, onOpenProfile, onInvite, cardLayout, isMe = true }) {
  const stats = useMemo(() => computeStats(matches)[nickname], [matches, nickname]);
  const myRows = rangliste.filter((r) => r.nickname === nickname);
  const gesamt = myRows.find((r) => r.discipline === "Gesamt");
  const playerObj = players.find((p) => p.nickname === nickname);
  const parts = useMemo(() => numbersParts(cardLayout?.profil), [cardLayout]);

  return (
    <>
      <IdentityCard nickname={nickname} gesamt={gesamt} motto={playerObj?.motto} since={playerObj?.created_at}
        stats={stats} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} onHeadClick={() => onOpenProfile(nickname)}
        onInvite={onInvite} />

      <NumbersDeck nickname={nickname} isMe={isMe} parts={parts} matches={matches} rangliste={rangliste}
        players={players} challenges={challenges} catalog={catalog} earnedBadges={earnedBadges}
        onOpenProfile={onOpenProfile} colorOf={colorOf} badgeOf={badgeOf} photoOf={photoOf} />
    </>
  );
}
