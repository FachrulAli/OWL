import { useEffect, useState } from "react";
import Landing from "./Landing";
import Console from "./Console";

// Minimal hash router: #/console shows the command console, everything else
// shows the product landing page. Keeps the SPA dependency-free.
function routeFromHash() {
  return window.location.hash.replace(/^#\/?/, "") === "console" ? "console" : "landing";
}

export default function App() {
  const [route, setRoute] = useState<string>(routeFromHash());

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goConsole = () => {
    window.location.hash = "/console";
    window.scrollTo({ top: 0 });
  };
  const goHome = () => {
    window.location.hash = "";
    window.scrollTo({ top: 0 });
  };

  return route === "console" ? <Console onExit={goHome} /> : <Landing onEnter={goConsole} />;
}
