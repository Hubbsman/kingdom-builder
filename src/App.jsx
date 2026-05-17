import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import MentorChat from "./MentorChat";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ts is stored as ISO when we write it; old entries used locale strings — fall back to created_at
const entryDate = (e) => { const t = new Date(e.ts); return isNaN(t) ? new Date(e.created_at) : t; };

// Cubic bezier with horizontal tangents — smooth curves, zero Y overshoot guaranteed
function smoothPath(pts) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const cpx = (p1.x - p0.x) / 3;
    d += ` C${p0.x + cpx},${p0.y} ${p1.x - cpx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

function WeeklyChart({ entries, now, selectedDay, onSelectDay }) {
  const dragRef = useRef({ y: 0, moved: false });
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

  const rawMax = Math.max(...validVals, 0);
  const rawMin = Math.min(...validVals, 0);
  // Pad 20% on each side so zero never sits at the edge
  const pad = Math.max(rawMax * 0.2, Math.abs(rawMin) * 0.2, 8);
  const displayMax = rawMax + pad;
  const displayMin = rawMin - pad;
  const range = displayMax - displayMin;

  const toY = (v) => padTop + innerH - ((v - displayMin) / range) * innerH;
  const toX = (i) => padLeft + (i / 6) * innerW;

  const pts = balances
    .map((v, i) => (v !== null ? { x: toX(i), y: toY(v), v, i } : null))
    .filter(Boolean);

  const zeroY = toY(0);

  const lp = smoothPath(pts);
  const areaPath = lp
    ? `${lp} L${pts[pts.length - 1].x},${zeroY} L${pts[0].x},${zeroY} Z`
    : "";
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
        <defs>
          <clipPath id="clip-above">
            <rect x={0} y={0} width={W} height={zeroY} />
          </clipPath>
          <clipPath id="clip-below">
            <rect x={0} y={zeroY} width={W} height={H + 24} />
          </clipPath>
        </defs>

        {/* Horizontal grid lines + y-axis labels */}
        {[rawMax, (rawMin + rawMax) / 2, rawMin].map((val, idx) => {
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

        {/* Area fill: green above zero, red below */}
        {areaPath && <path d={areaPath} fill="rgba(107,255,184,0.07)" clipPath="url(#clip-above)" />}
        {areaPath && <path d={areaPath} fill="rgba(255,107,107,0.10)" clipPath="url(#clip-below)" />}
        {/* Line: green above zero, red below */}
        {lp && <path d={lp} fill="none" stroke="#6bffb8" strokeWidth={1.5} strokeLinecap="round" clipPath="url(#clip-above)" />}
        {lp && <path d={lp} fill="none" stroke="#ff6b6b" strokeWidth={1.5} strokeLinecap="round" clipPath="url(#clip-below)" />}

        {/* Tappable columns — one per day */}
        {days.map((label, i) => {
          const x = toX(i);
          const pt = pts.find((p) => p.i === i);
          const isToday = i === dow;
          const isSelected = selectedDow === i;
          const isFuture = i > dow;
          return (
            <g key={i}
            onPointerDown={(e) => { dragRef.current = { y: e.clientY, moved: false }; }}
            onPointerMove={(e) => { if (Math.abs(e.clientY - dragRef.current.y) > 12) dragRef.current.moved = true; }}
            onPointerCancel={() => { dragRef.current.moved = true; }}
            onPointerUp={() => { if (!dragRef.current.moved) handleTap(i); }}
            style={{ cursor: isFuture ? "default" : "pointer" }}>
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

function EntryRow({ entry, onDelete, showBorder }) {
  const isNeg = Number(entry.change) < 0;
  return (
    <div style={{ padding: "8px 14px", borderTop: showBorder ? "1px solid #1e1e1e" : "none",
      display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: isNeg ? "#ff6b6b" : "#6bffb8" }}>
          {isNeg ? "" : "+"}{fmt(Number(entry.change))}
        </span>
        {entry.note && <span style={{ fontSize: 11, color: "#555" }}>{entry.note}</span>}
      </div>
      <span style={{ fontSize: 11, color: "#333" }}>
        {entryDate(entry).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
      <button onPointerDown={() => onDelete(entry.id)}
        style={{ background: "none", border: "none", color: "#4a2020", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
    </div>
  );
}

function ThisWeekLog({ entries, now, onDelete }) {
  const [expanded, setExpanded] = useState(null);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i <= dow; i++) {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(weekStart);
    dayEnd.setDate(weekStart.getDate() + i);
    dayEnd.setHours(23, 59, 59, 999);
    const items = entries.filter(e => { const t = entryDate(e); return t >= dayStart && t <= dayEnd; });
    if (!items.length) continue;
    const net = items.reduce((s, e) => s + Number(e.change), 0);
    days.push({ key: dayStart.toLocaleDateString("en-CA"), name: dayNames[i], items, net });
  }

  if (!days.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {[...days].reverse().map(({ key, name, items, net }) => {
        const isOpen = expanded === key;
        return (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#1a1a1a", padding: "10px 14px",
              borderRadius: isOpen ? "8px 8px 0 0" : 8 }}>
              <span style={{ fontSize: 13, color: "#666" }}>{name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: net < 0 ? "#ff6b6b" : "#6bffb8" }}>
                  {net > 0 ? "+" : ""}{fmt(net)}
                </span>
                <button onClick={() => setExpanded(isOpen ? null : key)}
                  style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer",
                    padding: "2px 6px", lineHeight: 1, display: "flex", alignItems: "center",
                    transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.18s ease" }}>
                  ›
                </button>
              </div>
            </div>
            {isOpen && (
              <div style={{ background: "#141414", borderRadius: "0 0 8px 8px" }}>
                {[...items].sort((a, b) => entryDate(b) - entryDate(a)).map((e, i) => (
                  <EntryRow key={e.id} entry={e} onDelete={onDelete} showBorder={i > 0} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeeklyLog({ entries, now, onDelete }) {
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const calWeekStart = new Date(now);
  calWeekStart.setDate(now.getDate() - now.getDay());
  calWeekStart.setHours(0, 0, 0, 0);

  const past = entries.filter(e => entryDate(e) < calWeekStart);
  if (!past.length) return null;

  // Group by proper Sun–Sat calendar week (keyed by that week's Sunday date)
  const groups = {};
  past.forEach(e => {
    const d = entryDate(e);
    const ws = new Date(d);
    ws.setDate(d.getDate() - d.getDay());
    ws.setHours(0, 0, 0, 0);
    const k = ws.toLocaleDateString("en-CA");
    if (!groups[k]) {
      const month = ws.toLocaleDateString("en-US", { month: "long" });
      const weekNum = Math.ceil(ws.getDate() / 7);
      groups[k] = { label: `${month} Week ${weekNum}`, weekStart: new Date(ws), items: [], net: 0 };
    }
    groups[k].items.push(e);
    groups[k].net += Number(e.change);
  });

  const weeks = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));

  const toggleWeek = (k) => {
    if (expandedWeek === k) { setExpandedWeek(null); setExpandedDay(null); }
    else { setExpandedWeek(k); setExpandedDay(null); }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Weekly</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {weeks.map(([k, { label, weekStart, items, net }]) => {
          const isWeekOpen = expandedWeek === k;

          const dayMap = {};
          items.forEach(e => {
            const d = entryDate(e);
            const dk = d.toLocaleDateString("en-CA");
            if (!dayMap[dk]) dayMap[dk] = { items: [], net: 0 };
            dayMap[dk].items.push(e);
            dayMap[dk].net += Number(e.change);
          });

          const allDays = Array.from({ length: 7 }, (_, i) => {
            const dt = new Date(weekStart);
            dt.setDate(weekStart.getDate() + i);
            const dk = dt.toLocaleDateString("en-CA");
            return { dk, name: dayNames[i], ...(dayMap[dk] || { items: [], net: 0 }), hasEntries: !!dayMap[dk] };
          });

          return (
            <div key={k}>
              <div onClick={() => toggleWeek(k)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "#1a1a1a", padding: "10px 14px", cursor: "pointer",
                  borderRadius: isWeekOpen ? "8px 8px 0 0" : 8 }}>
                <span style={{ fontSize: 13, color: "#666" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: net < 0 ? "#ff6b6b" : "#6bffb8" }}>
                    {net > 0 ? "+" : ""}{fmt(net)}
                  </span>
                  <span style={{ color: "#555", fontSize: 20, padding: "2px 6px", lineHeight: 1,
                    display: "inline-block",
                    transform: isWeekOpen ? "rotate(90deg)" : "none", transition: "transform 0.18s ease" }}>›</span>
                </div>
              </div>
              {isWeekOpen && (
                <div style={{ background: "#141414", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  {allDays.map(({ dk, name, items: dayItems, net: dayNet, hasEntries }, di) => {
                    const isDayOpen = expandedDay === dk;
                    return (
                      <div key={dk}>
                        <div style={{
                          padding: "9px 14px",
                          borderTop: di > 0 ? "1px solid #1e1e1e" : "none",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          cursor: hasEntries ? "pointer" : "default",
                        }}
                          onClick={() => hasEntries && setExpandedDay(isDayOpen ? null : dk)}>
                          <span style={{ fontSize: 13, color: hasEntries ? "#666" : "#2a2a2a" }}>{name}</span>
                          {hasEntries ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: dayNet < 0 ? "#ff6b6b" : "#6bffb8" }}>
                                {dayNet > 0 ? "+" : ""}{fmt(dayNet)}
                              </span>
                              <span style={{ color: "#555", fontSize: 18, padding: "2px 4px", lineHeight: 1,
                                display: "inline-block",
                                transform: isDayOpen ? "rotate(90deg)" : "none", transition: "transform 0.18s ease" }}>›</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 13, color: "#222" }}>—</span>
                          )}
                        </div>
                        {isDayOpen && (
                          <div style={{ background: "#111" }}>
                            {[...dayItems].sort((a, b) => entryDate(b) - entryDate(a)).map((e, i) => (
                              <EntryRow key={e.id} entry={e} onDelete={onDelete} showBorder={i > 0} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("balance");
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

    const targetDate = selectedDay || now;
    const optimistic = {
      id: crypto.randomUUID(),
      change: sign * val,
      note: note.trim() || null,
      ts: targetDate.toISOString(),
      created_at: targetDate.toISOString(),
    };

    setEntries((prev) => [optimistic, ...prev]);
    setBalance((prev) => prev + optimistic.change);
    setAmount("");
    setNote("");

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

  const deleteEntry = async (id) => {
    const target = entries.find(e => e.id === id);
    if (!target) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    setBalance(prev => prev - Number(target.change));
    await supabase.from("money_entries").delete().eq("id", id);
  };

  const handleKey = (e) => { if (e.key === "Enter") apply(1); };

  return (
    <>
    {activeTab === "mentor" && <MentorChat />}
    <div style={{ display: activeTab === "balance" ? "block" : "none" }}>
    <div style={{ ...styles.root, paddingBottom: 90 }}>
      <div style={styles.card}>
        {error && <div style={styles.errorBox}>{error}</div>}
        <div style={styles.dateHeader}>
          {now.toLocaleDateString("en-US", { weekday: "long" })}
          <span style={styles.dateDay}>
            {" · "}{now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={styles.balanceLabel}>Balance</div>
            {loading ? (
              <div style={styles.loadingBalance}>—</div>
            ) : (
              <div style={{ ...styles.balance, color: balance < 0 ? "#ff6b6b" : "#e2e2e2" }}>
                {fmt(balance)}
              </div>
            )}
          </div>
          {!loading && selectedDay && (() => {
            const ds = new Date(selectedDay); ds.setHours(0, 0, 0, 0);
            const de = new Date(selectedDay); de.setHours(23, 59, 59, 999);
            const net = entries
              .filter(e => { const t = entryDate(e); return t >= ds && t <= de; })
              .reduce((s, e) => s + Number(e.change), 0);
            return (
              <div style={{ textAlign: "right", paddingBottom: 6 }}>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                  {selectedDay.toLocaleDateString("en-US", { weekday: "long" })}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: net < 0 ? "#ff6b6b" : "#6bffb8" }}>
                  {net > 0 ? "+" : ""}{fmt(net)}
                </div>
              </div>
            );
          })()}
        </div>

        {!loading && (
          <WeeklyChart
            entries={entries}
            now={now}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}

        {selectedDay && (
          <div style={{ fontSize: 13, color: "#e2e2e2", letterSpacing: "0.01em" }}>
            {selectedDay.toLocaleDateString("en-US", { weekday: "long" })}
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

        {!loading && <WeeklyLog entries={entries} now={now} onDelete={deleteEntry} />}

      </div>
    </div>
    </div>

    {/* Calendar tab */}
    <div style={{ display: activeTab === "calendar" ? "block" : "none" }}>
    <div style={{ ...styles.root, paddingBottom: 90 }}>
      <div style={styles.card}>
        {!loading && (
          <WeeklyChart
            entries={entries}
            now={now}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}

        {!loading && selectedDay && (() => {
          const ds = new Date(selectedDay); ds.setHours(0, 0, 0, 0);
          const de = new Date(selectedDay); de.setHours(23, 59, 59, 999);
          const net = entries
            .filter(e => { const t = entryDate(e); return t >= ds && t <= de; })
            .reduce((s, e) => s + Number(e.change), 0);
          return (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#e2e2e2" }}>
                {selectedDay.toLocaleDateString("en-US", { weekday: "long" })}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: net < 0 ? "#ff6b6b" : "#6bffb8" }}>
                {net > 0 ? "+" : ""}{fmt(net)}
              </span>
            </div>
          );
        })()}

        {!loading && <ThisWeekLog entries={entries} now={now} onDelete={deleteEntry} />}
        {!loading && <WeeklyLog entries={entries} now={now} onDelete={deleteEntry} />}

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
    </div>

    {/* Bottom tab bar */}
    <div style={styles.tabBar}>
      <button
        style={{ ...styles.tabBtn, color: activeTab === "balance" ? "#6bffb8" : "#3a3a3a" }}
        onClick={() => setActiveTab("balance")}
      >
        <span style={styles.tabIcon}>⚖</span>
        <span style={styles.tabLabel}>Balance</span>
      </button>
      <button
        style={{ ...styles.tabBtn, color: activeTab === "calendar" ? "#6bffb8" : "#3a3a3a" }}
        onClick={() => setActiveTab("calendar")}
      >
        <span style={styles.tabIcon}>◫</span>
        <span style={styles.tabLabel}>Calendar</span>
      </button>
      <button
        style={{ ...styles.tabBtn, color: activeTab === "mentor" ? "#6bffb8" : "#3a3a3a" }}
        onClick={() => setActiveTab("mentor")}
      >
        <span style={styles.tabIcon}>◈</span>
        <span style={styles.tabLabel}>Mentor</span>
      </button>
    </div>
    </>
  );
}

const styles = {
  root: {
    minHeight: "100dvh",
    background: "#0f0f0f",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "70px 20px 60px",
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
    color: "#555",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: 500,
  },
  balance: {
    fontSize: 48,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
    marginBottom: 6,
    fontVariantNumeric: "tabular-nums",
  },
  loadingBalance: {
    fontSize: 48,
    fontWeight: 700,
    color: "#333",
    lineHeight: 1,
    marginBottom: 6,
    fontVariantNumeric: "tabular-nums",
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
  tabBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    background: "#0a0a0a",
    borderTop: "1px solid #1a1a1a",
    display: "flex",
    zIndex: 200,
  },
  tabBtn: {
    flex: 1,
    background: "none",
    border: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    cursor: "pointer",
    padding: 0,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    transition: "color 0.15s",
  },
  tabIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
};
