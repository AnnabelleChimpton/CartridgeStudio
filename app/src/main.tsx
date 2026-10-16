import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

// The jam organizer's pages (?jam-guide, ?jam-gallery) stand on their own.
const params = new URLSearchParams(location.search);
const Page = params.has("jam-gallery")
  ? lazy(() => import("./jam/JamGallery.tsx").then((m) => ({ default: m.JamGallery })))
  : params.has("jam-guide")
    ? lazy(() => import("./jam/JamGuide.tsx").then((m) => ({ default: m.JamGuide })))
    : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div className="page loading">Loading…</div>}>
      <Page />
    </Suspense>
  </StrictMode>,
);
