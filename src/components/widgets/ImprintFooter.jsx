import { useState } from "react";
import { t } from "../../lib/i18n";
import { APP_VERSION } from "../../lib/constants";
import LegalModal from "../LegalModal";

// Impressum - bisher nur am Ende des Profil-Bildschirms sichtbar, rechtlich
// aber auf jedem Hauptmenuepunkt erreichbar (Nutzer-Feedback). Eigene,
// eigenstaendige Komponente statt Duplikat in jedem Screen, damit Inhalt/
// Links an EINER Stelle gepflegt werden - wird von allen vier Hauptscreens
// (Statistik/Turniere/Live/Profil) ganz unten eingebunden.
export default function ImprintFooter() {
  const [legalOpen, setLegalOpen] = useState(false);
  return (
    <>
      <footer className="imprint">
        <div className="imprint-title">{t("Impressum")}</div>
        <p>
          Break &amp; Rank · {t("Version")} {APP_VERSION}<br />
          © {new Date().getFullYear()} Break &amp; Rank<br />
          {t("Kontakt")}: <a href="mailto:dalaunge@gmx.at">dalaunge@gmx.at</a><br />
          {t("Diskussion im")} <a href="https://t.me/+vG8sWgH_utJlODRk" target="_blank" rel="noopener noreferrer">Telegram-Kanal</a>
        </p>
        <button className="legal-link" onClick={() => setLegalOpen(true)}>{t("Nutzungsbedingungen & Datenschutzerklärung")}</button>
      </footer>
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
    </>
  );
}
