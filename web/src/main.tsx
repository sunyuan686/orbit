import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ConfirmProvider, ToastProvider } from "./hooks";
import { queryClient } from "./lib/queryClient";
import { globalLogger } from "./lib/logger";
import { initAppearancePreferences } from "./lib/accent";
import "./fonts.css";
import "./index.css";

initAppearancePreferences();

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
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);
