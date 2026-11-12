import { useEffect, useState } from "react";

export type Lang = "en" | "id";

const KEY = "trinetra_lang";

export function getLang(): Lang {
  try { return (localStorage.getItem(KEY) as Lang) || "en"; } catch { return "en"; }
}

export function applyDocLang(l: Lang) {
  // Pemenggalan kata otomatis hanya jalan bila peramban tahu bahasanya.
  try { document.documentElement.lang = l === "id" ? "id" : "en"; } catch { /* SSR */ }
}

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* storage dimatikan */ }
  applyDocLang(l);
  // Beranda dan halaman lain hidup di dokumen yang sama, jadi perubahan
  // bahasa disiarkan lewat event agar semuanya ikut berubah tanpa reload.
  window.dispatchEvent(new CustomEvent("trinetra:lang", { detail: l }));
}

/**
 * Bahasa aktif, dibagi ke seluruh halaman.
 *
 * Sebelumnya hanya beranda dan halaman struktur yang membaca pilihan bahasa,
 * sementara console dan halaman dokumen ditulis tetap dalam bahasa Indonesia.
 * Akibatnya pengguna yang memilih English tetap menemui antarmuka berbahasa
 * Indonesia begitu masuk console, dan pilihan bahasanya terasa tidak bekerja.
 */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setL] = useState<Lang>(getLang);
  useEffect(() => { applyDocLang(lang); }, [lang]);
  useEffect(() => {
    const onLang = (e: Event) => setL((e as CustomEvent).detail as Lang);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setL(e.newValue as Lang);
    };
    window.addEventListener("trinetra:lang", onLang);
    window.addEventListener("storage", onStorage);   // tab lain
    return () => {
      window.removeEventListener("trinetra:lang", onLang);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return [lang, (l: Lang) => { setLang(l); setL(l); }];
}

/** Pilih satu dari pasangan teks sesuai bahasa aktif. */
export function pick<T>(lang: Lang, en: T, id: T): T {
  return lang === "id" ? id : en;
}
