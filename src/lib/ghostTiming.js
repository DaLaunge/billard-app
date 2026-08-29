/* Mindestdauer eines Ghost-Trainings, geschaetzt aus dem eingetragenen
   Ergebnis - verhindert das "Durchklicken" von Trainingsspielen (Score
   1:0 eintragen, sofort abschliessen, wiederholen). Grobe Faustregel,
   kein exaktes Tempo-Modell: 3 Minuten Grundzeit fuers erste Rack, danach
   +1 Minute pro weiterem Rack bei Renn-Disziplinen (8/9/10 Ball); bei
   14/1 Endlos ~3 Sekunden pro Punkt (mindestens ebenfalls 3 Minuten).
   Muss inhaltlich mit der gleichnamigen Pruefung in record_ghost_game()
   (SQL) uebereinstimmen. */
export function minGhostSeconds(discipline, score1, score2) {
  const total = Math.max(0, score1 || 0) + Math.max(0, score2 || 0);
  if (discipline === "14/1 Endlos") return Math.max(180, total * 3);
  return 180 + Math.max(0, total - 1) * 60;
}
