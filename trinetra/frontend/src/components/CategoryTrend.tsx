import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { CAT_LABEL } from "../lib/util";

// Alert volume per anomaly category over time.
export function CategoryTrend({ rows }: { rows: any[] }) {
  // pivot: bucket -> {category: count}
  const buckets = new Map<string, any>();
  const cats = new Set<string>();
  for (const r of rows) {
    cats.add(r.category);
    const b = buckets.get(r.bucket) ?? { bucket: r.bucket };
    b[r.category] = r.count;
    buckets.set(r.bucket, b);
  }
  const data = Array.from(buckets.values()).map((b) => ({
    ...b,
    t: new Date(b.bucket).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  }));
  const colors = ["#ff4d57", "#f0883c", "#e3b23a", "#1fe08f", "#4f8cff", "#a779ff", "#2fb36a", "#35d0ba"];
  const catList = Array.from(cats);

  return (
    <div className="panel">
      <h2>Tren Deteksi per Kategori (6 jam)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <CartesianGrid stroke="#182435" strokeDasharray="3 3" />
          <XAxis dataKey="t" stroke="#8698b0" fontSize={11} />
          <YAxis stroke="#8698b0" fontSize={11} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#0e1621", border: "1px solid #22364d", borderRadius: 8 }}
                   labelStyle={{ color: "#e8eef6" }} />
          {catList.map((c, i) => (
            <Area key={c} type="monotone" dataKey={c} name={CAT_LABEL[c] ?? c}
                  stackId="1" stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length] + "55"} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {data.length === 0 && <div className="muted">Belum ada alert pada rentang ini.</div>}
    </div>
  );
}
