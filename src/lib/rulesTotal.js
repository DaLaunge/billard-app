// Anzahl der freigegebenen Regelfaelle (src/lib/rules/cases). Nur eine Zahl, damit Profil/Erfolge nicht den
// schweren Regelkatalog laden muessen; scripts/checkRules.mjs prueft, dass sie stimmt. Sie aendert sich, wenn
// Faelle dazukommen - "Alle Regeln angesehen" bleibt trotzdem fuer alle, die den Erfolg schon haben (siehe
// supabase/2026-10-08_rules_achievements.sql).
export const RULES_TOTAL = 51;
