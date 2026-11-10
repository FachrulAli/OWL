import { useEffect, useState } from "react";
import Landing from "./Landing";
import Console from "./Console";
import Structure from "./Structure";
import { Preloader } from "./Preloader";

// Minimal hash router: #/console → command console, #/struktur → TNI AD
// organisation reference, everything else → the product landing page.
function routeFromHash(): "console" | "struktur" | "landing" {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h === "console") return "console";
  if (h === "struktur") return "struktur";
  return "landing";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash());
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // branded boot sequence (~4.2s) on every full page load
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 4200);
    return () => clearTimeout(t);
  }, []);

  const go = (hash: string) => { window.location.hash = hash; window.scrollTo({ top: 0 }); };

  let page;
  if (route === "console") page = <Console onExit={() => go("")} />;
  else if (route === "struktur") page = <Structure onExit={() => go("")} onConsole={() => go("/console")} />;
  else page = <Landing onEnter={() => go("/console")} onStructure={() => go("/struktur")} />;

  return (
    <>
      {booting && <Preloader />}
      {page}
      {/* smooth slider-style wipe on every route change */}
      <span className="route-wipe" key={route} aria-hidden="true" />
    </>
  );
}
