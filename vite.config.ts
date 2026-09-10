import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Split the big, rarely-changing vendors into their own chunks so a
        // change to app code doesn't invalidate the Tone.js or Chakra bundles.
        codeSplitting: {
          groups: [
            { name: "tone", test: /node_modules[\\/]tone[\\/]/, priority: 30 },
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: "chakra",
              test: /node_modules[\\/](@chakra-ui|@emotion|@zag-js|@ark-ui|next-themes)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
})
