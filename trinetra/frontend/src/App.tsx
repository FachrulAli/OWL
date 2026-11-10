import { useEffect, useState } from "react";
import Landing from "./Landing";
import Console from "./Console";
import Structure from "./Structure";

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

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (hash: string) => { window.location.hash = hash; window.scrollTo({ top: 0 }); };

  if (route === "console") return <Console onExit={() => go("")} />;
  if (route === "struktur") return <Structure onExit={() => go("")} onConsole={() => go("/console")} />;
  return <Landing onEnter={() => go("/console")} onStructure={() => go("/struktur")} />;
}
