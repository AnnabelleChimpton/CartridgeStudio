import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { AppStatus } from "./ui/AppStatus.tsx";
import { AboutFooter } from "./ui/About.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <AppStatus />
    <AboutFooter />
  </StrictMode>,
);
