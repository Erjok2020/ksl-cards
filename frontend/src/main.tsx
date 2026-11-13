import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

// Service worker for offline use (app shell + downloaded modules).
if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
