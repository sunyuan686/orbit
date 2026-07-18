import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ConfirmProvider } from "./lib/useConfirm";
import { ToastProvider } from "./lib/useToast";
import { globalLogger } from "./lib/logger";
import { registerPwaServiceWorker } from "./lib/pwa";
import "./index.css";

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
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
