import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const dashboardRoot = fileURLToPath(new URL(".", import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  root: dashboardRoot,
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Set to false to only show localhost, or keep true for network access
    strictPort: true, // Fail if port is already in use
  },
});
