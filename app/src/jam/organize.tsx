// The organizer's pages (organize.html), apart from the creator app: the
// guide with the brief maker, and the gallery builder (#gallery).

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { JamGallery } from "./JamGallery.tsx";
import { JamGuide } from "./JamGuide.tsx";
import "../styles.css";

function Organize() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    document.title = `${hash === "#gallery" ? "Build the jam gallery" : "How to run a jam"} · Cartridge Studio`;
  }, [hash]);
  return hash === "#gallery" ? <JamGallery /> : <JamGuide />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Organize />
  </StrictMode>,
);
