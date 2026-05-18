import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { THEMES, ThemeContext, useTheme } from "./themes";
// MENTOR_HIDDEN: import MentorChat from "./MentorChat";

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const entryDate = (e) => { const t = new Date(e.ts); return isNaN(t) ? new Date(e.created_at) : t; };

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

const GLOBAL_CSS = `
  @keyframes kb-shake {
    0%,100%{transform:translateX(0)}
    15%{transform:translateX(-8px)} 30%{transform:translateX(8px)}
    45%{transform:translateX(-6px)} 60%{transform:translateX(6px)}
    75%{transform:translateX(-3px)} 90%{transform:translateX(3px)}
  }
  @keyframes kb-fade-in {
    from{opacity:0;transform:translateY(6px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes kb-slide-up {
    from{opacity:0;transform:translateY(40px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes kb-scale-in {
    from{opacity:0;transform:scale(0.94)}
    to{opacity:1;transform:scale(1)}
  }
  @keyframes kb-glow-pulse {
    0%,100%{opacity:0.55} 50%{opacity:1}
  }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { margin: 0; }
  .kb-btn {
    transition: transform 0.1s ease, opacity 0.12s ease, box-shadow 0.15s ease;
    user-select: none; cursor: pointer;
  }
  .kb-btn:active { transform: scale(0.95) !important; }
  .kb-fade-in { animation: kb-fade-in 0.22s ease both; }
  .kb-slide-up { animation: kb-slide-up 0.3s cubic-bezier(0.34,1.1,0.64,1) both; }
  .kb-scale-in { animation: kb-scale-in 0.18s ease both; }
  .kb-theme-transition, .kb-theme-transition * {
    transition: background-color 0.38s ease, color 0.38s ease,
      border-color 0.38s ease, box-shadow 0.38s ease !important;
  }
  input { appearance: none; -webkit-appearance: none; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: opacity(0.4); }
  ::-webkit-scrollbar { width: 0; }
`;

// ─── Shared style factory ────────────────────────────────────────────────────
function useStyles() {
  const t = useTheme();
  return {
    root: {
      minHeight: "100dvh",
      background: t.bgGradient,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "70px 20px 60px",
      fontFamily: "'Inter','Segoe UI',sans-serif",
    },
    card: {
      width: "100%",
      maxWidth: 480,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    surface: {
      background: t.surface,
      borderRadius: t.cardRadius,
      border: `1px solid ${t.border}`,
      boxShadow: t.shadow,
    },
    surface2: {
      background: t.surface2,
      borderRadius: t.selRadius,
      border: `1px solid ${t.border}`,
    },
    input: {
      background: t.inputBg,
      border: `1px solid ${t.inputBorder}`,
      borderRadius: t.inputRadius,
      color: t.text,
      fontSize: 18,
      padding: "12px 16px",
      outline: "none",
      width: "100%",
    },
    noteInput: {
      fontSize: 14,
      padding: "9px 16px",
      color: t.textMuted,
    },
    btn: {
      flex: 1,
      border: "none",
      borderRadius: t.btnRadius,
      fontSize: 16,
      fontWeight: 600,
      padding: "13px 0",
      cursor: "pointer",
      fontFamily: "'Inter','Segoe UI',sans-serif",
    },
    btnAdd: {
      background: t.positiveSoft,
      color: t.positive,
      boxShadow: `0 2px 8px ${t.positiveSoft}`,
    },
    btnSub: {
      background: t.negativeSoft,
      color: t.negative,
      boxShadow: `0 2px 8px ${t.negativeSoft}`,
    },
    tabBar: {
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: 56,
      paddingBottom: "env(safe-area-inset-bottom,6px)",
      background: t.tabBg,
      borderTop: `1px solid ${t.tabBorder}`,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
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
      fontFamily: "'Inter','Segoe UI',sans-serif",
      transition: "color 0.2s ease",
    },
    errorBox: {
      background: t.negativeSoft,
      border: `1px solid ${t.negative}30`,
      borderRadius: t.selRadius,
      color: t.negative,
      fontSize: 12,
      padding: "8px 12px",
    },
    sectionLabel: {
      fontSize: 10,
      color: t.textFaint,
      letterSpacing: "0.13em",
      textTransform: "uppercase",
      marginBottom: 6,
      fontWeight: 500,
    },
    resetBtn: {
      background: "none",
      border: `1px solid ${t.border2}`,
      borderRadius: t.selRadius,
      color: t.textFaint,
      fontSize: 13,
      padding: "7px 20px",
      cursor: "pointer",
    },
    chevron: {
      background: "none",
      border: "none",
      color: t.textFaint,
      fontSize: 20,
      cursor: "pointer",
      padding: "2px 6px",
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      transition: "transform 0.18s ease",
      fontFamily: "sans-serif",
    },
    deleteBtn: {
      background: "none",
      border: "none",
      color: t.deleteColor,
      fontSize: 18,
      cursor: "pointer",
      padding: "4px 6px",
      lineHeight: 1,
    },
  };
}

// ─── WeeklyChart ─────────────────────────────────────────────────────────────
function WeeklyChart({ entries, now, selectedDay, onSelectDay }) {
  const t = useTheme();
  const dragRef = useRef({ y: 0, moved: false });
  const days = ["S","M","T","W","T","F","S"];
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);

  const balances = days.map((_, i) => {
    if (i > dow) return null;
    const dayStart = new Date(weekStart); dayStart.setDate(weekStart.getDate() + i); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(weekStart); dayEnd.setDate(weekStart.getDate() + i); dayEnd.setHours(23,59,59,999);
    return entries.filter(e => { const ts = entryDate(e); return ts >= dayStart && ts <= dayEnd; })
      .reduce((s, e) => s + Number(e.change), 0);
  });

  const validVals = balances.filter(v => v !== null);
  if (validVals.length === 0) return null;

  const W = 300, H = 90;
  const padLeft = 42, padRight = 8, padTop = 8, padBot = 6;
  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBot;

  const rawMax = Math.max(...validVals, 0);
  const rawMin = Math.min(...validVals, 0);
  const pad = Math.max(rawMax * 0.2, Math.abs(rawMin) * 0.2, 8);
  const displayMax = rawMax + pad;
  const displayMin = rawMin - pad;
  const range = displayMax - displayMin;

  const toY = v => padTop + innerH - ((v - displayMin) / range) * innerH;
  const toX = i => padLeft + (i / 6) * innerW;

  const pts = balances.map((v, i) => v !== null ? { x: toX(i), y: toY(v), v, i } : null).filter(Boolean);
  const zeroY = toY(0);
  const lp = smoothPath(pts);
  const areaPath = lp ? `${lp} L${pts[pts.length-1].x},${zeroY} L${pts[0].x},${zeroY} Z` : "";
  const selectedDow = selectedDay ? selectedDay.getDay() : null;

  const fmtShort = v => Math.abs(v) >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${Math.round(v)}`;

  const handleTap = i => {
    if (i > dow) return;
    if (selectedDow === i) { onSelectDay(null); return; }
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    onSelectDay(d);
  };

  return (
    <div style={{ width: "100%", marginTop: 10, marginBottom: 2 }}>
      <svg viewBox={`0 0 ${W} ${H+24}`} style={{ width: "100%", overflow: "visible" }}>
        <defs>
          <clipPath id="clip-above"><rect x={0} y={0} width={W} height={zeroY} /></clipPath>
          <clipPath id="clip-below"><rect x={0} y={zeroY} width={W} height={H+24} /></clipPath>
        </defs>

        {[rawMax, (rawMin+rawMax)/2, rawMin].map((val, idx) => {
          const y = toY(val);
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={W-padRight} y2={y} stroke={t.chartGrid} strokeWidth={1} />
              <text x={padLeft-5} y={y+3.5} textAnchor="end" fontSize={9}
                fontFamily="Inter,Segoe UI,sans-serif" fill={t.textFaint}>
                {fmtShort(val)}
              </text>
            </g>
          );
        })}

        <line x1={padLeft} y1={zeroY} x2={W-padRight} y2={zeroY}
          stroke={t.chartZero} strokeWidth={1} strokeDasharray="3 3" />

        {areaPath && <path d={areaPath} fill={t.positiveArea} clipPath="url(#clip-above)" />}
        {areaPath && <path d={areaPath} fill={t.negativeArea} clipPath="url(#clip-below)" />}
        {lp && <path d={lp} fill="none" stroke={t.chartLine} strokeWidth={1.5} strokeLinecap="round" clipPath="url(#clip-above)" />}
        {lp && <path d={lp} fill="none" stroke={t.chartNeg} strokeWidth={1.5} strokeLinecap="round" clipPath="url(#clip-below)" />}

        {days.map((label, i) => {
          const x = toX(i);
          const pt = pts.find(p => p.i === i);
          const isToday = i === dow;
          const isSelected = selectedDow === i;
          const isFuture = i > dow;
          return (
            <g key={i}
              onPointerDown={e => { dragRef.current = { y: e.clientY, moved: false }; }}
              onPointerMove={e => { if (Math.abs(e.clientY - dragRef.current.y) > 12) dragRef.current.moved = true; }}
              onPointerCancel={() => { dragRef.current.moved = true; }}
              onPointerUp={() => { if (!dragRef.current.moved) handleTap(i); }}
              style={{ cursor: isFuture ? "default" : "pointer" }}>
              <rect x={x-14} y={0} width={28} height={H+24} fill="rgba(0,0,0,0.01)" />
              {pt ? (
                <circle cx={x} cy={pt.y}
                  r={isSelected ? 6 : isToday ? 5 : 3}
                  fill={isSelected ? t.text : isToday ? t.dot : t.dotEmpty}
                  stroke={isSelected ? t.text : isToday ? t.dot : t.dotStroke}
                  strokeWidth={1.5}
                />
              ) : !isFuture ? (
                <circle cx={x} cy={zeroY} r={3}
                  fill={t.dotEmpty} stroke={isSelected ? t.text : t.dotStroke} strokeWidth={1} />
              ) : null}
              <text x={x} y={H+20} textAnchor="middle" fontSize={10}
                fontFamily="Inter,Segoe UI,sans-serif"
                fill={isSelected ? t.text : isToday ? t.accent : isFuture ? t.border2 : t.textFaint}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── EntryRow ────────────────────────────────────────────────────────────────
function EntryRow({ entry, onDelete, onEdit, showBorder }) {
  const t = useTheme();
  const s = useStyles();
  const isNeg = Number(entry.change) < 0;
  const tapRef = useRef({ x: 0, y: 0, moved: false });

  return (
    <div
      onPointerDown={e => { tapRef.current = { x: e.clientX, y: e.clientY, moved: false }; }}
      onPointerMove={e => {
        const dx = e.clientX - tapRef.current.x, dy = e.clientY - tapRef.current.y;
        if (Math.sqrt(dx*dx+dy*dy) >= 8) tapRef.current.moved = true;
      }}
      onPointerCancel={() => { tapRef.current.moved = true; }}
      onPointerUp={e => {
        if (tapRef.current.moved) return;
        const dx = e.clientX - tapRef.current.x, dy = e.clientY - tapRef.current.y;
        if (Math.sqrt(dx*dx+dy*dy) < 8) onEdit(entry);
      }}
      style={{ padding: "8px 14px", borderTop: showBorder ? `1px solid ${t.border}` : "none",
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: isNeg ? t.negative : t.positive }}>
          {isNeg ? "" : "+"}{fmt(Number(entry.change))}
        </span>
        {entry.note && <span style={{ fontSize: 11, color: t.textMuted }}>{entry.note}</span>}
      </div>
      <span style={{ fontSize: 11, color: t.textFaint }}>
        {entryDate(entry).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
      <button
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => { e.stopPropagation(); onDelete(entry.id); }}
        style={s.deleteBtn}>×</button>
    </div>
  );
}

// ─── ThisWeekLog ──────────────────────────────────────────────────────────────
function ThisWeekLog({ entries, now, onDelete, onEdit }) {
  const t = useTheme();
  const s = useStyles();
  const [expanded, setExpanded] = useState(null);
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dow);
  weekStart.setHours(0,0,0,0);

  const days = [];
  for (let i = 0; i <= dow; i++) {
    const dayStart = new Date(weekStart); dayStart.setDate(weekStart.getDate()+i); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(weekStart); dayEnd.setDate(weekStart.getDate()+i); dayEnd.setHours(23,59,59,999);
    const items = entries.filter(e => { const ts = entryDate(e); return ts >= dayStart && ts <= dayEnd; });
    if (!items.length) continue;
    const net = items.reduce((sum, e) => sum + Number(e.change), 0);
    days.push({ key: dayStart.toLocaleDateString("en-CA"), name: dayNames[i], items, net });
  }
  if (!days.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {[...days].reverse().map(({ key, name, items, net }) => {
        const isOpen = expanded === key;
        return (
          <div key={key} className="kb-fade-in">
            <div onClick={() => setExpanded(isOpen ? null : key)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                background: t.surface, padding: "10px 14px", cursor: "pointer",
                borderRadius: isOpen ? `${t.cardRadius}px ${t.cardRadius}px 0 0` : t.cardRadius,
                border: `1px solid ${t.border}`,
                borderBottom: isOpen ? `1px solid ${t.border}` : `1px solid ${t.border}`,
                boxShadow: t.shadow }}>
              <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>{name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: net < 0 ? t.negative : t.positive }}>
                  {net > 0 ? "+" : ""}{fmt(net)}
                </span>
                <span style={{ ...s.chevron, transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ background: t.surface2, borderRadius: `0 0 ${t.cardRadius}px ${t.cardRadius}px`,
                border: `1px solid ${t.border}`, borderTop: "none" }}>
                {[...items].sort((a,b) => entryDate(b)-entryDate(a)).map((e,i) => (
                  <EntryRow key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} showBorder={i>0} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── WeeklyLog ────────────────────────────────────────────────────────────────
function WeeklyLog({ entries, now, onDelete, onEdit }) {
  const t = useTheme();
  const s = useStyles();
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const sundayOf = d => {
    const s2 = new Date(d); s2.setDate(d.getDate()-d.getDay()); s2.setHours(0,0,0,0); return s2;
  };
  const weekKey = d => sundayOf(d).toLocaleDateString("en-CA");
  const weekLabel = d => {
    const s2 = sundayOf(d);
    return `${s2.toLocaleDateString("en-US",{month:"long"})} Week ${Math.floor((s2.getDate()-1)/7)+1}`;
  };

  const calWeekStart = sundayOf(now);
  const past = entries.filter(e => entryDate(e) < calWeekStart);
  if (!past.length) return null;

  const groups = {};
  past.forEach(e => {
    const d = entryDate(e), k = weekKey(d);
    if (!groups[k]) groups[k] = { label: weekLabel(d), sunday: sundayOf(d), items: [], net: 0 };
    groups[k].items.push(e);
    groups[k].net += Number(e.change);
  });

  const weeks = Object.entries(groups).sort(([a],[b]) => b.localeCompare(a));

  const toggleDay = (wk, dk) => {
    const c = `${wk}|${dk}`;
    setExpandedDays(prev => ({ ...prev, [c]: !prev[c] }));
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={s.sectionLabel}>Weekly</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {weeks.map(([k, { label, sunday, items, net }]) => {
          const isOpen = expandedWeek === k;

          const dayMap = {};
          items.forEach(e => {
            const d = entryDate(e), dk = d.toLocaleDateString("en-CA");
            if (!dayMap[dk]) dayMap[dk] = [];
            dayMap[dk].push(e);
          });

          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(sunday); date.setDate(sunday.getDate()+i);
            const dk = date.toLocaleDateString("en-CA");
            const dayEntries = dayMap[dk] || [];
            const dayNet = dayEntries.reduce((sum, e) => sum + Number(e.change), 0);
            return { name: DAY_NAMES[i], dk, dayEntries, dayNet };
          });

          return (
            <div key={k}>
              <div onClick={() => {
                setExpandedWeek(isOpen ? null : k);
                if (isOpen) setExpandedDays(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(key => { if (key.startsWith(`${k}|`)) delete next[key]; });
                  return next;
                });
              }}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: t.surface, padding: "10px 14px", cursor: "pointer",
                  borderRadius: isOpen ? `${t.cardRadius}px ${t.cardRadius}px 0 0` : t.cardRadius,
                  border: `1px solid ${t.border}`,
                  boxShadow: t.shadow }}>
                <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: net < 0 ? t.negative : t.positive }}>
                    {net > 0 ? "+" : ""}{fmt(net)}
                  </span>
                  <span style={{ ...s.chevron, transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ background: t.surface2, borderRadius: `0 0 ${t.cardRadius}px ${t.cardRadius}px`,
                  border: `1px solid ${t.border}`, borderTop: "none", overflow: "hidden" }}>
                  {weekDays.map(({ name, dk, dayEntries, dayNet }, di) => {
                    const composite = `${k}|${dk}`;
                    const isDayOpen = !!expandedDays[composite];
                    const hasEntries = dayEntries.length > 0;
                    return (
                      <div key={dk} style={{ borderTop: di > 0 ? `1px solid ${t.border}` : "none" }}>
                        <div onClick={() => hasEntries && toggleDay(k, dk)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "9px 14px", cursor: hasEntries ? "pointer" : "default" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: hasEntries ? t.textMuted : t.textFaint,
                              letterSpacing: "0.07em", textTransform: "uppercase", minWidth: 72 }}>
                              {name}
                            </span>
                            {hasEntries && (
                              <span style={{ fontSize: 11, color: t.textFaint }}>
                                {dayEntries.length} {dayEntries.length === 1 ? "txn" : "txns"}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {hasEntries ? (
                              <>
                                <span style={{ fontSize: 13, fontWeight: 600, color: dayNet < 0 ? t.negative : t.positive }}>
                                  {dayNet > 0 ? "+" : ""}{fmt(dayNet)}
                                </span>
                                <span style={{ ...s.chevron, fontSize: 16,
                                  transform: isDayOpen ? "rotate(90deg)" : "none" }}>›</span>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: t.textFaint }}>—</span>
                            )}
                          </div>
                        </div>
                        {isDayOpen && hasEntries && (
                          <div style={{ background: t.surface3 || t.surface2 }}>
                            {[...dayEntries].sort((a,b) => entryDate(b)-entryDate(a)).map((e,i) => (
                              <EntryRow key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} showBorder={i>0} />
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

// ─── EditEntryModal ──────────────────────────────────────────────────────────
function EditEntryModal({ entry, onSave, onDelete, onClose }) {
  const t = useTheme();
  const s = useStyles();
  const [amount, setAmount] = useState(String(Math.abs(Number(entry.change))));
  const [note, setNote] = useState(entry.note || "");
  const [saving, setSaving] = useState(false);
  const isNeg = Number(entry.change) < 0;

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) return;
    setSaving(true);
    await onSave(entry.id, isNeg ? -val : val, note.trim() || null);
    setSaving(false); onClose();
  };

  const handleDelete = async () => {
    setSaving(true);
    await onDelete(entry.id);
    setSaving(false); onClose();
  };

  return (
    <div onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: t.modalBg, zIndex: 500,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div className="kb-slide-up"
        style={{ width: "100%", maxWidth: 480, background: t.surface,
          borderRadius: `${t.cardRadius*1.2}px ${t.cardRadius*1.2}px 0 0`,
          padding: "20px 20px 40px",
          border: `1px solid ${t.border}`, borderBottom: "none",
          boxShadow: t.shadow2,
          display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: t.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            Edit Transaction
          </span>
          <button onPointerDown={onClose}
            style={{ background: "none", border: "none", color: t.textFaint, fontSize: 22, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: 11, color: t.textFaint }}>
          {entryDate(entry).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}
          {" · "}
          {entryDate(entry).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
        </div>

        <input style={{ ...s.input }} type="number" inputMode="decimal"
          placeholder="0.00" value={amount} min="0" disabled={saving}
          onChange={e => setAmount(e.target.value)} />

        <input style={{ ...s.input, ...s.noteInput }} type="text"
          placeholder="Note (optional)" value={note} maxLength={80} disabled={saving}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }} />

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="kb-btn" onPointerDown={handleSave} disabled={saving}
            style={{ ...s.btn, ...(isNeg ? s.btnSub : s.btnAdd), opacity: saving ? 0.5 : 1 }}>
            Save
          </button>
          <button className="kb-btn" onPointerDown={handleDelete} disabled={saving}
            style={{ flex: "none", border: `1px solid ${t.negativeSoft}`, borderRadius: t.btnRadius,
              fontSize: 15, fontWeight: 600, padding: "13px 20px", cursor: saving ? "default" : "pointer",
              background: "transparent", color: t.negative, opacity: saving ? 0.5 : 1,
              fontFamily: "'Inter','Segoe UI',sans-serif" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────
function CalendarView({ entries, now }) {
  const t = useTheme();
  const s = useStyles();
  const [subs, setSubs] = useState([]);
  const [calLoading, setCalLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subDay, setSubDay] = useState("");
  const [subSaving, setSubSaving] = useState(false);

  const todayDate = now.getDate();

  useEffect(() => { fetchSubs(); }, []);

  const fetchSubs = async () => {
    setCalLoading(true);
    const { data } = await supabase.from("subscriptions").select("*").order("day_of_month",{ascending:true});
    if (data) setSubs(data);
    setCalLoading(false);
  };

  const runAutoDeductions = async (subsToCheck) => {
    const todayNum = now.getDate();
    const due = subsToCheck.filter(s2 => s2.day_of_month === todayNum);
    if (!due.length) return;
    const todayStr = now.toLocaleDateString("en-CA");
    const { data: todayEntries } = await supabase.from("money_entries").select("*")
      .gte("ts",`${todayStr}T00:00:00`).lte("ts",`${todayStr}T23:59:59`);
    for (const sub of due) {
      const already = (todayEntries||[]).some(e => e.note === sub.name && Number(e.change) === -Math.abs(Number(sub.amount)));
      if (!already) await supabase.from("money_entries").insert({
        change: -Math.abs(Number(sub.amount)), note: sub.name,
        ts: new Date().toISOString(), created_at: new Date().toISOString(),
      });
    }
  };

  useEffect(() => { if (!calLoading && subs.length > 0) runAutoDeductions(subs); }, [calLoading]);

  const addSub = async () => {
    const name = subName.trim(), amount = parseFloat(subAmount), day = parseInt(subDay,10);
    if (!name || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) return;
    setSubSaving(true);
    const { data } = await supabase.from("subscriptions").insert({ name, amount, day_of_month: day }).select().single();
    if (data) {
      const newSubs = [...subs, data].sort((a,b) => a.day_of_month - b.day_of_month);
      setSubs(newSubs);
      if (day === now.getDate()) {
        const todayStr = now.toLocaleDateString("en-CA");
        const { data: te } = await supabase.from("money_entries").select("*")
          .gte("ts",`${todayStr}T00:00:00`).lte("ts",`${todayStr}T23:59:59`);
        const already = (te||[]).some(e => e.note === name && Number(e.change) === -Math.abs(amount));
        if (!already) await supabase.from("money_entries").insert({
          change: -Math.abs(amount), note: name, ts: new Date().toISOString(), created_at: new Date().toISOString(),
        });
      }
    }
    setSubName(""); setSubAmount(""); setSubDay(""); setSubSaving(false);
  };

  const deleteSub = async id => {
    await supabase.from("subscriptions").delete().eq("id",id);
    setSubs(prev => prev.filter(s2 => s2.id !== id));
    if (selectedDay !== null) {
      const remaining = subs.filter(s2 => s2.id !== id && s2.day_of_month === selectedDay);
      if (!remaining.length) setSelectedDay(null);
    }
  };

  const year = now.getFullYear(), month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();

  const subsByDay = {};
  subs.forEach(s2 => {
    const d = s2.day_of_month;
    if (!subsByDay[d]) subsByDay[d] = [];
    subsByDay[d].push(s2);
  });

  const dotLayouts = {
    1:[[0,0]], 2:[[-3,0],[3,0]], 3:[[-4,0],[0,0],[4,0]],
    4:[[-4,-2],[0,-2],[4,-2],[0,2]], 5:[[-4,-2],[0,-2],[4,-2],[-2,2],[2,2]],
    6:[[-4,-2],[0,-2],[4,-2],[-4,2],[0,2],[4,2]],
  };

  const selectedSubs = selectedDay !== null ? (subsByDay[selectedDay] || []) : [];
  const upcomingTotal = subs.filter(s2 => s2.day_of_month >= todayDate).reduce((sum,s2) => sum+Number(s2.amount),0);
  const monthLabel = now.toLocaleDateString("en-US",{month:"long",year:"numeric"});
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ ...s.root, paddingBottom: 90 }}>
      <div style={s.card}>

        <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, letterSpacing: "0.01em", marginBottom: 4 }}>
          {monthLabel}
        </div>

        {/* Calendar grid */}
        <div style={{ background: t.surface, borderRadius: t.cardRadius, padding: "12px 10px 10px",
          border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
            {["S","M","T","W","T","F","S"].map((d,i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10, color: t.textFaint, fontWeight: 600, letterSpacing: "0.08em" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px 2px" }}>
            {cells.map((d,i) => {
              if (d === null) return <div key={`e${i}`} />;
              const isPast = d < todayDate, isToday = d === todayDate;
              const isSelected = selectedDay === d;
              const dotList = subsByDay[d] || [];
              const dotCount = Math.min(dotList.length, 6);
              const layout = dotLayouts[dotCount] || [];
              return (
                <div key={d} onClick={() => setSelectedDay(isSelected ? null : d)}
                  style={{ position: "relative", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", height: 40, borderRadius: t.selRadius,
                    cursor: dotCount > 0 ? "pointer" : "default",
                    background: isSelected ? t.accentSoft : "transparent",
                    border: isToday ? `1px solid ${t.accent}` : isSelected ? `1px solid ${t.border2}` : "1px solid transparent",
                    transition: "background 0.15s ease",
                  }}>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400,
                    color: isToday ? t.accent : isPast ? t.textFaint : t.text,
                    lineHeight: 1, marginBottom: dotCount > 0 ? 2 : 0 }}>
                    {d}
                  </span>
                  {dotCount > 0 && (
                    <div style={{ position: "relative", height: 8, width: 24 }}>
                      {layout.map(([ox,oy],di) => (
                        <div key={di} style={{ position: "absolute", width: 4, height: 4,
                          borderRadius: "50%", background: t.billingAccent,
                          left: "50%", top: "50%",
                          transform: `translate(calc(-50% + ${ox}px),calc(-50% + ${oy}px))` }} />
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
          <div className="kb-fade-in" style={{ background: t.surface2, border: `1px solid ${t.border}`,
            borderRadius: t.cardRadius, padding: "12px 14px", boxShadow: t.shadow }}>
            <div style={{ fontSize: 11, color: t.textMuted, letterSpacing: "0.1em", textTransform: "uppercase",
              marginBottom: 8, fontWeight: 500 }}>
              {now.toLocaleDateString("en-US",{month:"long"})} {selectedDay}
            </div>
            {selectedSubs.length === 0 ? (
              <div style={{ fontSize: 13, color: t.textFaint }}>No subscriptions on this day</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedSubs.map(sub => (
                  <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 14, color: t.text }}>{sub.name}</span>
                      <span style={{ fontSize: 12, color: t.billingAccent }}>{fmt(sub.amount)}/mo</span>
                    </div>
                    <button onClick={() => deleteSub(sub.id)}
                      style={{ background: "none", border: "none", color: t.deleteColor, fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming total */}
        {subs.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            background: t.surface, borderRadius: t.selRadius, padding: "10px 14px",
            border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
            <span style={{ fontSize: 11, color: t.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>
              Upcoming this month
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: t.billingAccent }}>{fmt(upcomingTotal)}</span>
          </div>
        )}

        {/* Add subscription */}
        <div style={{ background: t.surface, borderRadius: t.cardRadius, padding: "14px",
          display: "flex", flexDirection: "column", gap: 8, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={s.sectionLabel}>Add Subscription</div>
          <input style={{ ...s.input, fontSize: 14 }} type="text" placeholder="Name (e.g. Netflix)"
            value={subName} maxLength={60} disabled={subSaving} onChange={e => setSubName(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, fontSize: 14, flex: 2 }} type="number" inputMode="decimal"
              placeholder="Amount" value={subAmount} min="0" disabled={subSaving} onChange={e => setSubAmount(e.target.value)} />
            <input style={{ ...s.input, fontSize: 14, flex: 1 }} type="number" inputMode="numeric"
              placeholder="Day" value={subDay} min="1" max="31" disabled={subSaving} onChange={e => setSubDay(e.target.value)} />
          </div>
          <button className="kb-btn" onClick={addSub} disabled={subSaving}
            style={{ ...s.btn, background: t.accentSoft, color: t.accent, fontSize: 14,
              padding: "10px 0", opacity: subSaving ? 0.5 : 1 }}>
            + Add Subscription
          </button>
        </div>

        {/* Active subscriptions */}
        {!calLoading && subs.length > 0 && (
          <div>
            <div style={s.sectionLabel}>Active Subscriptions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {subs.map(sub => (
                <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: t.surface, borderRadius: t.selRadius, padding: "9px 14px",
                  border: `1px solid ${t.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: t.billingAccent, fontWeight: 600, minWidth: 24, textAlign: "right" }}>
                      {sub.day_of_month}
                    </span>
                    <span style={{ fontSize: 14, color: t.text }}>{sub.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: t.negative }}>-{fmt(sub.amount)}</span>
                    <button onClick={() => deleteSub(sub.id)}
                      style={{ background: "none", border: "none", color: t.deleteColor, fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {calLoading && (
          <div style={{ fontSize: 13, color: t.textFaint, textAlign: "center", padding: "20px 0" }}>Loading…</div>
        )}
      </div>
    </div>
  );
}

// ─── EditCountdownModal ───────────────────────────────────────────────────────
function EditCountdownModal({ countdown, onSave, onClose }) {
  const t = useTheme();
  const s = useStyles();
  const existing = new Date(countdown.due_at);
  const pad2 = n => String(n).padStart(2,"0");
  const [label, setLabel] = useState(countdown.label);
  const [dueDate, setDueDate] = useState(`${existing.getFullYear()}-${pad2(existing.getMonth()+1)}-${pad2(existing.getDate())}`);
  const [dueTime, setDueTime] = useState(`${pad2(existing.getHours())}:${pad2(existing.getMinutes())}`);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimLabel = label.trim();
    if (!trimLabel || !dueDate) return;
    const due = new Date(`${dueDate}T${dueTime||"00:00"}:00`);
    if (isNaN(due.getTime())) return;
    setSaving(true);
    await onSave(countdown.id, trimLabel, due.toISOString());
    setSaving(false); onClose();
  };

  return (
    <div onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: t.modalBg, zIndex: 500,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div className="kb-slide-up"
        style={{ width: "100%", maxWidth: 480, background: t.surface,
          borderRadius: `${t.cardRadius*1.2}px ${t.cardRadius*1.2}px 0 0`,
          padding: "20px 20px 40px",
          border: `1px solid ${t.border}`, borderBottom: "none",
          boxShadow: t.shadow2,
          display: "flex", flexDirection: "column", gap: 12 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: t.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
            Edit Countdown
          </span>
          <button onPointerDown={onClose}
            style={{ background: "none", border: "none", color: t.textFaint, fontSize: 22, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <input style={{ ...s.input, fontSize: 15 }} type="text" placeholder="Event name"
          value={label} maxLength={80} disabled={saving} onChange={e => setLabel(e.target.value)} />

        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...s.input, fontSize: 14, flex: 3 }} type="date"
            value={dueDate} disabled={saving} onChange={e => setDueDate(e.target.value)} />
          <input style={{ ...s.input, fontSize: 14, flex: 2 }} type="time"
            value={dueTime} disabled={saving} onChange={e => setDueTime(e.target.value)} />
        </div>

        <button className="kb-btn" onPointerDown={handleSave}
          disabled={saving || !label.trim() || !dueDate}
          style={{ ...s.btn, background: t.accentSoft, color: t.countdownAccent, fontSize: 15,
            opacity: (saving || !label.trim() || !dueDate) ? 0.4 : 1 }}>
          Save
        </button>
      </div>
    </div>
  );
}

// ─── CountdownView ────────────────────────────────────────────────────────────
function CountdownView() {
  const t = useTheme();
  const s = useStyles();
  const [countdowns, setCountdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const [editingCountdown, setEditingCountdown] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setTick(x => x+1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { fetchCountdowns(); }, []);

  const fetchCountdowns = async () => {
    setLoading(true);
    const { data } = await supabase.from("countdowns").select("*").order("due_at",{ascending:true});
    if (data) setCountdowns(data);
    setLoading(false);
  };

  const addCountdown = async () => {
    const trimLabel = label.trim();
    if (!trimLabel || !dueDate) return;
    const due = new Date(`${dueDate}T${dueTime||"00:00"}:00`);
    if (isNaN(due.getTime())) return;
    setSaving(true);
    const { data, error } = await supabase.from("countdowns")
      .insert({ label: trimLabel, due_at: due.toISOString() }).select().single();
    if (data) {
      setCountdowns(prev => [...prev, data].sort((a,b) => new Date(a.due_at)-new Date(b.due_at)));
      setLabel(""); setDueDate(""); setDueTime("");
    } else if (error) {
      alert("Could not save. Make sure the 'countdowns' table exists in Supabase.");
    }
    setSaving(false);
  };

  const deleteCountdown = async id => {
    setCountdowns(prev => prev.filter(c => c.id !== id));
    await supabase.from("countdowns").delete().eq("id",id);
  };

  const updateCountdown = async (id, newLabel, newDueAt) => {
    setCountdowns(prev =>
      prev.map(c => c.id === id ? {...c, label: newLabel, due_at: newDueAt} : c)
        .sort((a,b) => new Date(a.due_at)-new Date(b.due_at))
    );
    await supabase.from("countdowns").update({ label: newLabel, due_at: newDueAt }).eq("id",id);
  };

  const formatRemaining = due_at => {
    const diff = new Date(due_at) - new Date();
    if (diff <= 0) return { expired: true };
    const totalMins = Math.floor(diff / 60000);
    return {
      expired: false,
      days: Math.floor(totalMins / 1440),
      hours: Math.floor((totalMins % 1440) / 60),
      mins: totalMins % 60,
    };
  };

  const fmtDueDate = due_at => {
    const d = new Date(due_at);
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) +
      " at " + d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  };

  const totalMs = (due_at, created_at) => {
    const c = created_at ? new Date(created_at) : new Date(new Date(due_at) - 30*24*60*60*1000);
    return Math.max(1, new Date(due_at) - c);
  };

  return (
    <>
    {editingCountdown && (
      <EditCountdownModal countdown={editingCountdown} onSave={updateCountdown} onClose={() => setEditingCountdown(null)} />
    )}
    <div style={{ ...s.root, paddingBottom: 90 }}>
      <div style={s.card}>

        <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, letterSpacing: "0.01em", marginBottom: 4 }}>
          Countdowns
        </div>

        {/* Add form */}
        <div style={{ background: t.surface, borderRadius: t.cardRadius, padding: "14px",
          display: "flex", flexDirection: "column", gap: 8,
          border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={s.sectionLabel}>New Countdown</div>
          <input style={{ ...s.input, fontSize: 14 }} type="text"
            placeholder="Event name (e.g. Jiu Jitsu Competition)"
            value={label} maxLength={80} disabled={saving}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addCountdown(); }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, fontSize: 14, flex: 3 }} type="date"
              value={dueDate} disabled={saving} onChange={e => setDueDate(e.target.value)} />
            <input style={{ ...s.input, fontSize: 14, flex: 2 }} type="time"
              value={dueTime} disabled={saving} onChange={e => setDueTime(e.target.value)} />
          </div>
          <button className="kb-btn" onClick={addCountdown}
            disabled={saving || !label.trim() || !dueDate}
            style={{ ...s.btn, background: t.accentSoft, color: t.countdownAccent, fontSize: 14,
              padding: "10px 0", opacity: (saving || !label.trim() || !dueDate) ? 0.4 : 1 }}>
            + Add Countdown
          </button>
        </div>

        {/* Cards */}
        {loading ? (
          <div style={{ fontSize: 13, color: t.textFaint, textAlign: "center", padding: "20px 0" }}>Loading…</div>
        ) : countdowns.length === 0 ? (
          <div style={{ fontSize: 13, color: t.textFaint, textAlign: "center", padding: "20px 0" }}>No countdowns yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {countdowns.map(c => {
              const rem = formatRemaining(c.due_at);
              const pct = rem.expired ? 1 : Math.max(0, 1 - (new Date(c.due_at)-new Date()) / totalMs(c.due_at, c.created_at));

              return (
                <div key={c.id} className="kb-fade-in"
                  onClick={() => setEditingCountdown(c)}
                  style={{ background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: t.cardRadius, padding: "16px 14px 14px",
                    cursor: "pointer", boxShadow: t.shadow,
                    transition: "box-shadow 0.2s ease" }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text, flex: 1, paddingRight: 8 }}>
                      {c.label}
                    </span>
                    <button onClick={e => { e.stopPropagation(); deleteCountdown(c.id); }}
                      style={{ background: "none", border: "none", color: t.deleteColor, fontSize: 18,
                        cursor: "pointer", padding: "0 0 0 6px", lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>

                  <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 12 }}>{fmtDueDate(c.due_at)}</div>

                  {rem.expired ? (
                    <div style={{ fontSize: 13, color: t.textFaint, fontStyle: "italic" }}>Expired</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        {[{val:rem.days,unit:"days"},{val:rem.hours,unit:"hrs"},{val:rem.mins,unit:"min"}].map(({val,unit}) => (
                          <div key={unit} style={{ flex: 1, background: t.surface2, borderRadius: t.selRadius,
                            padding: "10px 0", textAlign: "center", border: `1px solid ${t.border}` }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: t.countdownAccent,
                              fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                              {val}
                            </div>
                            <div style={{ fontSize: 9, color: t.textFaint, letterSpacing: "0.1em",
                              textTransform: "uppercase", marginTop: 2 }}>{unit}</div>
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 3, background: t.border2, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct*100}%`,
                          background: t.countdownAccent, borderRadius: 2,
                          transition: "width 0.8s ease" }} />
                      </div>
                    </>
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

// ─── PinLock ──────────────────────────────────────────────────────────────────
const CORRECT_PIN = "0204";
function PinLock({ onUnlock }) {
  const t = useTheme();
  const [digits, setDigits] = useState([]);
  const [shake, setShake] = useState(false);

  const press = d => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      if (next.join("") === CORRECT_PIN) {
        sessionStorage.setItem("kb_unlocked","1");
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setDigits([]); }, 600);
      }
    }
  };

  const keys = [1,2,3,4,5,6,7,8,9,null,0,"del"];

  return (
    <div style={{ position: "fixed", inset: 0, background: t.bgGradient, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Segoe UI',sans-serif", gap: 48 }}>

      <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>
        Kingdom Builder
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center",
        animation: shake ? "kb-shake 0.5s ease" : "none" }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%",
            background: i < digits.length ? t.pinDot : t.pinDotEmpty,
            border: `2px solid ${i < digits.length ? t.pinDot : t.pinDotBorder}`,
            transition: "background 0.1s, border-color 0.1s",
            boxShadow: i < digits.length ? `0 0 8px ${t.pinDot}60` : "none",
          }} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,72px)", gap: 12 }}>
        {keys.map((k,i) => {
          if (k === null) return <div key={i} />;
          const isDel = k === "del";
          return (
            <button key={i} className="kb-btn" onPointerDown={() => isDel ? setDigits(p => p.slice(0,-1)) : press(k)}
              style={{ width: 72, height: 72, borderRadius: "50%",
                background: isDel ? "transparent" : t.surface,
                border: isDel ? "none" : `1px solid ${t.border2}`,
                color: isDel ? t.textFaint : t.text,
                fontSize: isDel ? 20 : 26, fontWeight: 500,
                cursor: "pointer", fontFamily: "'Inter','Segoe UI',sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isDel ? "none" : t.shadow,
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


// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [themeId, setThemeId] = useState(() => localStorage.getItem("kb_theme") || "nightInk");
  const theme = THEMES[themeId] || THEMES.nightInk;

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
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [editingEntry, setEditingEntry] = useState(null);
  const toggleTheme = () => {
    const next = themeId === "nightInk" ? "zenWhite" : "nightInk";
    document.documentElement.classList.add("kb-theme-transition");
    setTimeout(() => document.documentElement.classList.remove("kb-theme-transition"), 500);
    setThemeId(next);
    localStorage.setItem("kb_theme", next);
  };

  useEffect(() => { fetchEntries(); }, []);

  useEffect(() => {
    let timer;
    const schedule = () => {
      const n = new Date();
      const midnight = new Date(n); midnight.setHours(24,0,0,0);
      timer = setTimeout(() => { setNow(new Date()); setSelectedDay(new Date()); schedule(); }, midnight-n);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const weekSundayOf = d => {
    const s = new Date(d); s.setDate(d.getDate()-d.getDay()); s.setHours(0,0,0,0); return s;
  };

  const fetchEntries = async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.from("money_entries").select("*").order("created_at",{ascending:false});
    if (err) { setError(err.message); }
    else if (data) {
      setEntries(data);
      const ws = weekSundayOf(new Date());
      setBalance(data.filter(e => entryDate(e) >= ws).reduce((sum,e) => sum+Number(e.change), 0));
    }
    setLoading(false);
  };

  const apply = async sign => {
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) return;
    setSaving(true); setError(null);
    const targetDate = selectedDay || now;
    const optimistic = { id: crypto.randomUUID(), change: sign*val, note: note.trim()||null,
      ts: targetDate.toISOString(), created_at: targetDate.toISOString() };
    setEntries(prev => [optimistic, ...prev]);
    const ws = weekSundayOf(new Date());
    if (new Date(optimistic.ts) >= ws) setBalance(prev => prev+optimistic.change);
    setAmount(""); setNote("");
    const { data, error: err } = await supabase.from("money_entries")
      .insert({ change: optimistic.change, note: optimistic.note, ts: optimistic.ts, created_at: optimistic.created_at })
      .select().single();
    if (err) setError("Not saved: "+err.message);
    else if (data) setEntries(prev => prev.map(e => e.id===optimistic.id ? data : e));
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("money_entries").delete()
      .neq("id","00000000-0000-0000-0000-000000000000");
    if (err) setError(err.message);
    else { setEntries([]); setBalance(0); }
    setShowReset(false); setSaving(false);
  };

  const deleteEntry = async id => {
    const target = entries.find(e => e.id===id);
    if (!target) return;
    setEntries(prev => prev.filter(e => e.id!==id));
    const ws = weekSundayOf(new Date());
    if (entryDate(target) >= ws) setBalance(prev => prev-Number(target.change));
    await supabase.from("money_entries").delete().eq("id",id);
  };

  const updateEntry = async (id, newChange, newNote) => {
    const ws = weekSundayOf(new Date());
    const prev = entries.find(e => e.id===id);
    if (!prev) return;
    setEntries(list => list.map(e => e.id===id ? {...e, change: newChange, note: newNote} : e));
    if (entryDate(prev) >= ws) setBalance(b => b-Number(prev.change)+newChange);
    await supabase.from("money_entries").update({ change: newChange, note: newNote }).eq("id",id);
  };

  const handleKey = e => { if (e.key === "Enter") apply(1); };

  if (!unlocked) {
    return (
      <ThemeContext.Provider value={theme}>
        <style>{GLOBAL_CSS}</style>
        <PinLock onUnlock={() => setUnlocked(true)} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <style>{GLOBAL_CSS}</style>

      {editingEntry && (
        <EditEntryModal entry={editingEntry} onSave={updateEntry} onDelete={deleteEntry}
          onClose={() => setEditingEntry(null)} />
      )}

      {/* ── Balance Tab ── */}
      {activeTab === "balance" && (
        <BalanceTab
          entries={entries} balance={balance} loading={loading} saving={saving}
          error={error} now={now} selectedDay={selectedDay} setSelectedDay={setSelectedDay}
          amount={amount} setAmount={setAmount} note={note} setNote={setNote}
          apply={apply} reset={reset} showReset={showReset} setShowReset={setShowReset}
          deleteEntry={deleteEntry} setEditingEntry={setEditingEntry}
          themeId={themeId} onToggleTheme={toggleTheme}
          handleKey={handleKey}
        />
      )}

      {activeTab === "calendar" && <CalendarView entries={entries} now={now} />}
      {activeTab === "countdown" && <CountdownView />}

      {/* ── Tab Bar ── */}
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </ThemeContext.Provider>
  );
}

// ─── BalanceTab (extracted for clarity) ──────────────────────────────────────
function BalanceTab({ entries, balance, loading, saving, error, now, selectedDay, setSelectedDay,
  amount, setAmount, note, setNote, apply, reset, showReset, setShowReset,
  deleteEntry, setEditingEntry, themeId, onToggleTheme, handleKey }) {
  const t = useTheme();
  const s = useStyles();

  const displayDay = selectedDay || now;
  const ds = new Date(displayDay); ds.setHours(0,0,0,0);
  const de = new Date(displayDay); de.setHours(23,59,59,999);
  const dayNet = entries
    .filter(e => { const ts = entryDate(e); return ts >= ds && ts <= de; })
    .reduce((sum,e) => sum+Number(e.change), 0);

  return (
    <div style={{ ...s.root, paddingBottom: 90 }}>
      <div style={s.card}>
        {error && <div style={s.errorBox}>{error}</div>}

        {/* Date + day net + theme toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, letterSpacing: "0.01em" }}>
            {now.toLocaleDateString("en-US",{weekday:"long"})}
            <span style={{ color: t.textFaint }}>
              {" · "}{now.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            {!loading && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                  {displayDay.toLocaleDateString("en-US",{weekday:"long"})}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em",
                  color: dayNet < 0 ? t.negative : t.positive }}>
                  {dayNet > 0 ? "+" : ""}{fmt(dayNet)}
                </div>
              </div>
            )}
            <button className="kb-btn" onPointerDown={onToggleTheme}
              title={themeId === "nightInk" ? "Switch to Zen White" : "Switch to Night Ink"}
              style={{ background: "none", border: `1px solid ${t.border2}`, borderRadius: 20,
                color: t.textFaint, fontSize: 14, cursor: "pointer", padding: "4px 8px",
                lineHeight: 1, marginTop: 2, fontFamily: "sans-serif" }}>
              {themeId === "nightInk" ? "◑" : "◐"}
            </button>
          </div>
        </div>

        {/* Balance */}
        <div>
          <div style={{ color: t.textFaint, fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", marginBottom: 4, fontWeight: 500 }}>
            Balance
          </div>
          {loading ? (
            <div style={{ fontSize: 48, fontWeight: 700, color: t.textFaint, lineHeight: 1,
              marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>—</div>
          ) : (
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
              marginBottom: 6, fontVariantNumeric: "tabular-nums",
              color: balance < 0 ? t.negative : t.text }}>
              {fmt(balance)}
            </div>
          )}
        </div>

        {!loading && (
          <WeeklyChart entries={entries} now={now} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        )}

        {/* Amount input */}
        <input style={s.input} type="number" inputMode="decimal" placeholder="0.00"
          value={amount} min="0" disabled={saving}
          onChange={e => setAmount(e.target.value)} onKeyDown={handleKey} />
        <input style={{ ...s.input, ...s.noteInput }} type="text" placeholder="Note (optional)"
          value={note} maxLength={80} disabled={saving}
          onChange={e => setNote(e.target.value)} onKeyDown={handleKey} />

        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          <button className="kb-btn" style={{ ...s.btn, ...s.btnAdd, opacity: saving ? 0.5 : 1 }}
            onClick={() => apply(1)} disabled={saving}>+ Add</button>
          <button className="kb-btn" style={{ ...s.btn, ...s.btnSub, opacity: saving ? 0.5 : 1 }}
            onClick={() => apply(-1)} disabled={saving}>− Subtract</button>
        </div>

        {!loading && entries.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={s.sectionLabel}>This Week</div>
            <ThisWeekLog entries={entries} now={now} onDelete={deleteEntry} onEdit={setEditingEntry} />
            <WeeklyLog entries={entries} now={now} onDelete={deleteEntry} onEdit={setEditingEntry} />
          </div>
        )}

        <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
          {!showReset ? (
            <button style={s.resetBtn} onClick={() => setShowReset(true)}>Reset</button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: t.textMuted, fontSize: 13 }}>Wipe all entries?</span>
              <button className="kb-btn"
                style={{ ...s.btn, ...s.btnSub, fontSize: 13, padding: "6px 16px", flex: "none", opacity: saving ? 0.5 : 1 }}
                onClick={reset} disabled={saving}>Yes, reset</button>
              <button className="kb-btn"
                style={{ ...s.btn, background: t.surface, color: t.textMuted, border: `1px solid ${t.border}`,
                  fontSize: 13, padding: "6px 16px", flex: "none" }}
                onClick={() => setShowReset(false)}>Cancel</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────────
function TabBar({ activeTab, setActiveTab }) {
  const t = useTheme();
  const s = useStyles();
  const tabs = [
    { id: "balance", icon: "⚖", label: "Balance" },
    { id: "calendar", icon: "◫", label: "Calendar" },
    { id: "countdown", icon: "◷", label: "Countdown" },
  ];
  return (
    <div style={s.tabBar}>
      {tabs.map(tab => (
        <button key={tab.id} className="kb-btn"
          style={{ ...s.tabBtn, color: activeTab === tab.id ? t.tabActive : t.tabInactive }}
          onClick={() => setActiveTab(tab.id)}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
