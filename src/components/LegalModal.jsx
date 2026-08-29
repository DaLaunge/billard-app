import { X } from "lucide-react";
import { t } from "../lib/i18n";

export default function LegalModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box legal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("Nutzungsbedingungen & Datenschutzerklärung")}</h3>
          <button className="clear-btn" onClick={onClose} aria-label={t("Schliessen")}><X size={18} /></button>
        </div>
        <div className="legal-text">
          <p>{t("Diese App wird als Vereinsprojekt betrieben. Mit der Nutzung erklärst du dich mit den folgenden Bedingungen einverstanden.")}</p>

          <h4>{t("Verantwortliche Stelle")}</h4>
          <p>{t("Verantwortlich für die Datenverarbeitung ist der Betreiber dieser App, erreichbar unter")} <a href="mailto:dalaunge@gmx.at">dalaunge@gmx.at</a>.</p>

          <h4>{t("Welche Daten werden verarbeitet")}</h4>
          <p>{t("Bei der Nutzung werden verarbeitet: deine E-Mail-Adresse (zur Anmeldung), dein selbstgewählter Spielername, Match-Ergebnisse und die daraus berechneten Ratings/Statistiken, optional eine Profilfarbe und ein Motto, sowie – falls du andere eingeladen hast – die Zuordnung \"eingeladen von dir\".")}</p>

          <h4>{t("Zweck und Rechtsgrundlage")}</h4>
          <p>{t("Die Verarbeitung erfolgt zur Bereitstellung der Rangliste und der App-Funktionen (Art. 6 Abs. 1 lit. b DSGVO) sowie zur fairen, nachvollziehbaren Ranglistenführung im Verein (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse).")}</p>

          <h4>{t("Hosting")}</h4>
          <p>{t("Die Daten werden bei Supabase als Auftragsverarbeiter gehostet.")}</p>

          <h4>{t("Speicherdauer")}</h4>
          <p>{t("Deine Daten bleiben gespeichert, bis du sie selbst löschst oder ihre Löschung anfragst.")}</p>

          <h4>{t("Deine Rechte")}</h4>
          <p>{t("Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch und Datenübertragbarkeit sowie ein Beschwerderecht bei der zuständigen Datenschutzbehörde.")}</p>

          <h4>{t("Selbstständige Löschung")}</h4>
          <p>{t("Du kannst dein Konto jederzeit in deinem Profil unter \"Meine Daten löschen\" selbst und endgültig löschen. Dabei werden alle personenbezogenen Daten (Login, Name, Profilfarbe, Motto, Nachrichten) unwiderruflich entfernt. Reine Ergebniszahlen bereits gespielter Matches bleiben anonymisiert bestehen, damit die Statistik der übrigen Mitglieder korrekt bleibt – ohne jeden Bezug mehr zu dir.")}</p>

          <h4>{t("Kontakt")}</h4>
          <p>
            {t("Fragen zum Datenschutz beantworten wir gerne unter")} <a href="mailto:dalaunge@gmx.at">dalaunge@gmx.at</a> {t("oder im")}{" "}
            <a href="https://t.me/+vG8sWgH_utJlODRk" target="_blank" rel="noopener noreferrer">Telegram-Kanal</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
