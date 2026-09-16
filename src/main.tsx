import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { Provider } from "./components/ui/provider"
import { Toaster } from "./components/ui/toaster"
import { installUpdates } from "./ui/updates"

// The service worker, and with it the check for a newer build while the rack stays open.
installUpdates()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider>
      <App />
      <Toaster />
    </Provider>
  </StrictMode>,
)
