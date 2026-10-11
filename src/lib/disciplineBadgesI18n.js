import { addTranslations } from "./i18n";
import { BADGES } from "./disciplineBadges";

/* Englische Namen und Beschreibungen der Disziplin-Erfolge (Schluessel = deutscher Text, wie ueberall) - aus derselben
   Datenquelle wie die Migration, damit Katalog und Uebersetzung nie auseinanderlaufen. Wird einmal beim Start angemeldet. */
const en = { "Disziplinen": "Disciplines" };
BADGES.forEach((b) => { en[b.name] = b.nameEn; en[b.descDe] = b.descEn; });
addTranslations("en", en);
