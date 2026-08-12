import { defineConfig } from "vite";

const isCloudflarePages = process.env.CF_PAGES === "1";

export default defineConfig({
  base: isCloudflarePages ? "/" : "/plain-act/chess-opening-trainer/"
});
