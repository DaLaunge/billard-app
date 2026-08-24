import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false, // Registrierung laeuft manuell ueber useRegisterSW() in App.jsx
      workbox: { skipWaiting: true, clientsClaim: true },
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
        ],
      },
    }),
  ],
});
