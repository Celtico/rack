import { execSync } from "node:child_process"

import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"

/** A number that only goes up: the count of commits on the branch, read from git at build time. */
function gitVersion(): { version: string; commit: string } {
  const run = (cmd: string) =>
    execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  try {
    return { version: run("git rev-list --count HEAD"), commit: run("git rev-parse --short HEAD") }
  } catch {
    // No git (a build without the repository): whatever the environment says, or "dev".
    return { version: process.env.RACK_VERSION ?? "dev", commit: process.env.RACK_COMMIT ?? "" }
  }
}
const { version, commit } = gitVersion()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __RACK_VERSION__: JSON.stringify(version),
    __RACK_COMMIT__: JSON.stringify(commit),
  },
  // The encoding worker (`src/audio/encodeWorker.ts`) loads the MP3 encoder on demand, and a
  // worker that splits code has to be an ES module.
  worker: { format: "es" },
  plugins: [
    react(),
    // Installable, works offline: the app shell is precached; songs, samples and MIDI are
    // cached as they are fetched, so a phone with no signal still has its rack.
    VitePWA({
      registerType: "autoUpdate",
      // Registered from `src/ui/updates.ts` (hourly update checks, a reload that waits for the clock
      // to stop), not by an injected script.
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "RACK",
        short_name: "RACK",
        // Not a standard manifest field — browsers ignore it — but it tells anyone reading the
        // manifest (devtools, a curious user) which build is installed.
        ...({ version, commit } as object),
        description: "A web audio rack: drum machine, synths, sampler and step sequencer.",
        theme_color: "#111214",
        // Android paints its launch screen with this, the icon and the name: white with the logo,
        // like the iOS launch screens in `public/splash/`.
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"],
        // The launch screens are the OS's to fetch at install time, one of forty — not for the precache.
        globIgnores: ["songs/**", "samples/**", "midi/**", "splash/**"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /^\/(songs|samples|midi)\//.test(url.pathname) || url.pathname === "/-rack-song.json",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "rack-content", expiration: { maxEntries: 80 } },
          },
        ],
      },
    }),
  ],
  server: {
    // Listen on the LAN too, so a phone on the same Wi-Fi can open the dev server.
    host: true,
  },
  build: {
    // The capture worklet (`src/audio/capture.worklet.js`, reached through `new URL`) must stay a
    // file of its own: `audioWorklet.addModule` wants a URL, and not every browser takes a data: one.
    assetsInlineLimit: (file) => (file.endsWith(".worklet.js") ? false : undefined),
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
