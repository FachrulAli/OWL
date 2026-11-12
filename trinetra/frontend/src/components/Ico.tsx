/**
 * Ikon garis 16px, inline SVG.
 *
 * Bukan emoji: emoji dirender berbeda di tiap sistem operasi, tidak mewarisi
 * warna teks, dan terbaca sebagai kata oleh pembaca layar. Ikon di sini
 * dekoratif, jadi diberi aria-hidden dan maknanya selalu ada pada teks di
 * sebelahnya.
 */
export function Ico({ name, className = "doc-ico" }: { name: string; className?: string }) {
  const p: Record<string, JSX.Element> = {
    download: <><path d="M8 2v8m0 0 3-3m-3 3L5 7" /><path d="M2.5 11v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" /></>,
    shield:   <><path d="M8 1.8 13 4v4c0 3-2.2 5.3-5 6.2C5.2 13.3 3 11 3 8V4z" /></>,
    rules:    <><path d="M3 3h10M3 6.5h10M3 10h6M3 13.5h6" /></>,
    link:     <><path d="M6.5 9.5 9.5 6.5" /><path d="M7 4.5 8.6 3a2.8 2.8 0 0 1 4 4l-1.6 1.5" /><path d="M9 11.5 7.4 13a2.8 2.8 0 0 1-4-4L5 7.5" /></>,
    lock:     <><rect x="3.2" y="7" width="9.6" height="6.4" rx="1.3" /><path d="M5.6 7V5a2.4 2.4 0 0 1 4.8 0v2" /></>,
    alert:    <><path d="M8 2.6 14.2 13H1.8z" /><path d="M8 6.6v3M8 11.4v.1" /></>,
    steps:    <><circle cx="4" cy="4" r="1.6" /><circle cx="4" cy="12" r="1.6" /><path d="M4 5.6v4.8M7.4 4H13M7.4 12H13" /></>,
    radar:    <><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.4" /><path d="M8 8 12.2 3.8" /></>,
    device:   <><rect x="4.6" y="1.8" width="6.8" height="12.4" rx="1.6" /><path d="M7 12.4h2" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name] ?? p.shield}
    </svg>
  );
}
