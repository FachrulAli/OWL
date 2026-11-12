import { useEffect, useState } from "react";
import Landing from "./Landing";
import Console from "./Console";
import Structure from "./Structure";
import Deteksi from "./Deteksi";
import { Preloader } from "./Preloader";

// Minimal hash router: #/console → command console, #/struktur → TNI AD
// organisation reference, #/deteksi → katalog aturan deteksi (transparansi),
// everything else → the product landing page.
function routeFromHash(): "console" | "struktur" | "deteksi" | "landing" {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h === "console") return "console";
  if (h === "struktur") return "struktur";
  if (h === "deteksi") return "deteksi";
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

  // Boot sequence bermerek (~4.2s) pada setiap muat halaman penuh.
  // `?nointro` melewatinya: untuk rekaman video 60 detik, 4,2 detik adalah
  // 7% durasi yang tidak membawa informasi apa pun.
  useEffect(() => {
    const skip = typeof window !== "undefined"
      && (window.location.search.includes("nointro")
        || window.location.hash.includes("nointro"));
    if (skip) { setBooting(false); return; }
    const t = setTimeout(() => setBooting(false), 4200);
    return () => clearTimeout(t);
  }, []);

  const go = (hash: string) => { window.location.hash = hash; window.scrollTo({ top: 0 }); };

  let page;
  if (route === "console") page = <Console onExit={() => go("")} />;
  else if (route === "struktur") page = <Structure onExit={() => go("")} onConsole={() => go("/console")} />;
  else if (route === "deteksi") page = <Deteksi onExit={() => go("")} onConsole={() => go("/console")} />;
  else page = <Landing onEnter={() => go("/console")} onStructure={() => go("/struktur")}
    onRules={() => go("/deteksi")} />;

  return (
    <>
      {booting && <Preloader />}
      {page}
      {/* smooth slider-style wipe on every route change */}
      <span className="route-wipe" key={route} aria-hidden="true" />
    </>
  );
}
