import { useEffect, useState } from "react";

// Branded boot sequence: a scanning "third eye", wordmark, a filling progress
// bar and cycling status lines. Shown once per session (~4.2s), then fades out.
const STEPS = [
  "MENGHIDUPKAN KERNEL",
  "MEMUAT BASELINE PERILAKU",
  "SINKRONISASI 22 NODE KOMANDO",
  "KALIBRASI MESIN UEBA",
  "SISTEM SIAP",
];

export function Preloader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(v + 1, STEPS.length - 1)), 760);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="preloader" role="status" aria-label="Memuat TRINETRA">
      <div className="pl-core">
        <div className="pl-eye" aria-hidden="true">
          <span className="pl-ring" />
          <span className="pl-ring pl-ring2" />
          <span className="pl-scan" />
          <span className="pl-pupil" />
        </div>
        <div className="pl-word">TRINETRA</div>
        <div className="pl-sub">{STEPS[i]}</div>
        <div className="pl-bar" aria-hidden="true"><i /></div>
        <div className="pl-tag">INSIDER THREAT INTELLIGENCE · PUSSIBERAD</div>
      </div>
    </div>
  );
}
