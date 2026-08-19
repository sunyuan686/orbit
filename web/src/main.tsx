import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ConfirmProvider, ToastProvider } from "./hooks";
import { queryClient } from "./lib/queryClient";
import { globalLogger } from "./lib/logger";
import { registerPwaServiceWorker } from "./lib/pwa";
import { initAppearancePreferences } from "./lib/accent";
import "./index.css";

initAppearancePreferences();
registerPwaServiceWorker();

if (import.meta.env.DEV) {
  window.addEventListener("error", (event) => {
    globalLogger.error("Uncaught error", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    globalLogger.error("Unhandled promise rejection", event.reason);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
