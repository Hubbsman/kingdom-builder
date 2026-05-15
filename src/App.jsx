import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://kkmkfkcrpotenbjeluga.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbWtma2NycG90ZW5iamVsdWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODQ3NDcsImV4cCI6MjA5NDM2MDc0N30._XIeH9pIGlsdL1j2D_wrQkJF-w01P7Mfq1ED4kOiN4M"
);

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ts is stored as ISO when we write it; old entries used locale strings — fall back to created_at
const entryDate = (e) => { const t = new Date(e.ts); return isNaN(t) ? new Date(e.created_at) : t; };

function monotonicPath(pts) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;

  const slopes = [];
  for (let i = 0; i < n - 1; i++)
    slopes.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));

  const t = [slopes[0]];
  for (let i = 1; i < n - 1; i++)
    t.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  t.push(slopes[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-9) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / slopes[i], b = t[i + 1] / slopes[i], sq = a * a + b * b;
    if (sq > 9) { const s = 3 / Math.sqrt(sq); t[i] = s * a * slopes[i]; t[i + 1] = s * b * slopes[i]; }
  }

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    d += ` C${pts[i].x + h / 3},${pts[i].y + (t[i] * h) / 3}` +
         ` ${pts[i + 1].x - h / 3},${pts[i + 1].y - (t[i + 1] * h) / 3}` +
         ` ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function WeeklyChart({ entries, now, selectedDay, onSelectDay }) {
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);

  // Daily NET change per day (not cumulative) so Monday with no entries shows $0
  const balances = days.map((_, i) => {
    if (i > dow) return null;
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(weekStart);
    dayEnd.setDate(weekStart.getDate() + i);
    dayEnd.setHours(23, 59, 59, 999);
    return entries
      .filter((e) => {
        const t = entryDate(e);
        return t >= dayStart && t <= dayEnd;
      })
      .reduce((sum, e) => sum + Number(e.change), 0);
  });

  const validVals = balances.filter((v) => v !== null);
  if (validVals.length === 0) return null;

  const W = 300, H = 90;
  const padLeft = 42, padRight = 8, padTop = 8, padBot = 6;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBot;

  // Always anchor 0 so positive/negative is clear
  const minVal = Math.min(...validVals, 0);
  const maxVal = Math.max(...validVals, 0);
  // If all values identical, spread artificially so chart isn't flat
  const range = maxVal - minVal || Math.max(Math.abs(maxVal), 10) * 2;

  const toY = (v) => padTop + innerH - ((v - minVal) / range) * innerH;
  const toX = (i) => padLeft + (i / 6) * innerW;

  const pts = balances
    .map((v, i) => (v !== null ? { x: toX(i), y: toY(v), v, i } : null))
    .filter(Boolean);

  const linePath = monotonicPath(pts);
  const areaPath = linePath
    ? `${linePath} L${pts[pts.length - 1].x},${zeroY} L${pts[0].x},${zeroY} Z`
    : "";

  const zeroY = toY(0);
  const selectedDow = selectedDay ? selectedDay.getDay() : null;

  const fmtShort = (v) => {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${Math.round(v)}`;
  };

  const handleTap = (i) => {
    if (i > dow) return;
    if (selectedDow === i) { onSelectDay(null); return; }
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    onSelectDay(d);
  };

  return (
    <div style={{ width: "100%", marginTop: 10, marginBottom: 2 }}>
      <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: "100%", overflow: "visible" }}>
        {/* Horizontal grid lines + y-axis labels */}
        {[maxVal, (minVal + maxVal) / 2, minVal].map((val, idx) => {
          const y = toY(val);
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="#1e1e1e" strokeWidth={1} />
              <text x={padLeft - 5} y={y + 3.5} textAnchor="end" fontSize={9}
                fontFamily="Inter, Segoe UI, sans-serif" fill="#3a3a3a">
                {fmtShort(val)}
              </text>
            </g>
          );
        })}

        <line x1={padLeft} y1={zeroY} x2={W - padRight} y2={zeroY}
          stroke="#2a2a2a" strokeWidth={1} strokeDasharray="3 3" />

        {/* Mountain area + line */}
        {areaPath && <path d={areaPath} fill="rgba(107,255,184,0.07)" />}
        {linePath && <path d={linePath} fill="none" stroke="#6bffb8" strokeWidth={1.5} strokeLinecap="round" />}

        {/* Tappable columns — one per day */}
        {days.map((label, i) => {
          const x = toX(i);
          const pt = pts.find((p) => p.i === i);
          const isToday = i === dow;
          const isSelected = selectedDow === i;
          const isFuture = i > dow;
          return (
            <g key={i} onPointerDown={() => handleTap(i)} style={{ cursor: isFuture ? "default" : "pointer" }}>
              {/* Full-column hit target — rgba so it's actually clickable */}
              <rect x={x - 14} y={0} width={28} height={H + 24} fill="rgba(0,0,0,0.01)" />
              {pt ? (
                <circle cx={x} cy={pt.y}
                  r={isSelected ? 6 : isToday ? 5 : 3}
                  fill={isSelected ? "#fff" : isToday ? "#6bffb8" : "#1a1a1a"}
                  stroke={isSelected ? "#fff" : isToday ? "#6bffb8" : "#3a3a3a"}
                  strokeWidth={1.5}
                />
              ) : !isFuture ? (
                <circle cx={x} cy={zeroY} r={3}
                  fill="#1a1a1a" stroke={isSelected ? "#fff" : "#2a2a2a"} strokeWidth={1} />
              ) : null}
              <text x={x} y={H + 20} textAnchor="middle" fontSize={10}
                fontFamily="Inter, Segoe UI, sans-serif"
                fill={isSelected ? "#fff" : isToday ? "#6bffb8" : isFuture ? "#252525" : "#444"}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DailyLog({ entries }) {
  const [expanded, setExpanded] = useState(null);
  if (!entries.length) return null;

  const groups = {};
  entries.forEach((e) => {
    const d = entryDate(e);
    const key = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
    if (!groups[key]) groups[key] = { date: d, items: [], net: 0 };
    groups[key].items.push(e);
    groups[key].net += Number(e.change);
  });

  const dayList = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 2 }}>
      {dayList.map(([key, { date, items, net }]) => {
        const isOpen = expanded === key;
        const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return (
          <div key={key}>
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#1a1a1a", padding: "10px 14px", cursor: "pointer",
                borderRadius: isOpen ? "8px 8px 0 0" : 8,
              }}
              onPointerDown={() => setExpanded(isOpen ? null : key)}
            >
              <span style={{ fontSize: 13, color: "#666" }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: net < 0 ? "#ff6b6b" : "#6bffb8" }}>
                {net > 0 ? "+" : ""}{fmt(net)}
              </span>
            </div>
            {isOpen && (
              <div style={{ background: "#141414", borderRadius: "0 0 8px 8px" }}>
                {[...items]
                  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                  .map((e) => (
                    <div key={e.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 14px", borderTop: "1px solid #1e1e1e",
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: Number(e.change) < 0 ? "#ff6b6b" : "#6bffb8" }}>
                          {Number(e.change) > 0 ? "+" : ""}{fmt(Number(e.change))}
                        </span>
                        {e.note && <span style={{ fontSize: 11, color: "#555" }}>{e.note}</span>}
                      </div>
                      <span style={{ fontSize: 11, color: "#333" }}>
                        {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => { fetchEntries(); }, []);

  useEffect(() => {
    let timer;
    const schedule = () => {
      const n = new Date();
      const midnight = new Date(n);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(() => {
        setNow(new Date());
        setSelectedDay(null);
        schedule();
      }, midnight - n);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("money_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else if (data) {
      setEntries(data);
      setBalance(data.reduce((sum, e) => sum + Number(e.change), 0));
    }
    setLoading(false);
  };

  const apply = async (sign) => {
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) return;
    setSaving(true);
    setError(null);

    const entryDate = selectedDay || now;
    const optimistic = {
      id: crypto.randomUUID(),
      change: sign * val,
      note: note.trim() || null,
      ts: entryDate.toISOString(),
      created_at: entryDate.toISOString(),
    };

    setEntries((prev) => [optimistic, ...prev]);
    setBalance((prev) => prev + optimistic.change);
    setAmount("");
    setNote("");
    setSelectedDay(null);

    const { data, error } = await supabase
      .from("money_entries")
      .insert({
        change: optimistic.change,
        note: optimistic.note,
        ts: optimistic.ts,
        created_at: optimistic.created_at,
      })
      .select()
      .single();

    if (error) {
      setError("Not saved to cloud: " + error.message);
    } else if (data) {
      // Swap optimistic entry for the real one from Supabase
      setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? data : e)));
    }
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("money_entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      setError(error.message);
    } else {
      setEntries([]);
      setBalance(0);
    }
    setShowReset(false);
    setSaving(false);
  };

  const handleKey = (e) => { if (e.key === "Enter") apply(1); };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {error && <div style={styles.errorBox}>{error}</div>}
        <div style={styles.dateHeader}>
          {now.toLocaleDateString("en-US", { weekday: "long" })}
          <span style={styles.dateDay}>
            {" · "}{now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>

        <div style={styles.balanceLabel}>Balance</div>

        {loading ? (
          <div style={styles.loadingBalance}>—</div>
        ) : (
          <div style={{ ...styles.balance, color: balance < 0 ? "#ff6b6b" : "#e2e2e2" }}>
            {fmt(balance)}
          </div>
        )}

        {!loading && (
          <WeeklyChart
            entries={entries}
            now={now}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}

        {selectedDay && (
          <div style={styles.dayTag}>
            <span>
              Adding to{" "}
              <strong>{selectedDay.toLocaleDateString("en-US", { weekday: "long" })}</strong>
              {" · "}{selectedDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <button style={styles.dayTagClose} onClick={() => setSelectedDay(null)}>✕</button>
          </div>
        )}

        <input
          style={styles.input}
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          min="0"
          disabled={saving}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={handleKey}
        />
        <input
          style={{ ...styles.input, ...styles.noteInput }}
          type="text"
          placeholder="Note (optional)"
          value={note}
          maxLength={80}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKey}
        />

        <div style={styles.btnRow}>
          <button
            style={{ ...styles.btn, ...styles.btnAdd, opacity: saving ? 0.5 : 1 }}
            onClick={() => apply(1)}
            disabled={saving}
          >
            + Add
          </button>
          <button
            style={{ ...styles.btn, ...styles.btnSub, opacity: saving ? 0.5 : 1 }}
            onClick={() => apply(-1)}
            disabled={saving}
          >
            − Subtract
          </button>
        </div>

        {!loading && <DailyLog entries={entries} />}

        {!loading && (
          <div style={styles.resetWrap}>
            {!showReset ? (
              <button style={styles.resetBtn} onClick={() => setShowReset(true)} disabled={saving}>
                Reset
              </button>
            ) : (
              <div style={styles.confirmRow}>
                <span style={styles.confirmText}>Erase everything?</span>
                <button
                  style={{ ...styles.btn, ...styles.btnSub, padding: "6px 16px", flex: "none", opacity: saving ? 0.5 : 1 }}
                  onClick={reset}
                  disabled={saving}
                >
                  Yes
                </button>
                <button
                  style={{ ...styles.btn, background: "#2a2a2a", padding: "6px 16px", flex: "none", color: "#aaa" }}
                  onClick={() => setShowReset(false)}
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100dvh",
    background: "#0f0f0f",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "90px 20px 40px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  dayTag: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#1a2a1a",
    border: "1px solid #2a4a2a",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12,
    color: "#6bffb8",
    marginBottom: -2,
  },
  dayTagClose: {
    background: "none",
    border: "none",
    color: "#3a6a3a",
    fontSize: 13,
    cursor: "pointer",
    padding: "0 0 0 8px",
  },
  dateHeader: {
    fontSize: 13,
    color: "#666",
    fontWeight: 500,
    marginBottom: 16,
    letterSpacing: "0.01em",
  },
  dateDay: {
    color: "#444",
  },
  balanceLabel: {
    color: "#666",
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: -4,
  },
  balance: {
    fontSize: 44,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    marginBottom: 6,
  },
  loadingBalance: {
    fontSize: 44,
    fontWeight: 700,
    color: "#333",
    lineHeight: 1,
    marginBottom: 6,
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    color: "#e2e2e2",
    fontSize: 18,
    padding: "12px 16px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  noteInput: {
    fontSize: 14,
    padding: "9px 16px",
    color: "#aaa",
  },
  btnRow: {
    display: "flex",
    gap: 10,
    marginTop: 2,
  },
  btn: {
    flex: 1,
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    padding: "13px 0",
    cursor: "pointer",
  },
  btnAdd: {
    background: "#1a3a2a",
    color: "#6bffb8",
  },
  btnSub: {
    background: "#3a1a1a",
    color: "#ff6b6b",
  },
  errorBox: {
    background: "#2a1a1a",
    border: "1px solid #5a2a2a",
    borderRadius: 8,
    color: "#ff6b6b",
    fontSize: 12,
    padding: "8px 12px",
  },
  log: {
    marginTop: 4,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 280,
    overflowY: "auto",
  },
  entry: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#1a1a1a",
    borderRadius: 8,
    padding: "9px 14px",
    gap: 8,
  },
  entryLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  entryAmount: {
    fontSize: 15,
    fontWeight: 600,
  },
  entryNote: {
    fontSize: 12,
    color: "#666",
  },
  entryTs: {
    fontSize: 11,
    color: "#444",
    whiteSpace: "nowrap",
  },
  resetWrap: {
    marginTop: 8,
    display: "flex",
    justifyContent: "center",
  },
  resetBtn: {
    background: "none",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    color: "#555",
    fontSize: 13,
    padding: "7px 20px",
    cursor: "pointer",
  },
  confirmRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  confirmText: {
    color: "#888",
    fontSize: 13,
  },
};
