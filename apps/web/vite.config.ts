import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Prompt: tampilkan notifikasi "versi baru" lalu user menekan Muat ulang.
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Catat — Pencatatan Usaha",
        short_name: "Catat",
        description: "Catat uang masuk/keluar, piutang, hutang untuk semua lini usaha.",
        theme_color: "#0f766e",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        // Memakai ikon SVG agar tidak butuh aset PNG. Bisa diganti PNG nanti.
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache app-shell agar bisa dibuka offline. API tidak di-cache (data via Dexie).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
