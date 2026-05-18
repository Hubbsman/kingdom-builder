import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
// MENTOR_HIDDEN: import MentorChat from "./MentorChat";

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

function EntryRow({ entry, onDelete, onEdit, showBorder }) {
  const isNeg = Number(entry.change) < 0;
  const tapRef = useRef({ x: 0, y: 0, moved: false });
  return (
    <div
      onPointerDown={(e) => { tapRef.current = { x: e.clientX, y: e.clientY, moved: false }; }}
      onPointerMove={(e) => {
        const dx = e.clientX - tapRef.current.x;
        const dy = e.clientY - tapRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) >= 8) tapRef.current.moved = true;
      }}
      onPointerCancel={() => { tapRef.current.moved = true; }}
      onPointerUp={(e) => {
        if (tapRef.current.moved) return;
        const dx = e.clientX - tapRef.current.x;
        const dy = e.clientY - tapRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < 8) onEdit(entry);
      }}
      style={{ padding: "8px 14px", borderTop: showBorder ? "1px solid #1e1e1e" : "none",
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: isNeg ? "#ff6b6b" : "#6bffb8" }}>
          {isNeg ? "" : "+"}{fmt(Number(entry.change))}
        </span>
        {entry.note && <span style={{ fontSize: 11, color: "#555" }}>{entry.note}</span>}
      </div>
      <span style={{ fontSize: 11, color: "#333" }}>
        {entryDate(entry).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
      <button
        onPointerDown={(e) => { e.stopPropagation(); }}
        onPointerUp={(e) => { e.stopPropagation(); onDelete(entry.id); }}
        style={{ background: "none", border: "none", color: "#4a2020", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
    </div>
  );
}

function ThisWeekLog({ entries, now, onDelete, onEdit }) {
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
                  <EntryRow key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} showBorder={i > 0} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeeklyLog({ entries, now, onDelete, onEdit }) {
  const [expandedWeek, setExpandedWeek] = useState(null);
  // Tracks which day boxes are open: "weekKey|dayKey" → true
  const [expandedDays, setExpandedDays] = useState({});

  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const sundayOf = (d) => {
    const s = new Date(d);
    s.setDate(d.getDate() - d.getDay());
    s.setHours(0, 0, 0, 0);
    return s;
  };

  const weekKey = (d) => {
    const s = sundayOf(d);
    return s.toLocaleDateString("en-CA");
  };

  const weekLabel = (d) => {
    const s = sundayOf(d);
    const weekNum = Math.floor((s.getDate() - 1) / 7) + 1;
    return `${s.toLocaleDateString("en-US", { month: "long" })} Week ${weekNum}`;
  };

  const calWeekStart = sundayOf(now);

  const past = entries.filter(e => entryDate(e) < calWeekStart);
  if (!past.length) return null;

  const groups = {};
  past.forEach(e => {
    const d = entryDate(e);
    const k = weekKey(d);
    if (!groups[k]) groups[k] = { label: weekLabel(d), sunday: sundayOf(d), items: [], net: 0 };
    groups[k].items.push(e);
    groups[k].net += Number(e.change);
  });

  const weeks = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));

  const toggleDay = (wk, dk) => {
    const composite = `${wk}|${dk}`;
    setExpandedDays(prev => ({ ...prev, [composite]: !prev[composite] }));
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Weekly</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {weeks.map(([k, { label, sunday, items, net }]) => {
          const isOpen = expandedWeek === k;

          // Build a map of dayKey → entries for this week
          const dayMap = {};
          items.forEach(e => {
            const d = entryDate(e);
            const dk = d.toLocaleDateString("en-CA");
            if (!dayMap[dk]) dayMap[dk] = [];
            dayMap[dk].push(e);
          });

          // All 7 days of this week, Sun → Sat
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + i);
            const dk = date.toLocaleDateString("en-CA");
            const dayEntries = dayMap[dk] || [];
            const dayNet = dayEntries.reduce((s, e) => s + Number(e.change), 0);
            return { dow: i, name: DAY_NAMES[i], dk, date, dayEntries, dayNet };
          });

          return (
            <div key={k}>
              {/* Week header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#1a1a1a", padding: "10px 14px",
                borderRadius: isOpen ? "8px 8px 0 0" : 8 }}>
                <span style={{ fontSize: 13, color: "#666" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: net < 0 ? "#ff6b6b" : "#6bffb8" }}>
                    {net > 0 ? "+" : ""}{fmt(net)}
                  </span>
                  <button onClick={() => {
                    setExpandedWeek(isOpen ? null : k);
                    // Collapse all day boxes when closing a week
                    if (isOpen) {
                      setExpandedDays(prev => {
                        const next = { ...prev };
                        Object.keys(next).forEach(key => { if (key.startsWith(`${k}|`)) delete next[key]; });
                        return next;
                      });
                    }
                  }}
                    style={{ background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer",
                      padding: "2px 6px", lineHeight: 1, display: "flex", alignItems: "center",
                      transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.18s ease" }}>
                    ›
                  </button>
                </div>
              </div>

              {/* 7 day boxes — all always rendered when week is open */}
              {isOpen && (
                <div style={{ background: "#141414", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  {weekDays.map(({ dow, name, dk, dayEntries, dayNet }, di) => {
                    const composite = `${k}|${dk}`;
                    const isDayOpen = !!expandedDays[composite];
                    const hasEntries = dayEntries.length > 0;

                    return (
                      <div key={dk} style={{ borderTop: di > 0 ? "1px solid #1e1e1e" : "none" }}>
                        {/* Day header — always visible, tappable */}
                        <div
                          onClick={() => hasEntries && toggleDay(k, dk)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "9px 14px", cursor: hasEntries ? "pointer" : "default" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: hasEntries ? "#555" : "#333",
                              letterSpacing: "0.07em", textTransform: "uppercase", minWidth: 72 }}>
                              {name}
                            </span>
                            {hasEntries && (
                              <span style={{ fontSize: 11, color: "#333" }}>
                                {dayEntries.length} {dayEntries.length === 1 ? "txn" : "txns"}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {hasEntries ? (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 600,
                                  color: dayNet < 0 ? "#ff6b6b" : "#6bffb8" }}>
                                  {dayNet > 0 ? "+" : ""}{fmt(dayNet)}
                                </span>
                                <span style={{ fontSize: 16, color: "#444", lineHeight: 1,
                                  transform: isDayOpen ? "rotate(90deg)" : "none",
                                  transition: "transform 0.15s ease", display: "inline-block" }}>
                                  ›
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: "#2a2a2a" }}>—</span>
                            )}
                          </div>
                        </div>

                        {/* Expanded entries for this day */}
                        {isDayOpen && hasEntries && (
                          <div style={{ background: "#111111" }}>
                            {[...dayEntries].sort((a, b) => entryDate(b) - entryDate(a)).map((e, i) => (
                              <EntryRow key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} showBorder={i > 0} />
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

function EditEntryModal({ entry, onSave, onDelete, onClose }) {
  const [amount, setAmount] = useState(String(Math.abs(Number(entry.change))));
  const [note, setNote] = useState(entry.note || "");
  const [saving, setSaving] = useState(false);
  const isNeg = Number(entry.change) < 0;

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) return;
    setSaving(true);
    await onSave(entry.id, isNeg ? -val : val, note.trim() || null);
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setSaving(true);
    await onDelete(entry.id);
    setSaving(false);
    onClose();
  };

  return (
    <div
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 500,
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#141414",
        borderRadius: "16px 16px 0 0", padding: "20px 20px 36px",
        border: "1px solid #2a2a2a", borderBottom: "none",
        display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Edit Transaction
          </span>
          <button onPointerDown={onClose}
            style={{ background: "none", border: "none", color: "#444", fontSize: 22, cursor: "pointer",
              padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: 11, color: "#333" }}>
          {entryDate(entry).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          {" · "}
          {entryDate(entry).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>

        <input
          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#e2e2e2", fontSize: 18, padding: "12px 16px", outline: "none",
            width: "100%", boxSizing: "border-box" }}
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          min="0"
          disabled={saving}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#aaa", fontSize: 14, padding: "9px 16px", outline: "none",
            width: "100%", boxSizing: "border-box" }}
          type="text"
          placeholder="Note (optional)"
          value={note}
          maxLength={80}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            onPointerDown={handleSave}
            disabled={saving}
            style={{ flex: 1, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
              padding: "13px 0", cursor: saving ? "default" : "pointer",
              background: isNeg ? "#3a1a1a" : "#1a3a2a",
              color: isNeg ? "#ff6b6b" : "#6bffb8",
              opacity: saving ? 0.5 : 1 }}>
            Save
          </button>
          <button
            onPointerDown={handleDelete}
            disabled={saving}
            style={{ flex: "none", border: "1px solid #3a1a1a", borderRadius: 10, fontSize: 15,
              fontWeight: 600, padding: "13px 20px", cursor: saving ? "default" : "pointer",
              background: "transparent", color: "#ff6b6b", opacity: saving ? 0.5 : 1 }}>
            Delete
          </button>
        </div>

      </div>
    </div>
  );
}

function CalendarView({ entries, now, supabase }) {
  const [subs, setSubs] = useState([]);
  const [calLoading, setCalLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subDay, setSubDay] = useState("");
  const [subSaving, setSubSaving] = useState(false);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    fetchSubs();
  }, []);

  const fetchSubs = async () => {
    setCalLoading(true);
    const { data } = await supabase.from("subscriptions").select("*").order("day_of_month", { ascending: true });
    if (data) setSubs(data);
    setCalLoading(false);
  };

  const runAutoDeductions = async (subsToCheck) => {
    const todayNum = now.getDate();
    const due = subsToCheck.filter(s => s.day_of_month === todayNum);
    if (!due.length) return;

    const todayStr = now.toLocaleDateString("en-CA");
    const { data: todayEntries } = await supabase
      .from("money_entries")
      .select("*")
      .gte("ts", `${todayStr}T00:00:00`)
      .lte("ts", `${todayStr}T23:59:59`);

    for (const sub of due) {
      const alreadyDeducted = (todayEntries || []).some(
        e => e.note === sub.name && Number(e.change) === -Math.abs(Number(sub.amount))
      );
      if (!alreadyDeducted) {
        await supabase.from("money_entries").insert({
          change: -Math.abs(Number(sub.amount)),
          note: sub.name,
          ts: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }
    }
  };

  useEffect(() => {
    if (!calLoading && subs.length > 0) {
      runAutoDeductions(subs);
    }
  }, [calLoading]);

  const addSub = async () => {
    const name = subName.trim();
    const amount = parseFloat(subAmount);
    const day = parseInt(subDay, 10);
    if (!name || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) return;

    setSubSaving(true);
    const { data } = await supabase
      .from("subscriptions")
      .insert({ name, amount, day_of_month: day })
      .select()
      .single();

    if (data) {
      const newSubs = [...subs, data].sort((a, b) => a.day_of_month - b.day_of_month);
      setSubs(newSubs);

      const todayNum = now.getDate();
      if (day === todayNum) {
        const todayStr = now.toLocaleDateString("en-CA");
        const { data: todayEntries } = await supabase
          .from("money_entries")
          .select("*")
          .gte("ts", `${todayStr}T00:00:00`)
          .lte("ts", `${todayStr}T23:59:59`);
        const alreadyDeducted = (todayEntries || []).some(
          e => e.note === name && Number(e.change) === -Math.abs(amount)
        );
        if (!alreadyDeducted) {
          await supabase.from("money_entries").insert({
            change: -Math.abs(amount),
            note: name,
            ts: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    setSubName("");
    setSubAmount("");
    setSubDay("");
    setSubSaving(false);
  };

  const deleteSub = async (id) => {
    await supabase.from("subscriptions").delete().eq("id", id);
    setSubs(prev => prev.filter(s => s.id !== id));
    if (selectedDay !== null) {
      const dayNum = selectedDay;
      const remaining = subs.filter(s => s.id !== id && s.day_of_month === dayNum);
      if (remaining.length === 0) setSelectedDay(null);
    }
  };

  // Build calendar grid for current month
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDate = now.getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map day number -> list of subs
  const subsByDay = {};
  subs.forEach(s => {
    const d = s.day_of_month;
    if (!subsByDay[d]) subsByDay[d] = [];
    subsByDay[d].push(s);
  });

  // Dot layout positions for up to 6 dots in a cell
  const dotLayouts = {
    1: [[0, 0]],
    2: [[-3, 0], [3, 0]],
    3: [[-4, 0], [0, 0], [4, 0]],
    4: [[-4, -2], [0, -2], [4, -2], [0, 2]],
    5: [[-4, -2], [0, -2], [4, -2], [-2, 2], [2, 2]],
    6: [[-4, -2], [0, -2], [4, -2], [-4, 2], [0, 2], [4, 2]],
  };

  const selectedSubs = selectedDay !== null ? (subsByDay[selectedDay] || []) : [];

  // Upcoming subs total: days that haven't passed yet this month (including today)
  const upcomingTotal = subs
    .filter(s => s.day_of_month >= todayDate)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ ...styles.root, paddingBottom: 90 }}>
      <div style={styles.card}>

        {/* Month header */}
        <div style={{ fontSize: 13, color: "#666", fontWeight: 500, letterSpacing: "0.01em", marginBottom: 4 }}>
          {monthLabel}
        </div>

        {/* Calendar grid */}
        <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "12px 10px 10px", border: "1px solid #1e1e1e" }}>
          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.08em" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px 2px" }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;

              const isPast = d < todayDate;
              const isToday = d === todayDate;
              const isFuture = d > todayDate;
              const isSelected = selectedDay === d;
              const dotList = subsByDay[d] || [];
              const dotCount = Math.min(dotList.length, 6);
              const layout = dotLayouts[dotCount] || [];

              return (
                <div key={d}
                  onClick={() => setSelectedDay(isSelected ? null : d)}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 40,
                    borderRadius: 8,
                    cursor: dotCount > 0 ? "pointer" : "default",
                    background: isSelected ? "#2a2a2a" : "transparent",
                    border: isToday ? "1px solid #6bffb8" : isSelected ? "1px solid #3a3a3a" : "1px solid transparent",
                    boxShadow: isToday ? "0 0 8px rgba(107,255,184,0.15)" : "none",
                  }}>

                  <span style={{
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? "#6bffb8" : isPast ? "#333" : "#888",
                    lineHeight: 1,
                    marginBottom: dotCount > 0 ? 2 : 0,
                  }}>
                    {d}
                  </span>

                  {/* Subscription dots */}
                  {dotCount > 0 && (
                    <div style={{ position: "relative", height: 8, width: 24 }}>
                      {layout.map(([ox, oy], di) => (
                        <div key={di} style={{
                          position: "absolute",
                          width: 4, height: 4,
                          borderRadius: "50%",
                          background: "#e0954a",
                          left: "50%",
                          top: "50%",
                          transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected day panel */}
        {selectedDay !== null && (
          <div style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              {now.toLocaleDateString("en-US", { month: "long" })} {selectedDay}
            </div>
            {selectedSubs.length === 0 ? (
              <div style={{ fontSize: 13, color: "#333" }}>No subscriptions on this day</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedSubs.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 14, color: "#e2e2e2" }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: "#e0954a" }}>{fmt(s.amount)}/mo</span>
                    </div>
                    <button onClick={() => deleteSub(s.id)}
                      style={{ background: "none", border: "none", color: "#4a2020", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming total */}
        {subs.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "#1a1a1a", borderRadius: 8, padding: "10px 14px" }}>
            <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>Upcoming this month</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#e0954a" }}>{fmt(upcomingTotal)}</span>
          </div>
        )}

        {/* Add subscription form */}
        <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8, border: "1px solid #1e1e1e" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>Add Subscription</div>
          <input
            style={{ ...styles.input, fontSize: 14 }}
            type="text"
            placeholder="Name (e.g. Netflix)"
            value={subName}
            maxLength={60}
            disabled={subSaving}
            onChange={e => setSubName(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...styles.input, fontSize: 14, flex: 2 }}
              type="number"
              inputMode="decimal"
              placeholder="Amount"
              value={subAmount}
              min="0"
              disabled={subSaving}
              onChange={e => setSubAmount(e.target.value)}
            />
            <input
              style={{ ...styles.input, fontSize: 14, flex: 1 }}
              type="number"
              inputMode="numeric"
              placeholder="Day"
              value={subDay}
              min="1"
              max="31"
              disabled={subSaving}
              onChange={e => setSubDay(e.target.value)}
            />
          </div>
          <button
            onClick={addSub}
            disabled={subSaving}
            style={{ ...styles.btn, background: "#1e2e1e", color: "#6bffb8", fontSize: 14,
              padding: "10px 0", opacity: subSaving ? 0.5 : 1 }}>
            + Add Subscription
          </button>
        </div>

        {/* Active subscriptions list */}
        {!calLoading && subs.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
              Active Subscriptions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {subs.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#1a1a1a", borderRadius: 8, padding: "9px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#e0954a", fontWeight: 600, minWidth: 24, textAlign: "right" }}>
                      {s.day_of_month}
                    </span>
                    <span style={{ fontSize: 14, color: "#e2e2e2" }}>{s.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#ff6b6b" }}>-{fmt(s.amount)}</span>
                    <button onClick={() => deleteSub(s.id)}
                      style={{ background: "none", border: "none", color: "#4a2020", fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {calLoading && (
          <div style={{ fontSize: 13, color: "#333", textAlign: "center", padding: "20px 0" }}>Loading…</div>
        )}

      </div>
    </div>
  );
}

function EditCountdownModal({ countdown, onSave, onClose }) {
  const existing = new Date(countdown.due_at);
  const pad2 = (n) => String(n).padStart(2, "0");
  const initDate = `${existing.getFullYear()}-${pad2(existing.getMonth() + 1)}-${pad2(existing.getDate())}`;
  const initTime = `${pad2(existing.getHours())}:${pad2(existing.getMinutes())}`;

  const [label, setLabel] = useState(countdown.label);
  const [dueDate, setDueDate] = useState(initDate);
  const [dueTime, setDueTime] = useState(initTime);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimLabel = label.trim();
    if (!trimLabel || !dueDate) return;
    const timeStr = dueTime || "00:00";
    const due = new Date(`${dueDate}T${timeStr}:00`);
    if (isNaN(due.getTime())) return;
    setSaving(true);
    await onSave(countdown.id, trimLabel, due.toISOString());
    setSaving(false);
    onClose();
  };

  return (
    <div
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 500,
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#141414",
        borderRadius: "16px 16px 0 0", padding: "20px 20px 36px",
        border: "1px solid #2a2a2a", borderBottom: "none",
        display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Edit Countdown
          </span>
          <button onPointerDown={onClose}
            style={{ background: "none", border: "none", color: "#444", fontSize: 22, cursor: "pointer",
              padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <input
          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
            color: "#e2e2e2", fontSize: 15, padding: "12px 16px", outline: "none",
            width: "100%", boxSizing: "border-box" }}
          type="text"
          placeholder="Event name"
          value={label}
          maxLength={80}
          disabled={saving}
          onChange={(e) => setLabel(e.target.value)}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
              color: "#e2e2e2", fontSize: 14, padding: "12px 16px", outline: "none",
              flex: 3, boxSizing: "border-box" }}
            type="date"
            value={dueDate}
            disabled={saving}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
              color: "#e2e2e2", fontSize: 14, padding: "12px 16px", outline: "none",
              flex: 2, boxSizing: "border-box" }}
            type="time"
            value={dueTime}
            disabled={saving}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        <button
          onPointerDown={handleSave}
          disabled={saving || !label.trim() || !dueDate}
          style={{ border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
            padding: "13px 0", cursor: (saving || !label.trim() || !dueDate) ? "default" : "pointer",
            background: "#1a1a2e", color: "#8080ff",
            opacity: (saving || !label.trim() || !dueDate) ? 0.4 : 1 }}>
          Save
        </button>

      </div>
    </div>
  );
}

function CountdownView({ supabase }) {
  const [countdowns, setCountdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const [editingCountdown, setEditingCountdown] = useState(null);

  // Tick every minute to refresh countdowns
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchCountdowns();
  }, []);

  const fetchCountdowns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("countdowns")
      .select("*")
      .order("due_at", { ascending: true });
    if (data) setCountdowns(data);
    setLoading(false);
  };

  const addCountdown = async () => {
    const trimLabel = label.trim();
    if (!trimLabel || !dueDate) return;
    const timeStr = dueTime || "00:00";
    const due = new Date(`${dueDate}T${timeStr}:00`);
    if (isNaN(due.getTime())) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("countdowns")
      .insert({ label: trimLabel, due_at: due.toISOString() })
      .select()
      .single();

    if (data) {
      setCountdowns(prev => [...prev, data].sort((a, b) => new Date(a.due_at) - new Date(b.due_at)));
      setLabel("");
      setDueDate("");
      setDueTime("");
    } else if (error) {
      // Table may not exist yet — surface the error so user knows to create it
      alert("Could not save. Make sure the 'countdowns' table exists in Supabase.\n\nSQL:\nCREATE TABLE countdowns (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  label text NOT NULL,\n  due_at timestamptz NOT NULL,\n  created_at timestamptz DEFAULT now()\n);");
    }
    setSaving(false);
  };

  const deleteCountdown = async (id) => {
    setCountdowns(prev => prev.filter(c => c.id !== id));
    await supabase.from("countdowns").delete().eq("id", id);
  };

  const updateCountdown = async (id, newLabel, newDueAt) => {
    setCountdowns(prev =>
      prev.map(c => c.id === id ? { ...c, label: newLabel, due_at: newDueAt } : c)
         .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    );
    await supabase.from("countdowns").update({ label: newLabel, due_at: newDueAt }).eq("id", id);
  };

  const formatRemaining = (due_at) => {
    const now = new Date();
    const due = new Date(due_at);
    const diff = due - now;
    if (diff <= 0) return { expired: true, text: "Expired" };
    const totalMins = Math.floor(diff / 60000);
    const days = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mins = totalMins % 60;
    return { expired: false, days, hours, mins };
  };

  const fmtDueDate = (due_at) => {
    const d = new Date(due_at);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <>
    {editingCountdown && (
      <EditCountdownModal
        countdown={editingCountdown}
        onSave={updateCountdown}
        onClose={() => setEditingCountdown(null)}
      />
    )}
    <div style={{ ...styles.root, paddingBottom: 90 }}>
      <div style={styles.card}>

        <div style={styles.dateHeader}>Countdowns</div>

        {/* Add form */}
        <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 8, border: "1px solid #1e1e1e" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>New Countdown</div>
          <input
            style={{ ...styles.input, fontSize: 14 }}
            type="text"
            placeholder="Event name (e.g. Jiu Jitsu Competition)"
            value={label}
            maxLength={80}
            disabled={saving}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addCountdown(); }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...styles.input, fontSize: 14, flex: 3 }}
              type="date"
              value={dueDate}
              disabled={saving}
              onChange={e => setDueDate(e.target.value)}
            />
            <input
              style={{ ...styles.input, fontSize: 14, flex: 2 }}
              type="time"
              value={dueTime}
              disabled={saving}
              onChange={e => setDueTime(e.target.value)}
            />
          </div>
          <button
            onClick={addCountdown}
            disabled={saving || !label.trim() || !dueDate}
            style={{ ...styles.btn, background: "#1a1a2e", color: "#8080ff", fontSize: 14,
              padding: "10px 0", opacity: (saving || !label.trim() || !dueDate) ? 0.4 : 1 }}>
            + Add Countdown
          </button>
        </div>

        {/* Countdown cards */}
        {loading ? (
          <div style={{ fontSize: 13, color: "#333", textAlign: "center", padding: "20px 0" }}>Loading…</div>
        ) : countdowns.length === 0 ? (
          <div style={{ fontSize: 13, color: "#333", textAlign: "center", padding: "20px 0" }}>No countdowns yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {countdowns.map(c => {
              const rem = formatRemaining(c.due_at);
              return (
                <div key={c.id}
                  onClick={() => setEditingCountdown(c)}
                  style={{ background: "#1a1a1a", border: "1px solid #1e1e1e",
                    borderRadius: 12, padding: "14px 14px 12px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e2e2", flex: 1, paddingRight: 8 }}>{c.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCountdown(c.id); }}
                      style={{ background: "none", border: "none", color: "#4a2020", fontSize: 18,
                        cursor: "pointer", padding: "0 0 0 6px", lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>{fmtDueDate(c.due_at)}</div>
                  {rem.expired ? (
                    <div style={{ fontSize: 13, color: "#555", fontStyle: "italic" }}>Expired</div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      {[
                        { val: rem.days, unit: "days" },
                        { val: rem.hours, unit: "hrs" },
                        { val: rem.mins, unit: "min" },
                      ].map(({ val, unit }) => (
                        <div key={unit} style={{ flex: 1, background: "#141414", borderRadius: 8,
                          padding: "8px 0", textAlign: "center", border: "1px solid #1e1e1e" }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: "#8080ff",
                            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                            {val}
                          </div>
                          <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em",
                            textTransform: "uppercase", marginTop: 2 }}>{unit}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
    </>
  );
}

const CORRECT_PIN = "0204";

function PinLock({ onUnlock }) {
  const [digits, setDigits] = useState([]);
  const [shake, setShake] = useState(false);

  const press = (d) => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      if (next.join("") === CORRECT_PIN) {
        sessionStorage.setItem("kb_unlocked", "1");
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setDigits([]); }, 600);
      }
    }
  };

  const backspace = () => { setDigits(prev => prev.slice(0, -1)); };

  const keys = [1,2,3,4,5,6,7,8,9,null,0,"del"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f0f0f", zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif", gap: 48 }}>

      <div style={{ fontSize: 13, color: "#444", letterSpacing: "0.18em", textTransform: "uppercase" }}>
        Kingdom Builder
      </div>

      {/* Dot display */}
      <div style={{
        display: "flex", gap: 16, alignItems: "center",
        animation: shake ? "kb-shake 0.5s ease" : "none",
      }}>
        <style>{`
          @keyframes kb-shake {
            0%,100%{transform:translateX(0)}
            15%{transform:translateX(-8px)}
            30%{transform:translateX(8px)}
            45%{transform:translateX(-6px)}
            60%{transform:translateX(6px)}
            75%{transform:translateX(-3px)}
            90%{transform:translateX(3px)}
          }
        `}</style>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < digits.length ? "#8080ff" : "transparent",
            border: `2px solid ${i < digits.length ? "#8080ff" : "#2a2a2a"}`,
            transition: "background 0.1s, border-color 0.1s",
          }} />
        ))}
      </div>

      {/* Number pad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 72px)", gap: 12 }}>
        {keys.map((k, i) => {
          if (k === null) return <div key={i} />;
          const isDel = k === "del";
          return (
            <button key={i}
              onPointerDown={() => isDel ? backspace() : press(k)}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: isDel ? "transparent" : "#1a1a1a",
                border: isDel ? "none" : "1px solid #222",
                color: isDel ? "#555" : "#e2e2e2",
                fontSize: isDel ? 20 : 26,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
                userSelect: "none",
              }}>
              {isDel ? "⌫" : k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("kb_unlocked") === "1");
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
  const [editingEntry, setEditingEntry] = useState(null);

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
      // Balance = current week only (Sunday 00:00 through Saturday 23:59)
      const weekSunday = new Date();
      weekSunday.setDate(weekSunday.getDate() - weekSunday.getDay());
      weekSunday.setHours(0, 0, 0, 0);
      setBalance(data.filter(e => entryDate(e) >= weekSunday).reduce((sum, e) => sum + Number(e.change), 0));
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
    // Only affect the displayed balance if this entry falls in the current week
    const weekSundayNow = new Date();
    weekSundayNow.setDate(weekSundayNow.getDate() - weekSundayNow.getDay());
    weekSundayNow.setHours(0, 0, 0, 0);
    if (new Date(optimistic.ts) >= weekSundayNow) {
      setBalance((prev) => prev + optimistic.change);
    }
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
    // Only adjust balance if the deleted entry is in the current week
    const weekSundayDel = new Date();
    weekSundayDel.setDate(weekSundayDel.getDate() - weekSundayDel.getDay());
    weekSundayDel.setHours(0, 0, 0, 0);
    if (entryDate(target) >= weekSundayDel) {
      setBalance(prev => prev - Number(target.change));
    }
    await supabase.from("money_entries").delete().eq("id", id);
  };

  const updateEntry = async (id, newChange, newNote) => {
    const weekSundayUpd = new Date();
    weekSundayUpd.setDate(weekSundayUpd.getDate() - weekSundayUpd.getDay());
    weekSundayUpd.setHours(0, 0, 0, 0);

    const prev = entries.find(e => e.id === id);
    if (!prev) return;

    // Optimistically update local state
    setEntries(list => list.map(e => e.id === id ? { ...e, change: newChange, note: newNote } : e));
    // Adjust balance only if the entry is in the current week
    if (entryDate(prev) >= weekSundayUpd) {
      setBalance(b => b - Number(prev.change) + newChange);
    }

    await supabase.from("money_entries").update({ change: newChange, note: newNote }).eq("id", id);
  };

  const handleKey = (e) => { if (e.key === "Enter") apply(1); };

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  return (
    <>
    {editingEntry && (
      <EditEntryModal
        entry={editingEntry}
        onSave={updateEntry}
        onDelete={deleteEntry}
        onClose={() => setEditingEntry(null)}
      />
    )}
    {/* MENTOR_HIDDEN: {activeTab === "mentor" && <MentorChat />} */}
    {activeTab === "balance" && <div style={{ ...styles.root, paddingBottom: 90 }}>
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

        {!loading && entries.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>This Week</div>
            <ThisWeekLog entries={entries} now={now} onDelete={deleteEntry} onEdit={setEditingEntry} />
            <WeeklyLog entries={entries} now={now} onDelete={deleteEntry} onEdit={setEditingEntry} />
          </div>
        )}

        <div style={styles.resetWrap}>
          {!showReset ? (
            <button style={styles.resetBtn} onClick={() => setShowReset(true)}>Reset</button>
          ) : (
            <div style={styles.confirmRow}>
              <span style={styles.confirmText}>Wipe all entries?</span>
              <button style={{ ...styles.btn, ...styles.btnSub, fontSize: 13, padding: "6px 16px", flex: "none" }}
                onClick={reset} disabled={saving}>Yes, reset</button>
              <button style={{ ...styles.btn, background: "#1a1a1a", color: "#555", fontSize: 13, padding: "6px 16px", flex: "none" }}
                onClick={() => setShowReset(false)}>Cancel</button>
            </div>
          )}
        </div>

      </div>
    </div>}

    {/* Calendar tab */}
    {activeTab === "calendar" && (
      <CalendarView entries={entries} now={now} supabase={supabase} />
    )}

    {/* Countdown tab */}
    {activeTab === "countdown" && (
      <CountdownView supabase={supabase} />
    )}

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
        style={{ ...styles.tabBtn, color: activeTab === "countdown" ? "#8080ff" : "#3a3a3a" }}
        onClick={() => setActiveTab("countdown")}
      >
        <span style={styles.tabIcon}>◷</span>
        <span style={styles.tabLabel}>Countdown</span>
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
