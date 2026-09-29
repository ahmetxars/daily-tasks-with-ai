import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * This app is currently a client-only personal habit/task tracker.
 * Keeping deployment static avoids a Nitro/Vercel SSR runtime bundling bug
 * while preserving the existing React UI and localStorage data model.
 */
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), viteReact()],
});
