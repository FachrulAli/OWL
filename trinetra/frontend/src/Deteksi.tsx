import { useEffect, useMemo, useState } from "react";
import { api, SigmaCatalog, SigmaRule, IndicatorStatus } from "./lib/api";
import {
  CAT_LABEL, STAGE_LABEL, RESPONSE_LABEL, fmtSpan, riskColor,
} from "./lib/util";

/**
 * Halaman "Deteksi sebagai Kode".
 *
 * Alasan halaman ini ada: aturan deteksi yang hanya hidup di dalam kode tidak
 * bisa diaudit oleh orang yang harus mempercayainya. Di sini setiap aturan
 * ditampilkan apa adanya: kondisinya, bobotnya, false positive yang diakui,
 * dan aturan atomik mana yang menyusun setiap rantai. Siapa pun bisa menilai
 * apakah logikanya masuk akal, tanpa membaca Python.
 */
export default function Deteksi(
  { onExit, onConsole }: { onExit: () => void; onConsole: () => void },
) {
  const [cat, setCat] = useState<SigmaCatalog | null>(null);
  const [ioc, setIoc] = useState<IndicatorStatus | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.sigma().then(setCat).catch(() => {});
    api.indicators().then(setIoc).catch(() => {});
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, SigmaRule>();
    cat?.atomic.forEach((r) => m.set(r.id, r));
    return m;
  }, [cat]);

  const corrSorted = useMemo(
    () => (cat?.correlation ?? []).slice().sort((a, b) => b.severity - a.severity),
    [cat]);
  const atomSorted = useMemo(
    () => (cat?.atomic ?? []).slice().sort((a, b) => b.severity - a.severity),
    [cat]);

  return (
    <div className="doc">
      <div className="doc-top">
        <button className="pg-nav" onClick={onExit}><span className="ix">←</span> Beranda</button>
        <button className="pg-nav" onClick={onConsole}>Buka console <span className="ix">→</span></button>
      </div>

      <header className="doc-head">
        <div className="doc-kicker">Transparansi · deteksi sebagai kode</div>
        <h1>Aturan yang dipakai TRINETRA</h1>
        <p className="doc-lede">
          Seluruh logika deteksi ditulis dalam <b>format Sigma</b>, standar
          terbuka untuk aturan deteksi yang spesifikasinya berstatus domain
          publik.
          Artinya aturan di bawah bukan kotak hitam: bisa dibaca, dikritik,
          diperbaiki, dan dibagikan antar satuan sebagai berkas teks biasa.
        </p>
        <div className="doc-note">
          <b>Prinsip yang menentukan semua angka di halaman ini:</b> aturan
          atomik sengaja diberi bobot <b>rendah</b>, 8 sampai 45, karena satu
          indikator perilaku di HP selalu ambigu. Tuduhan hanya lahir dari
          <b> correlation rule</b> dengan bobot 30 sampai 85, yang menuntut
          beberapa aturan menyala <b>berurutan</b> pada satu perangkat dalam
          jendela waktu pendek. Detektor yang menuduh dari satu indikator akan
          menghasilkan alarm palsu setiap hari, dan operator berhenti
          membukanya dalam hitungan minggu.
        </div>
      </header>

      {/* ───────── correlation rules ───────── */}
      <section className="doc-sec">
        <h2>
          Correlation rule
          <span className="doc-count">{corrSorted.length}</span>
        </h2>
        <p className="doc-sub">
          Di sinilah zero-click sebenarnya ditangkap. <code>temporal_ordered</code>{" "}
          berarti aturan-aturan harus menyala <b>dalam urutan tertentu</b> di
          dalam satu rentang waktu; <code>event_count</code> menuntut satu
          aturan berulang; <code>temporal</code> hanya menuntut bersamaan.
        </p>

        <div className="doc-grid">
          {corrSorted.map((c) => (
            <article key={c.id} className="doc-card">
              <div className="doc-card-h">
                <span className="corr-badge" data-type={c.type}>
                  {c.type === "temporal_ordered" ? "BERURUTAN"
                    : c.type === "event_count" ? "BERULANG" : "BERSAMAAN"}
                </span>
                <span className="doc-sev" style={{ color: riskColor(c.severity) }}>
                  {c.severity}
                </span>
              </div>
              <h3>{c.title}</h3>
              <div className="doc-id">{c.id}</div>
              <p className="doc-desc">{c.description}</p>

              {/* rantai aturan penyusun; klik untuk melihat aturan atomiknya */}
              <div className="doc-chain">
                {(c.rules ?? []).map((rid, i) => {
                  const r = byId.get(rid);
                  return (
                    <span key={`${rid}-${i}`} className="doc-link-wrap">
                      {i > 0 && (
                        <span className="doc-arrow">
                          {c.type === "temporal_ordered" ? "→" : "+"}
                        </span>
                      )}
                      <button
                        className="rule-chip"
                        aria-expanded={open === rid}
                        onClick={() => setOpen(open === rid ? null : rid)}
                        title={r?.title ?? rid}>
                        {r?.stage ? (STAGE_LABEL[r.stage] ?? r.stage) : rid}
                      </button>
                    </span>
                  );
                })}
              </div>

              <div className="doc-facts">
                <span>jendela <b>{fmtSpan(c.timespan_s ?? 0)}</b></span>
                {c.type === "event_count" && (
                  <span>minimal <b>{c.count_gte}×</b></span>
                )}
                <span>dikelompokkan per <b>{(c.group_by ?? []).join(", ")}</b></span>
                <span>→ <b>{RESPONSE_LABEL[c.response ?? ""] ?? c.response}</b></span>
              </div>

              <div className="doc-tags">
                <span className="cat-chip">{CAT_LABEL[c.category] ?? c.category}</span>
                {(c.mitre ?? []).map((t) => (
                  <span className="cat-chip" key={t}>{t}</span>
                ))}
              </div>

              {/* rincian aturan atomik yang sedang dibuka */}
              {(c.rules ?? []).includes(open ?? "") && byId.get(open!) && (
                <AtomicDetail rule={byId.get(open!)!} />
              )}
            </article>
          ))}
          {corrSorted.length === 0 && (
            <div className="muted">Memuat katalog aturan…</div>
          )}
        </div>
      </section>

      {/* ───────── atomic rules ───────── */}
      <section className="doc-sec">
        <h2>
          Aturan atomik
          <span className="doc-count">{atomSorted.length}</span>
        </h2>
        <p className="doc-sub">
          Masing-masing mengamati <b>satu</b> perilaku. Kolom “diakui bisa
          salah” bukan kelemahan yang disembunyikan. Kolom itu bagian wajib dari
          sebuah aturan Sigma, dan justru menjelaskan mengapa aturan ini tidak
          boleh dipakai sendirian.
        </p>

        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Aturan</th>
                <th>Tahap</th>
                <th>Bobot</th>
                <th>Field yang dibaca</th>
                <th>Diakui bisa salah karena</th>
              </tr>
            </thead>
            <tbody>
              {atomSorted.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.title}</b>
                    <div className="doc-id">{r.id}</div>
                  </td>
                  <td className="muted">
                    {r.stage ? (STAGE_LABEL[r.stage] ?? r.stage) : "—"}
                  </td>
                  <td>
                    <b style={{ color: riskColor(r.severity * 1.6) }}>{r.severity}</b>
                  </td>
                  <td>
                    {(r.fields ?? []).map((f) => (
                      <span className="field-chip" key={f}>{f}</span>
                    ))}
                  </td>
                  <td className="doc-fp-cell">
                    {(r.falsepositives ?? []).length
                      ? (r.falsepositives ?? []).join("; ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────── lapisan intel ───────── */}
      <section className="doc-sec">
        <h2>Lapisan intel: indikator publik</h2>
        {ioc ? (
          <>
            <p className="doc-sub">
              <b>{ioc.indicators.toLocaleString("id-ID")}</b> indikator dari{" "}
              <b>{ioc.campaigns.length}</b> kampanye spyware yang
              dipublikasikan. Lapisan ini hanya mengenali infrastruktur yang
              <b> sudah diketahui</b>; tugas mengenali yang belum dikenal ada
              pada aturan perilaku di atas.
            </p>
            <div className="doc-tags">
              {ioc.campaigns.map((c) => (
                <span className="cat-chip" key={c}>{c}</span>
              ))}
            </div>
            <div className="doc-facts" style={{ marginTop: 10 }}>
              {Object.entries(ioc.tables).map(([k, v]) => (
                <span key={k}>{k} <b>{v}</b></span>
              ))}
            </div>
            <div className="doc-sources">
              {ioc.sources.map((s) => (
                <div key={s.name}>
                  <b className="mono">{s.name}</b>, lisensi {s.license}
                </div>
              ))}
            </div>
            <div className="doc-note" style={{ marginTop: 12 }}>
              {ioc.catatan}
            </div>
          </>
        ) : <div className="muted">Memuat status indikator…</div>}
      </section>

      <footer className="doc-foot">
        <div>
          Format: {cat?.format ?? "Sigma specification v2"}
        </div>
        <div className="muted">{cat?.note ?? ""}</div>
        <div className="muted" style={{ marginTop: 8 }}>
          Aturan dalam repositori:{" "}
          <span className="mono">
            services/backend/app/rules/sigma/mobile_atomic.yml
          </span>{" "}
          dan{" "}
          <span className="mono">mobile_correlation.yml</span>. Aturan SigmaHQ
          publik berlisensi DRL 1.1 yang mewajibkan atribusi penulis; seluruh
          aturan di halaman ini ditulis untuk TRINETRA.
        </div>
      </footer>
    </div>
  );
}

/** Rincian satu aturan atomik, dibuka dari rantai correlation rule. */
function AtomicDetail({ rule }: { rule: SigmaRule }) {
  return (
    <div className="doc-detail">
      <div className="doc-detail-h">
        <b>{rule.title}</b>
        <span className="mono">bobot {rule.severity}</span>
      </div>
      <p>{rule.description}</p>
      {rule.condition && (
        <div className="doc-cond">condition: {rule.condition}</div>
      )}
      <div className="doc-facts">
        {(rule.fields ?? []).map((f) => (
          <span className="field-chip" key={f}>{f}</span>
        ))}
      </div>
      {(rule.falsepositives ?? []).length > 0 && (
        <div className="doc-fp">
          <b>Bisa salah karena:</b> {(rule.falsepositives ?? []).join("; ")}
        </div>
      )}
    </div>
  );
}
