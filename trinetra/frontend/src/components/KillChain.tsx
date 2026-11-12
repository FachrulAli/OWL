import { ChainHit } from "../lib/api";
import { RESPONSE_HINT, fmtSpan, fmtTime, riskColor, labels } from "../lib/util";
import { useLang } from "../lib/lang";
import { DOC } from "../lib/docText";

// Warna per tahap kill-chain: dingin di awal rantai, memanas ke arah
// pengumpulan data, supaya mata langsung menangkap seberapa jauh penyerang
// sudah berjalan.
const STAGE_COLOR: Record<string, string> = {
  posture: "#6b7280", delivery: "#3b82f6", exploit: "#8b5cf6",
  install: "#6366f1", privilege: "#a855f7", persistence: "#d946ef",
  implant: "#e8732c", tampering: "#f59e0b", mitm: "#f97316",
  c2: "#e2424a", collection: "#dc2626", radio: "#14b8a6",
};

const stageColor = (s: string) => STAGE_COLOR[s] ?? "#8b5cf6";

/**
 * Timeline satu rantai kill-chain yang terbukti.
 *
 * Inilah bukti yang dibawa TRINETRA ke meja analis: bukan "ada anomali", tapi
 * urutan tahap yang spesifik, pada satu perangkat, dengan jarak waktu nyata
 * antar tahap, seluruhnya terjadi saat pemiliknya tidak menyentuh HP.
 */
export function KillChainTimeline(
  { hit, compact = false }: { hit: ChainHit; compact?: boolean },
) {
  const [lang] = useLang();
  const t = DOC(lang).con;
  const L = labels(lang);
  const members = hit.members ?? [];

  return (
    <div className="kc">
      <div className="kc-head">
        <div className="kc-title">
          <span className="kc-badge" data-type={hit.corr_type}>
            {hit.corr_type === "temporal_ordered" ? t.kcOrdered
              : hit.corr_type === "event_count" ? t.kcRepeated : t.kcCo}
          </span>
          <b>{hit.title}</b>
        </div>
        <div className="kc-sev" style={{ color: riskColor(hit.severity) }}>
          {hit.severity.toFixed(0)}
        </div>
      </div>

      <div className="kc-meta">
        <span className="mono">{hit.corr_id}</span>
        <span>·</span>
        <span>{L.cat[hit.category] ?? hit.category}</span>
        <span>·</span>
        {/* Rentang nyata vs jendela aturan: kalau rantai jauh lebih rapat
            daripada jendela yang diizinkan, itu justru memperkuat temuan. */}
        <span>
          {t.kcSpan} {fmtSpan(hit.span_s)} {t.kcWindow} {fmtSpan(hit.timespan_s)}
        </span>
        {hit.display_name && (<><span>·</span><span>{hit.display_name}</span></>)}
        <span>·</span>
        <span className="mono">{hit.node_id}</span>
      </div>

      <ol className="kc-steps">
        {members.map((m, i) => {
          const ts = new Date(m.ts).getTime();
          const gap = i === 0 ? 0 : Math.round((ts - new Date(members[i - 1].ts).getTime()) / 1000);
          const c = stageColor(m.stage);
          return (
            <li key={`${m.event_id}-${i}`} style={{ ["--c" as any]: c }}>
              <span className="kc-dot" />
              <div className="kc-step-body">
                <div className="kc-step-top">
                  <span className="kc-stage" style={{ color: c }}>
                    {String(i + 1).padStart(2, "0")} · {L.stage[m.stage] ?? m.stage}
                  </span>
                  <span className="kc-time mono">{fmtTime(m.ts)}</span>
                </div>
                <div className="kc-rule mono">{m.rule}</div>
                {i > 0 && (
                  <div className="kc-gap">+{gap}s {t.kcAfter}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!compact && (
        <>
          <div className="kc-idle" dangerouslySetInnerHTML={{ __html: t.kcIdle }} />

          <div className="kc-resp">
            <div className="kc-resp-h">
              {t.kcAction}: <b>{L.response[hit.response] ?? hit.response}</b>
            </div>
            <div className="kc-resp-b">{RESPONSE_HINT[hit.response] ?? ""}</div>
          </div>

          {hit.mitre?.length > 0 && (
            <div className="kc-mitre">
              {hit.mitre.map((t) => (
                <span className="cat-chip" key={t} title="MITRE ATT&CK Mobile">
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Daftar rantai terbukti; klik untuk membuka perangkatnya. */
export function ChainList(
  { chains, onSelect, limit = 8 }:
  { chains: ChainHit[]; onSelect?: (id: string) => void; limit?: number },
) {
  const [lang] = useLang();
  const t = DOC(lang).con;
  const L = labels(lang);
  const items = chains.slice(0, limit);
  return (
    <div className="panel">
      <h2>
        {t.chainsH}
        <span className="muted" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
          {t.chainsSub}
        </span>
      </h2>
      <div className="scroll">
        {items.map((h, i) => (
          <div
            key={`${h.entity_id}-${h.ts}-${i}`}
            className="kc-card"
            onClick={() => onSelect?.(h.entity_id)}
            style={{ cursor: onSelect ? "pointer" : "default" }}>
            <KillChainTimeline hit={h} compact />
            <div className="kc-card-foot">
              <span className="cat-chip">{L.response[h.response] ?? h.response}</span>
              {h.mitre?.slice(0, 3).map((t) => (
                <span className="cat-chip" key={t}>{t}</span>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="muted">{t.chainsEmpty}</div>
        )}
      </div>
    </div>
  );
}
