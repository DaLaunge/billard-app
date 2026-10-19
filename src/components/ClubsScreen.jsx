import { t } from "../lib/i18n";
import ClubsCard from "./widgets/ClubsCard";
import ClubInbox from "./widgets/ClubInbox";

/* Eigener Menuepunkt "Clubs" (415.17, Nutzer: Clubs gehoeren nicht mehr in die Einstellungen): Club-Post (offene Einladungen/Anfragen, nur wenn
   etwas offen ist) und die Club-Verwaltung - Clubs gruenden, beitreten, entdecken, Mitglieder einladen, Logo, Motto. */
export default function ClubsScreen({ meRow, players, toast }) {
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <h2>{t("Clubs")}</h2>
          <span className="head-note">{t("Gründen, beitreten, einladen")}</span>
        </div>
      </header>
      <div className="clubs-screen">
        <ClubInbox meRow={meRow} players={players} toast={toast} />
        <ClubsCard meRow={meRow} players={players} toast={toast} />
      </div>
    </div>
  );
}
