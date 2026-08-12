import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [solid(), cloudflare()],
  server: {
    port: 3000,

    // For use with `vite dev`
    proxy: {
      "/api": {
        target: "https://localhost:8787",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
