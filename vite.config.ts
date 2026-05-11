import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      registerType: "prompt",
      includeAssets: [
        "outflow-wordmark.svg",
        "apple-touch-icon.png",
      ],
      manifest: {
        id: "/",
        name: "Outflow",
        short_name: "Outflow",
        description:
          "A calm, local-first spending tracker for mindful manual expense tracking.",
        theme_color: "#0d111a",
        background_color: "#0d111a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ["**/*.{js,css,html,ico,png,webp,json,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  preview: {
    allowedHosts: ["mortally-unless-reentry.ngrok-free.dev"],
  },
});
