import { useMemo } from "react";
import { computeAchievementExtras } from "./achievements";
import { RULES_TOTAL } from "./rulesTotal";

/* Kennzahlen eines Spielers fuer Erfolge, Identitaet und fremde Profile (vorher mitten in ProfilScreen):
   liveExtras = alles, was sich aus matches/players/challenges ableiten laesst (Serien, Zu-Null-Siege, Rekorde, Geworbene ...);
   extendedExtras = liveExtras + Mitgliedsdauer (players.created_at) und die Zaehler, die nur die Datenbank kennt
   (Ghost-Spiele, Turnierplaetze, angesehene Regeln aus my_achievement_counters()). */
export function useProfileExtras(nickname, matches, players, challenges, achievementCounters) {
  const liveExtras = useMemo(
    () => computeAchievementExtras(nickname, matches, players, challenges),
    [matches, players, nickname, challenges]
  );
  const playerObj = players.find((p) => p.nickname === nickname);
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
