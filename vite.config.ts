import { dirname, fromFileUrl } from "@std/path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { cloudflare } from "@cloudflare/vite-plugin";

const alias = (path: string) => fromFileUrl(dirname(import.meta.url) + "/" + path);

export default defineConfig({
  plugins: [solid(), cloudflare()],
  resolve: {
    alias: {
      "@": alias("./src"),
      "@frontend": alias("./src/survey"),
      "@worker": alias("./src/worker"),
    },
  },
  server: { port: 3000 },
});
