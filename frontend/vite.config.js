import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",   // expose to network (mobile access)
    https: {
      key:  fs.readFileSync(path.resolve("certs/key.pem")),
      cert: fs.readFileSync(path.resolve("certs/cert.pem")),
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
