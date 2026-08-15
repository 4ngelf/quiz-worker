import { dirname, fromFileUrl } from "@std/path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { cloudflare } from "@cloudflare/vite-plugin";

const pathAlias = (path: string) => fromFileUrl(dirname(import.meta.url) + "/" + path);

export default defineConfig({
  plugins: [solid(), cloudflare()],
  resolve: {
    alias: {
      "@": pathAlias("./src"),
      "@frontend": pathAlias("./src/survey"),
      "@worker": pathAlias("./src/worker"),
    },
  },
  server: { port: 3000 },
});
