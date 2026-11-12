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

/**
 * Lambang platform (Android, Apple). Terpisah dari Ico karena ini bentuk
 * padat 24px, bukan ikon garis 16px, dan proporsinya tidak boleh diubah.
 */
export function PlatformMark({ name, className = "pf-mark" }: { name: "android" | "apple"; className?: string }) {
  const d = name === "android"
    ? "M17.6 9.48l1.84-3.18a.64.64 0 0 0-.26-.85.64.64 0 0 0-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.64.64 0 0 0-.87-.2.64.64 0 0 0-.22.83L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"
    : "M17.05 12.04c-.03-2.73 2.23-4.04 2.33-4.1-1.27-1.86-3.25-2.11-3.95-2.14-1.68-.17-3.28.99-4.13.99-.85 0-2.16-.97-3.55-.94-1.83.03-3.51 1.06-4.45 2.7-1.9 3.29-.49 8.16 1.36 10.83.9 1.31 1.98 2.78 3.39 2.73 1.36-.06 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.3-2.65 1.04-1.52 1.47-2.99 1.49-3.07-.03-.01-2.86-1.1-2.89-4.35zM14.4 4.1c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.62-.69.8-1.3 2.08-1.14 3.31 1.2.09 2.43-.61 3.18-1.5z";
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
