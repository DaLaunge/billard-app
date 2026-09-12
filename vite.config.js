import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" statt "autoUpdate": Bei "autoUpdate" ruft vite-plugin-pwa's
      // generierter Registrierungscode bei Aktivierung eines neuen Service
      // Workers IMMER sofort window.location.reload() auf (siehe
      // node_modules/vite-plugin-pwa/dist/client/build/react.js) - unsere
      // gesamte Verzoegerungslogik in App.jsx (onNeedRefresh -> erst bei
      // Hintergrund/Bildschirmwechsel reloaden) wird dabei nie erreicht,
      // ganz unabhaengig davon, ob/wie onNeedRefresh benannt ist. "prompt"
      // ruft stattdessen onNeedRefresh() auf und wartet, bis die App selbst
      // updateServiceWorker() aufruft. skipWaiting darf dafuer NICHT gesetzt
      // sein, sonst aktiviert sich der neue Worker von selbst, bevor die App
      // reagieren kann.
      registerType: "prompt",
      injectRegister: false, // Registrierung laeuft manuell ueber useRegisterSW() in App.jsx
      workbox: { clientsClaim: true },
      devOptions: { enabled: true, type: "module" }, // Service Worker auch im `npm run dev` aktiv, zum Testen
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Break & Rank",
        short_name: "BreakRank",
        description: "Das Billard-Ranking eures Vereins",
        theme_color: "#0A2B21",
        background_color: "#071E17",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-mono-192.png", sizes: "192x192", type: "image/png", purpose: "monochrome" },
          { src: "/icon-mono-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
