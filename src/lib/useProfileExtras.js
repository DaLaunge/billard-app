import { useMemo } from "react";
import { computeAchievementExtras } from "./achievements";
import { RULES_TOTAL } from "./rulesTotal";
import { useLocations } from "./locationStore";

/* Kennzahlen eines Spielers fuer Erfolge, Identitaet und fremde Profile (vorher mitten in ProfilScreen):
   liveExtras = alles, was sich aus matches/players/challenges ableiten laesst (Serien, Zu-Null-Siege, Rekorde, Geworbene ...);
   extendedExtras = liveExtras + Mitgliedsdauer (players.created_at) und die Zaehler, die nur die Datenbank kennt
   (Ghost-Spiele, Turnierplaetze, angesehene Regeln aus my_achievement_counters()). */
export function useProfileExtras(nickname, matches, players, challenges, achievementCounters) {
  const locs = useLocations();
  const playerObj = players.find((p) => p.nickname === nickname);
  // Erkundung: freigegebene Lokale, die der Spieler eingetragen hat (null, solange es die Tabelle noch nicht gibt)
  const explorer = locs.available ? locs.list.filter((l) => l.created_by === playerObj?.id && l.status === "approved").length : null;
  const baseExtras = useMemo(
    () => computeAchievementExtras(nickname, matches, players, challenges),
    [matches, players, nickname, challenges]
  );
  const liveExtras = useMemo(() => ({ ...baseExtras, explorer }), [baseExtras, explorer]);
  const extendedExtras = useMemo(() => ({
    ...liveExtras,
    joinedAt: playerObj?.created_at ?? null,
    ghostGames: achievementCounters?.ghost_games ?? null,
    tournamentWins: achievementCounters?.tournament_wins ?? null,
    tournament2nd: achievementCounters?.tournament_2nd ?? null,
    tournament3rd: achievementCounters?.tournament_3rd ?? null,
    rulesViewed: achievementCounters?.rules_viewed ?? null,
    rulesTotal: RULES_TOTAL,
  }), [liveExtras, playerObj?.created_at, achievementCounters]);
  return { liveExtras, extendedExtras, playerObj };
}
