import { Entity } from "../lib/api";
import {
  riskColor, sevClass, fmtTime, silenceL, holderLabel,
  platformIcon, patchRisk, labels,
} from "../lib/util";
import { useLang } from "../lib/lang";
import { DOC } from "../lib/docText";

/**
 * Daftar HP dinas berisiko tertinggi.
 *
 * Tiap baris menjawab tiga pertanyaan yang berbeda dan sama pentingnya:
 *   1. SIAPA yang harus dihubungi   → pangkat + nama pemegang
 *   2. PERANGKAT APA yang ditangani → model, OS, umur patch
 *   3. SEBERAPA MENDESAK            → skor risiko + status
 *
 * Yang sengaja TIDAK ditampilkan di sini: jumlah signal, kategori, ASN, dan
 * rincian teknis lain. Semua itu ada di panel perangkat saat baris diklik.
 * Tabel ini untuk memutuskan "tangani yang mana dulu", bukan untuk
 * menginvestigasi. Menaruh semuanya di sini justru memperlambat keputusan.
 */
export function EntityTable(
  { entities, onSelect }: { entities: Entity[]; onSelect: (id: string) => void },
) {
  const [lang] = useLang();
  const t = DOC(lang).con;
  const L = labels(lang);
  const top = entities.slice(0, 12);
  return (
    <div className="panel">
      <h2>
        {t.tableH}
        <span className="muted" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
          {t.tableSub}
        </span>
      </h2>
      <table className="dev-table">
        <thead>
          <tr>
            {t.cols.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {top.map((e) => {
            const h = holderLabel(e);
            const sil = silenceL(e.last_seen ?? e.last_event, lang);
            const patch = typeof e.patch_age_days === "number" && e.patch_age_days > 0
              ? patchRisk(e.patch_age_days) : null;
            return (
              <tr key={e.entity_id} onClick={() => onSelect(e.entity_id)}>
                <td>
                  {/* Pangkat dan nama satu baris: "prajurit siapa" harus
                      terjawab tanpa mata berpindah baris. */}
                  <div className="dev-holder">
                    {h.rank && <span className="dev-rank">{h.rank}</span>}
                    {h.name}
                  </div>
                  <div className="dev-sub">
                    <span className="muted">{L.role[e.role] ?? e.role}</span>
                    {e.holder_nrp && <span className="mono">NRP {e.holder_nrp}</span>}
                  </div>
                </td>
                <td>
                  <div className="dev-model">
                    {e.device_model || "—"}
                    {e.live_agent && (
                      <span className="dev-tag live" title={t.liveAgentTip}>
                        AGENT NYATA
                      </span>
                    )}
                  </div>
                  <div className="dev-sub">
                    {e.platform && (
                      <span className={`dev-tag ${e.platform === "ios" ? "ios" : "and"}`}>
                        {platformIcon(e.platform)} {e.os_version}
                      </span>
                    )}
                    {patch && (
                      <span className="dev-tag" style={{ color: patch.color }}
                        title={t.patchTip}>
                        patch {e.patch_age_days}h
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div>{(e.node_name ?? e.node_id).replace(/^Kodam\s*/i, "")}</div>
                  <div className="dev-sub muted">{e.node_id}</div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="riskbar">
                      <span style={{ width: `${e.risk_score}%`, background: riskColor(e.risk_score) }} />
                    </div>
                    <b style={{ color: riskColor(e.risk_score) }}>{e.risk_score.toFixed(0)}</b>
                  </div>
                </td>
                <td><span className={sevClass(e.severity)}>{e.severity}</span></td>
                <td>
                  <div className="muted">{fmtTime(e.last_seen ?? e.last_event)}</div>
                  {sil.stale && (
                    <div className="dev-silent"
                      title={t.silentTip}>
                      {sil.label}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {top.length === 0 && (
            <tr><td colSpan={6} className="muted">{t.tableWait}</td></tr>
          )}
        </tbody>
      </table>
      <div className="dev-foot muted" dangerouslySetInnerHTML={{ __html: t.tableFoot }} />
    </div>
  );
}
