import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GroveApp } from "@/components/grove/grove-app";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <GroveApp />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}
