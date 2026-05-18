import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { WM as C } from "./themes";

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const entryDate = e => { const t = new Date(e.ts); return isNaN(t) ? new Date(e.created_at) : t; };

function smoothPath(pts) {
  if (!pts.length) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1], cp = (p1.x - p0.x) / 3;
    d += ` C${p0.x + cp},${p0.y} ${p1.x - cp},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

function sundayOf(d) {
  const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0, 0, 0, 0); return s;
}

function weekLabelStr(d) {
  const s = sundayOf(d);
  return `${s.toLocaleDateString("en-US", { month: "long" })} Week ${Math.floor((s.getDate() - 1) / 7) + 1}`;
}

// ─── Animated value hook (smooth number transitions) ──────────────────────────
function useAnimatedValue(target, duration = 680) {
  const [val, setVal] = useState(target);
  const raf = useRef(null);
  const from = useRef(target);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; from.current = target; return; }
    const startVal = from.current;
    const startTime = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = now => {
      const p = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(startVal + (target - startVal) * ease);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { from.current = target; setVal(target); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return val;
}

// ─── Ripple hook ──────────────────────────────────────────────────────────────
function useRipple(glowColor = "rgba(255,255,255,0.18)") {
  const [ripples, setRipples] = useState([]);
  const trigger = useCallback(e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples(p => [...p, { x: e.clientX - rect.left, y: e.clientY - rect.top, id, color: glowColor }]);
    setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 750);
  }, [glowColor]);
  const els = ripples.map(r => (
    <span key={r.id} style={{
      position: "absolute", left: r.x, top: r.y,
      width: 8, height: 8, borderRadius: "50%",
      background: r.color, transform: "translate(-50%,-50%) scale(0)",
      animation: "ripple 0.7s cubic-bezier(0,0,0.2,1) forwards",
      pointerEvents: "none", zIndex: 0,
    }} />
  ));
  return { trigger, els };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes orb1 {
    0%,100%{transform:translate(0,0) scale(1);}
    33%{transform:translate(7%,6%) scale(1.08);}
    66%{transform:translate(-4%,10%) scale(0.95);}
  }
  @keyframes orb2 {
    0%,100%{transform:translate(0,0) scale(1);}
    40%{transform:translate(-8%,-5%) scale(0.9);}
    80%{transform:translate(11%,-8%) scale(1.1);}
  }
  @keyframes orb3 {
    0%,100%{transform:translate(0,0) scale(1);}
    50%{transform:translate(5%,-11%) scale(1.07);}
  }
  @keyframes floatUp {
    0%,100%{transform:translateY(0);}
    50%{transform:translateY(-5px);}
  }
  @keyframes breathe {
    0%,100%{box-shadow:0 8px 48px rgba(0,0,0,0.55),0 0 0 1px rgba(91,124,255,0.06),0 0 40px rgba(91,124,255,0.04),inset 0 1px 0 rgba(255,255,255,0.06);}
    50%{box-shadow:0 12px 64px rgba(0,0,0,0.6),0 0 0 1px rgba(91,124,255,0.12),0 0 80px rgba(91,124,255,0.08),inset 0 1px 0 rgba(255,255,255,0.08);}
  }
  @keyframes ripple {
    to{transform:translate(-50%,-50%) scale(22);opacity:0;}
  }
  @keyframes nodeIn {
    from{opacity:0;transform:translateX(-20px);}
    to{opacity:1;transform:translateX(0);}
  }
  @keyframes fadeUp {
    from{opacity:0;transform:translateY(10px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes slideUp {
    from{opacity:0;transform:translateY(44px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    15%{transform:translateX(-8px)} 30%{transform:translateX(8px)}
    45%{transform:translateX(-6px)} 60%{transform:translateX(6px)}
    75%{transform:translateX(-3px)} 90%{transform:translateX(3px)}
  }
  @keyframes shimmer {
    0%{transform:translateX(-140%) skewX(-12deg);}
    100%{transform:translateX(240%) skewX(-12deg);}
  }
  @keyframes particleRise {
    0%{opacity:0;transform:translateY(0) scale(0.6);}
    12%{opacity:0.5;}
    88%{opacity:0.25;}
    100%{opacity:0;transform:translateY(-90px) scale(1);}
  }
  @keyframes dotPulse {
    0%,100%{filter:drop-shadow(0 0 4px currentColor);opacity:0.9;}
    50%{filter:drop-shadow(0 0 12px currentColor) drop-shadow(0 0 24px currentColor);opacity:1;}
  }
  @keyframes balanceFlash {
    0%{filter:brightness(1);}
    35%{filter:brightness(1.6) drop-shadow(0 0 20px rgba(88,245,195,0.9));}
    100%{filter:brightness(1);}
  }
  @keyframes balanceFlashRed {
    0%{filter:brightness(1);}
    35%{filter:brightness(1.5) drop-shadow(0 0 20px rgba(255,107,138,0.9));}
    100%{filter:brightness(1);}
  }
  @keyframes tabIn {
    from{opacity:0;transform:translateY(8px);}
    to{opacity:1;transform:translateY(0);}
  }
  @keyframes ringGlow {
    0%,100%{filter:drop-shadow(0 0 6px currentColor);}
    50%{filter:drop-shadow(0 0 18px currentColor) drop-shadow(0 0 36px currentColor);}
  }
  @keyframes dockGlow {
    0%,100%{box-shadow:0 0 18px rgba(91,124,255,0.4);}
    50%{box-shadow:0 0 32px rgba(91,124,255,0.7),0 0 64px rgba(91,124,255,0.3);}
  }
  @keyframes insightBar {
    from{transform:scaleY(0);transform-origin:bottom;}
    to{transform:scaleY(1);transform-origin:bottom;}
  }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  body { margin: 0; background: #050816; overscroll-behavior: none; }
  input { appearance: none; -webkit-appearance: none; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=date]::-webkit-calendar-picker-indicator,
  input[type=time]::-webkit-calendar-picker-indicator { filter: invert(0.5) brightness(0.8); }
  ::-webkit-scrollbar { width: 0; }
  .wm-btn {
    transition: transform 0.11s ease, opacity 0.13s ease, box-shadow 0.18s ease;
    user-select: none; cursor: pointer; will-change: transform;
  }
  .wm-btn:active { transform: scale(0.92) !important; opacity: 0.82 !important; }
  .wm-float { animation: floatUp 7s ease-in-out infinite; will-change: transform; }
  .wm-node { animation: nodeIn 0.3s ease both; }
  .wm-fade { animation: fadeUp 0.26s ease both; }
  .wm-slide { animation: slideUp 0.32s cubic-bezier(0.34,1.1,0.64,1) both; }
  .wm-tab { animation: tabIn 0.3s cubic-bezier(0.34,1.06,0.64,1) both; }
  .wm-lift {
    transition: transform 0.22s ease, box-shadow 0.22s ease;
    will-change: transform;
  }
  .wm-lift:hover {
    transform: translateY(-3px) !important;
  }
  .wm-dot-today {
    animation: dotPulse 2.8s ease-in-out infinite;
  }
  .wm-ring-breathe {
    animation: ringGlow 3s ease-in-out infinite;
  }
  .wm-insight-bar {
    animation: insightBar 0.6s cubic-bezier(0.34,1.06,0.64,1) both;
  }
`;

// ─── Canvas Wave Background ───────────────────────────────────────────────────
function CanvasWave() {
  const ref = useRef(null);
  const raf = useRef(null);
  const t = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Wave layers: [amplitude, frequency, speed, yFraction, r,g,b,a]
    const layers = [
      [48, 0.75, 0.22, 0.70, 91, 124, 255, 0.058],
      [32, 1.1,  0.37, 0.76, 139, 92, 255, 0.048],
      [22, 0.62, 0.55, 0.81, 91, 124, 255, 0.042],
      [18, 1.4,  0.70, 0.87, 88, 245, 195, 0.032],
      [38, 0.52, 0.14, 0.63, 139, 92, 255, 0.028],
      [14, 1.8,  0.90, 0.92, 91, 124, 255, 0.022],
    ];

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      for (const [amp, freq, speed, yFrac, r, g, b, a] of layers) {
        const baseY = H * yFrac;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const y = baseY + amp * Math.sin(freq * (x / W) * Math.PI * 2 + t.current * speed);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.fill();
      }
      t.current += 0.013;
      raf.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />
  );
}

// ─── Floating Particles ───────────────────────────────────────────────────────
const PARTICLE_DEFS = Array.from({ length: 16 }, (_, i) => ({
  key: i,
  left: `${6 + (i * 6.1) % 88}%`,
  bottom: `${15 + (i * 17) % 55}%`,
  delay: `${(i * 0.65) % 9}s`,
  dur: `${9 + (i * 0.55) % 7}s`,
  size: i % 4 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5,
  col: i % 3 === 0 ? "rgba(91,124,255,0.55)" : i % 3 === 1 ? "rgba(139,92,255,0.45)" : "rgba(88,245,195,0.4)",
}));

// ─── Ambient Background ───────────────────────────────────────────────────────
function WaveBackground() {
  return (
    <>
      <CanvasWave />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, overflow: "hidden", pointerEvents: "none", background: C.bg }}>
        {/* Ambient orbs */}
        <div style={{ position: "absolute", width: 780, height: 780, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(91,124,255,0.24) 0%,transparent 62%)",
          top: "-20%", left: "-14%", filter: "blur(75px)", animation: "orb1 24s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 660, height: 660, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(139,92,255,0.19) 0%,transparent 62%)",
          bottom: "0%", right: "-12%", filter: "blur(85px)", animation: "orb2 30s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(88,245,195,0.08) 0%,transparent 68%)",
          top: "35%", left: "20%", filter: "blur(95px)", animation: "orb3 20s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 340, height: 340, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(91,124,255,0.12) 0%,transparent 68%)",
          bottom: "25%", left: "2%", filter: "blur(65px)", animation: "orb2 16s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle,rgba(139,92,255,0.09) 0%,transparent 70%)",
          top: "15%", right: "8%", filter: "blur(55px)", animation: "orb3 12s ease-in-out infinite reverse" }} />

        {/* Floating particles */}
        {PARTICLE_DEFS.map(p => (
          <div key={p.key} style={{
            position: "absolute", left: p.left, bottom: p.bottom,
            width: p.size, height: p.size, borderRadius: "50%",
            background: p.col, boxShadow: `0 0 ${p.size * 3}px ${p.col}`,
            animation: `particleRise ${p.dur} ease-in-out ${p.delay} infinite`,
          }} />
        ))}

        {/* Subtle scanline overlay for HUD depth */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.012) 3px,rgba(0,0,0,0.012) 4px)",
          pointerEvents: "none",
        }} />
      </div>
    </>
  );
}

// ─── Floating Dock ────────────────────────────────────────────────────────────
const TABS = [
  { id: "home",      icon: "≈",  label: "Flow"    },
  { id: "timeline",  icon: "∿",  label: "Stream"  },
  { id: "countdown", icon: "◎",  label: "Focus"   },
  { id: "bills",     icon: "▣",  label: "Bills"   },
  { id: "insights",  icon: "↗",  label: "Insights"},
];

function FloatingDock({ activeTab, setActiveTab }) {
  const activeIdx = TABS.findIndex(t => t.id === activeTab);

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      display: "flex", justifyContent: "center",
      padding: "8px 12px env(safe-area-inset-bottom,10px)",
      background: "rgba(5,8,22,0.9)",
      backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
      borderTop: `1px solid ${C.border}` }}>
      <div style={{
        position: "relative", display: "flex",
        background: "rgba(11,18,36,0.7)", borderRadius: C.pillRadius,
        padding: "5px", border: `1px solid ${C.border}`,
        boxShadow: "0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        maxWidth: 420, width: "100%" }}>

        {/* Sliding active indicator */}
        <div style={{
          position: "absolute", top: 5, bottom: 5,
          width: `calc((100% - 10px) / ${TABS.length})`,
          transform: `translateX(calc(${activeIdx} * 100%))`,
          transition: "transform 0.38s cubic-bezier(0.34,1.56,0.64,1)",
          background: `linear-gradient(135deg,${C.accent},${C.violet})`,
          borderRadius: C.pillRadius,
          animation: "dockGlow 3s ease-in-out infinite",
          pointerEvents: "none",
        }} />

        {TABS.map(tab => {
          const on = tab.id === activeTab;
          return (
            <button key={tab.id} className="wm-btn" onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, background: "none", border: "none",
                borderRadius: C.pillRadius, color: on ? "#fff" : C.textFaint,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 2, padding: "7px 4px",
                transition: "color 0.25s ease",
                position: "relative", zIndex: 1,
                fontFamily: "'Inter','Segoe UI',sans-serif" }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Wave Chart ───────────────────────────────────────────────────────────────
function WaveChart({ entries, now, selectedDay, onSelectDay }) {
  const drag = useRef({ y: 0, moved: false });
  const days = ["S","M","T","W","T","F","S"];
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dow); weekStart.setHours(0, 0, 0, 0);

  const balances = days.map((_, i) => {
    if (i > dow) return null;
    const ds = new Date(weekStart); ds.setDate(weekStart.getDate() + i); ds.setHours(0, 0, 0, 0);
    const de = new Date(weekStart); de.setDate(weekStart.getDate() + i); de.setHours(23, 59, 59, 999);
    return entries.filter(e => { const ts = entryDate(e); return ts >= ds && ts <= de; })
      .reduce((s, e) => s + Number(e.change), 0);
  });

  const valid = balances.filter(v => v !== null);
  if (!valid.length) return null;

  const W = 300, H = 84, pL = 38, pR = 8, pT = 10, pB = 6;
  const iW = W - pL - pR, iH = H - pT - pB;
  const rMax = Math.max(...valid, 0), rMin = Math.min(...valid, 0);
  const pad = Math.max(rMax * 0.25, Math.abs(rMin) * 0.25, 12);
  const dMax = rMax + pad, dMin = rMin - pad, range = dMax - dMin;
  const toY = v => pT + iH - ((v - dMin) / range) * iH;
  const toX = i => pL + (i / 6) * iW;
  const pts = balances.map((v, i) => v !== null ? { x: toX(i), y: toY(v), v, i } : null).filter(Boolean);
  const zY = toY(0);
  const lp = smoothPath(pts);
  const area = lp ? `${lp} L${pts[pts.length-1].x},${zY} L${pts[0].x},${zY} Z` : "";
  const selDow = selectedDay ? selectedDay.getDay() : null;
  const fmtS = v => Math.abs(v) >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${Math.round(v)}`;

  const tap = i => {
    if (i > dow) return;
    if (selDow === i) { onSelectDay(null); return; }
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);
    onSelectDay(d);
  };

  return (
    <div style={{ width: "100%", marginTop: 8 }}>
      <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: "100%", overflow: "visible" }}>
        <defs>
          <clipPath id="ca"><rect x={0} y={0} width={W} height={zY} /></clipPath>
          <clipPath id="cb"><rect x={0} y={zY} width={W} height={H + 24} /></clipPath>
          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.teal} stopOpacity="0.28" />
            <stop offset="100%" stopColor={C.teal} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.rose} stopOpacity="0" />
            <stop offset="100%" stopColor={C.rose} stopOpacity="0.22" />
          </linearGradient>
          <filter id="lineGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {[rMax, (rMin + rMax) / 2, rMin].map((val, idx) => (
          <g key={idx}>
            <line x1={pL} y1={toY(val)} x2={W - pR} y2={toY(val)} stroke="rgba(91,124,255,0.08)" strokeWidth={1} />
            <text x={pL - 4} y={toY(val) + 3.5} textAnchor="end" fontSize={8}
              fontFamily="Inter,sans-serif" fill={C.textFaint}>{fmtS(val)}</text>
          </g>
        ))}
        <line x1={pL} y1={zY} x2={W - pR} y2={zY} stroke="rgba(91,124,255,0.2)" strokeWidth={1} strokeDasharray="3 3" />

        {area && <>
          <path d={area} fill="url(#gp)" clipPath="url(#ca)" />
          <path d={area} fill="url(#gn)" clipPath="url(#cb)" />
        </>}

        {/* Glow duplicate lines beneath main lines */}
        {lp && <>
          <path d={lp} fill="none" stroke={C.teal} strokeWidth={4} strokeLinecap="round"
            clipPath="url(#ca)" opacity="0.25" filter="url(#lineGlow)" />
          <path d={lp} fill="none" stroke={C.rose} strokeWidth={4} strokeLinecap="round"
            clipPath="url(#cb)" opacity="0.2" filter="url(#lineGlow)" />
          <path d={lp} fill="none" stroke={C.teal} strokeWidth={1.8}
            strokeLinecap="round" clipPath="url(#ca)" />
          <path d={lp} fill="none" stroke={C.rose} strokeWidth={1.8}
            strokeLinecap="round" clipPath="url(#cb)" />
        </>}

        {days.map((label, i) => {
          const x = toX(i), pt = pts.find(p => p.i === i);
          const isSel = selDow === i, isToday = i === dow, isFut = i > dow;
          const ptColor = pt ? (pt.v < 0 ? C.rose : C.teal) : C.teal;
          return (
            <g key={i} className={isToday ? "wm-dot-today" : undefined}
              onPointerDown={e => { drag.current = { y: e.clientY, moved: false }; }}
              onPointerMove={e => { if (Math.abs(e.clientY - drag.current.y) > 10) drag.current.moved = true; }}
              onPointerUp={() => { if (!drag.current.moved) tap(i); }}
              style={{ cursor: isFut ? "default" : "pointer", color: ptColor }}>
              <rect x={x - 14} y={0} width={28} height={H + 24} fill="rgba(0,0,0,0.01)" />
              {pt ? (
                <>
                  {/* outer glow ring */}
                  <circle cx={x} cy={pt.y} r={isSel ? 10 : isToday ? 8 : 5.5}
                    fill="none" stroke={ptColor} strokeWidth={1}
                    opacity={isSel || isToday ? 0.3 : 0}
                    style={{ filter: `blur(2px)` }} />
                  <circle cx={x} cy={pt.y} r={isSel ? 7 : isToday ? 5.5 : 3.5}
                    fill={isSel ? "#fff" : ptColor} />
                </>
              ) : !isFut ? (
                <circle cx={x} cy={zY} r={2.5} fill="rgba(91,124,255,0.15)"
                  stroke="rgba(91,124,255,0.3)" strokeWidth={1} />
              ) : null}
              <text x={x} y={H + 20} textAnchor="middle" fontSize={9} fontFamily="Inter,sans-serif"
                fill={isSel ? "#fff" : isToday ? C.accent : isFut ? "rgba(91,124,255,0.18)" : C.textFaint}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab({ entries, balance, loading, saving, error, now, selectedDay, setSelectedDay,
  amount, setAmount, note, setNote, apply, deleteEntry, setEditingEntry,
  reset, showReset, setShowReset, handleKey }) {

  const animBalance = useAnimatedValue(balance);
  const [balFlash, setBalFlash] = useState(null); // "pos" | "neg" | null
  const addRipple = useRipple("rgba(88,245,195,0.3)");
  const subRipple = useRipple("rgba(255,107,138,0.3)");

  const prevBalance = useRef(balance);
  useEffect(() => {
    if (prevBalance.current === balance) return;
    setBalFlash(balance > prevBalance.current ? "pos" : "neg");
    const t = setTimeout(() => setBalFlash(null), 900);
    prevBalance.current = balance;
    return () => clearTimeout(t);
  }, [balance]);

  const displayDay = selectedDay || now;
  const ds = new Date(displayDay); ds.setHours(0, 0, 0, 0);
  const de = new Date(displayDay); de.setHours(23, 59, 59, 999);
  const dayNet = entries
    .filter(e => { const ts = entryDate(e); return ts >= ds && ts <= de; })
    .reduce((sum, e) => sum + Number(e.change), 0);

  const recent = entries.slice(0, 5);

  const glass = {
    background: `linear-gradient(135deg,${C.glass} 0%,${C.glass2} 100%)`,
    border: `1px solid ${C.border}`,
    borderRadius: C.cardRadius,
    boxShadow: "0 4px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
  };

  const inp = {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
    borderRadius: 14, color: C.text, outline: "none",
    fontFamily: "'Inter','Segoe UI',sans-serif",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  };

  return (
    <div className="wm-tab" style={{ minHeight: "100dvh", padding: "56px 16px 100px",
      fontFamily: "'Inter','Segoe UI',sans-serif", position: "relative", zIndex: 10 }}>

      {error && (
        <div style={{ background: C.roseSoft, border: `1px solid rgba(255,107,138,0.3)`,
          borderRadius: 12, color: C.rose, fontSize: 12, padding: "8px 14px", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Balance card — breathing + floating */}
      <div className="wm-lift" style={{
        background: "linear-gradient(135deg,rgba(11,18,36,0.94) 0%,rgba(18,28,58,0.88) 100%)",
        border: `1px solid ${C.border2}`,
        borderRadius: C.cardRadius + 4,
        padding: "22px 20px 16px", marginBottom: 12,
        position: "relative", overflow: "hidden",
        animation: "breathe 5s ease-in-out infinite",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      }}>
        {/* Edge highlight */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(91,124,255,0.5),rgba(139,92,255,0.4),transparent)",
          pointerEvents: "none" }} />

        {/* Shimmer sweep */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: "linear-gradient(105deg,transparent 36%,rgba(255,255,255,0.04) 50%,transparent 64%)",
            animation: "shimmer 6s ease-in-out infinite" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textFaint, letterSpacing: "0.11em",
              textTransform: "uppercase", fontWeight: 500, marginBottom: 6 }}>
              {now.toLocaleDateString("en-US", { weekday: "long" })}
              <span style={{ opacity: 0.6 }}>{" · "}{now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
            <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
              textTransform: "uppercase", marginBottom: 4 }}>Balance</div>
            {loading ? (
              <div style={{ fontSize: 46, fontWeight: 700, color: C.textFaint, lineHeight: 1,
                fontVariantNumeric: "tabular-nums" }}>—</div>
            ) : (
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: balance < 0 ? C.rose : C.text,
                animation: balFlash === "pos" ? "balanceFlash 0.85s ease" : balFlash === "neg" ? "balanceFlashRed 0.85s ease" : "none",
              }}>
                {fmt(animBalance)}
              </div>
            )}
          </div>
          {!loading && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 2 }}>
                {displayDay.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em",
                color: dayNet < 0 ? C.rose : C.teal,
                textShadow: `0 0 20px ${dayNet < 0 ? C.roseGlow : C.tealGlow}` }}>
                {dayNet > 0 ? "+" : ""}{fmt(dayNet)}
              </div>
            </div>
          )}
        </div>

        {!loading && (
          <WaveChart entries={entries} now={now} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        )}
      </div>

      {/* Input area */}
      <div style={{ ...glass, padding: "16px", marginBottom: 12,
        display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={{ ...inp, fontSize: 24, padding: "12px 16px",
          fontWeight: 700, letterSpacing: "-0.01em",
          boxShadow: `inset 0 2px 8px rgba(0,0,0,0.25)` }}
          type="number" inputMode="decimal" placeholder="0.00"
          value={amount} min="0" disabled={saving}
          onChange={e => setAmount(e.target.value)} onKeyDown={handleKey} />
        <input style={{ ...inp, fontSize: 14, padding: "9px 16px", color: C.textMuted }}
          type="text" placeholder="Note (optional)"
          value={note} maxLength={80} disabled={saving}
          onChange={e => setNote(e.target.value)} onKeyDown={handleKey} />
        <div style={{ display: "flex", gap: 10 }}>
          {/* Add button with ripple */}
          <button className="wm-btn"
            onClick={e => { addRipple.trigger(e); apply(1); }}
            disabled={saving}
            style={{ flex: 1, border: `1px solid rgba(88,245,195,0.24)`, borderRadius: C.btnRadius,
              background: "linear-gradient(135deg,rgba(88,245,195,0.13),rgba(88,245,195,0.06))",
              color: C.teal, fontSize: 16, fontWeight: 700, padding: "13px 0",
              boxShadow: `0 0 24px rgba(88,245,195,0.12), inset 0 1px 0 rgba(88,245,195,0.1)`,
              opacity: saving ? 0.4 : 1, fontFamily: "'Inter','Segoe UI',sans-serif",
              position: "relative", overflow: "hidden" }}>
            {addRipple.els}
            + Add
          </button>
          {/* Subtract button with ripple */}
          <button className="wm-btn"
            onClick={e => { subRipple.trigger(e); apply(-1); }}
            disabled={saving}
            style={{ flex: 1, border: `1px solid rgba(255,107,138,0.24)`, borderRadius: C.btnRadius,
              background: "linear-gradient(135deg,rgba(255,107,138,0.13),rgba(255,107,138,0.06))",
              color: C.rose, fontSize: 16, fontWeight: 700, padding: "13px 0",
              boxShadow: `0 0 24px rgba(255,107,138,0.12), inset 0 1px 0 rgba(255,107,138,0.1)`,
              opacity: saving ? 0.4 : 1, fontFamily: "'Inter','Segoe UI',sans-serif",
              position: "relative", overflow: "hidden" }}>
            {subRipple.els}
            − Subtract
          </button>
        </div>
      </div>

      {/* Recent entries */}
      {!loading && recent.length > 0 && (
        <div className="wm-fade" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
            textTransform: "uppercase", fontWeight: 500, marginBottom: 8 }}>Recent</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map((e, i) => {
              const neg = Number(e.change) < 0;
              return (
                <div key={e.id} className="wm-btn wm-lift wm-node" onClick={() => setEditingEntry(e)}
                  style={{ ...glass, padding: "10px 14px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    animationDelay: `${i * 0.07}s`,
                    position: "relative", overflow: "hidden" }}>
                  {/* Entry edge glow */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
                    background: neg ? C.rose : C.teal,
                    boxShadow: `0 0 8px ${neg ? C.roseGlow : C.tealGlow}`,
                    borderRadius: "2px 0 0 2px" }} />
                  <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                    background: neg ? C.rose : C.teal,
                    boxShadow: `0 0 10px ${neg ? C.roseGlow : C.tealGlow}`, marginLeft: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: neg ? C.rose : C.teal }}>
                      {neg ? "" : "+"}{fmt(Number(e.change))}
                    </div>
                    {e.note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{e.note}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: C.textFaint }}>
                    {entryDate(e).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        {!showReset ? (
          <button className="wm-btn" onClick={() => setShowReset(true)}
            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 20,
              color: C.textFaint, fontSize: 12, padding: "6px 18px", cursor: "pointer",
              fontFamily: "'Inter','Segoe UI',sans-serif" }}>Reset</button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: C.textMuted, fontSize: 12 }}>Wipe all entries?</span>
            <button className="wm-btn" onClick={reset}
              style={{ background: C.roseSoft, border: `1px solid rgba(255,107,138,0.3)`,
                borderRadius: 12, color: C.rose, fontSize: 12, padding: "6px 14px",
                cursor: "pointer", fontFamily: "'Inter','Segoe UI',sans-serif" }}>Yes</button>
            <button className="wm-btn" onClick={() => setShowReset(false)}
              style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12,
                color: C.textMuted, fontSize: 12, padding: "6px 14px",
                cursor: "pointer", fontFamily: "'Inter','Segoe UI',sans-serif" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────
function TimelineTab({ entries, now, deleteEntry, setEditingEntry }) {
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});
  const DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  const glass = {
    background: `linear-gradient(135deg,${C.glass} 0%,${C.glass2} 100%)`,
    border: `1px solid ${C.border}`,
    boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  };

  const renderEntry = (e, i, border) => {
    const neg = Number(e.change) < 0;
    return (
      <div key={e.id} className="wm-btn wm-node" onClick={() => setEditingEntry(e)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          borderTop: border ? `1px solid ${C.border}` : "none",
          cursor: "pointer", position: "relative", animationDelay: `${i * 0.04}s` }}>
        {/* Connecting line for timeline effect */}
        {i === 0 && border === false && (
          <div style={{ position: "absolute", left: 20, top: 0, bottom: -1, width: 1,
            background: `linear-gradient(to bottom,transparent,${neg ? C.rose : C.teal}40)` }} />
        )}
        <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: neg ? C.rose : C.teal,
          boxShadow: `0 0 8px ${neg ? C.roseGlow : C.tealGlow}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: neg ? C.rose : C.teal }}>
            {neg ? "" : "+"}{fmt(Number(e.change))}
          </div>
          {e.note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{e.note}</div>}
        </div>
        <div style={{ fontSize: 10, color: C.textFaint }}>
          {entryDate(e).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
        <button onPointerDown={ev => ev.stopPropagation()}
          onPointerUp={ev => { ev.stopPropagation(); deleteEntry(e.id); }}
          style={{ background: "none", border: "none", color: "rgba(255,107,138,0.4)",
            fontSize: 18, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>×</button>
      </div>
    );
  };

  if (!entries.length) {
    return (
      <div className="wm-tab" style={{ minHeight: "100dvh", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 10, position: "relative" }}>
        <div style={{ textAlign: "center", color: C.textFaint }}>
          <div style={{ fontSize: 44, opacity: 0.35, marginBottom: 10 }}>∿</div>
          <div style={{ fontSize: 14 }}>No transactions yet</div>
        </div>
      </div>
    );
  }

  const weekStart = sundayOf(now);
  const thisWeek = entries.filter(e => entryDate(e) >= weekStart);
  const past = entries.filter(e => entryDate(e) < weekStart);

  const dayGroups = {};
  thisWeek.forEach(e => {
    const d = entryDate(e), k = d.toLocaleDateString("en-CA");
    if (!dayGroups[k]) dayGroups[k] = { name: DAY[d.getDay()], items: [], net: 0 };
    dayGroups[k].items.push(e);
    dayGroups[k].net += Number(e.change);
  });

  const weekGroups = {};
  past.forEach(e => {
    const d = entryDate(e), wk = sundayOf(d).toLocaleDateString("en-CA");
    if (!weekGroups[wk]) weekGroups[wk] = { label: weekLabelStr(d), items: [], net: 0, dayMap: {} };
    weekGroups[wk].items.push(e); weekGroups[wk].net += Number(e.change);
    const dk = d.toLocaleDateString("en-CA");
    if (!weekGroups[wk].dayMap[dk]) weekGroups[wk].dayMap[dk] = { name: DAY[d.getDay()], items: [], net: 0 };
    weekGroups[wk].dayMap[dk].items.push(e); weekGroups[wk].dayMap[dk].net += Number(e.change);
  });

  const netPill = net => (
    <span style={{ fontSize: 15, fontWeight: 600,
      color: net < 0 ? C.rose : C.teal,
      textShadow: `0 0 14px ${net < 0 ? C.roseGlow : C.tealGlow}` }}>
      {net > 0 ? "+" : ""}{fmt(net)}
    </span>
  );

  const chevron = open => (
    <span style={{ color: C.textFaint, fontSize: 16, display: "inline-block",
      transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }}>›</span>
  );

  return (
    <div className="wm-tab" style={{ minHeight: "100dvh", padding: "56px 16px 100px",
      fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 10, position: "relative" }}>

      {Object.keys(dayGroups).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
            textTransform: "uppercase", fontWeight: 500, marginBottom: 10 }}>This Week</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(dayGroups).sort(([a],[b]) => b.localeCompare(a)).map(([k, { name, items, net }]) => (
              <div key={k} className="wm-lift" style={{ ...glass, borderRadius: C.cardRadius }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 14px", cursor: "pointer" }}
                  onClick={() => setExpandedDays(p => ({ ...p, [k]: !p[k] }))}>
                  <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {netPill(net)}{chevron(expandedDays[k])}
                  </div>
                </div>
                {expandedDays[k] && items.sort((a,b) => entryDate(b) - entryDate(a)).map((e,i) => renderEntry(e,i,i>0))}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.entries(weekGroups).sort(([a],[b]) => b.localeCompare(a)).map(([wk, { label, net, dayMap }]) => {
        const isOpen = expandedWeek === wk;
        return (
          <div key={wk} style={{ marginBottom: 8 }}>
            <div className="wm-lift" style={{ ...glass,
              borderRadius: isOpen ? `${C.cardRadius}px ${C.cardRadius}px 0 0` : C.cardRadius }}
              onClick={() => setExpandedWeek(isOpen ? null : wk)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", cursor: "pointer" }}>
                <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {netPill(net)}{chevron(isOpen)}
                </div>
              </div>
            </div>
            {isOpen && (
              <div style={{ ...glass, borderRadius: `0 0 ${C.cardRadius}px ${C.cardRadius}px`,
                borderTop: "none", overflow: "hidden" }}>
                {Object.entries(dayMap).sort(([a],[b]) => b.localeCompare(a)).map(([dk, { name, items: di, net: dn }]) => {
                  const dayKey = `${wk}|${dk}`, isDayOpen = !!expandedDays[dayKey];
                  return (
                    <div key={dk} style={{ borderTop: `1px solid ${C.border}` }}>
                      <div onClick={() => setExpandedDays(p => ({ ...p, [dayKey]: !p[dayKey] }))}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "9px 14px", cursor: "pointer" }}>
                        <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase",
                          letterSpacing: "0.08em" }}>{name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: dn < 0 ? C.rose : C.teal }}>
                            {dn > 0 ? "+" : ""}{fmt(dn)}
                          </span>
                          {chevron(isDayOpen)}
                        </div>
                      </div>
                      {isDayOpen && di.sort((a,b) => entryDate(b) - entryDate(a)).map((e,i) => renderEntry(e,i,i>0))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Countdown Ring ───────────────────────────────────────────────────────────
function CountdownRing({ pct, radius, color, glow, size }) {
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct)));
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size}
      className="wm-ring-breathe"
      style={{ transform: "rotate(-90deg)", display: "block", color }}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={5} />
      {/* Glow track */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={9}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        opacity="0.15" />
      {/* Main ring */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={5}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ filter: `drop-shadow(0 0 8px ${glow})`,
          transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }} />
    </svg>
  );
}

// ─── Countdown Tab ────────────────────────────────────────────────────────────
function CountdownTab() {
  const [countdowns, setCountdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingCountdown, setEditingCountdown] = useState(null);

  useEffect(() => { fetchCountdowns(); }, []);
  useEffect(() => {
    const id = setInterval(() => setCountdowns(c => [...c]), 60000);
    return () => clearInterval(id);
  }, []);

  const fetchCountdowns = async () => {
    setLoading(true);
    const { data } = await supabase.from("countdowns").select("*").order("due_at", { ascending: true });
    if (data) setCountdowns(data);
    setLoading(false);
  };

  const addCountdown = async () => {
    const trimLabel = label.trim();
    if (!trimLabel || !dueDate) return;
    const due = new Date(`${dueDate}T${dueTime || "00:00"}:00`);
    if (isNaN(due.getTime())) return;
    setSaving(true);
    const { data, error } = await supabase.from("countdowns")
      .insert({ label: trimLabel, due_at: due.toISOString() }).select().single();
    if (data) {
      setCountdowns(prev => [...prev, data].sort((a,b) => new Date(a.due_at) - new Date(b.due_at)));
      setLabel(""); setDueDate(""); setDueTime("");
    } else if (error) alert("Could not save. Make sure the 'countdowns' table exists.");
    setSaving(false);
  };

  const deleteCountdown = async id => {
    setCountdowns(prev => prev.filter(c => c.id !== id));
    await supabase.from("countdowns").delete().eq("id", id);
  };

  const updateCountdown = async (id, newLabel, newDueAt) => {
    setCountdowns(prev =>
      prev.map(c => c.id === id ? { ...c, label: newLabel, due_at: newDueAt } : c)
        .sort((a,b) => new Date(a.due_at) - new Date(b.due_at))
    );
    await supabase.from("countdowns").update({ label: newLabel, due_at: newDueAt }).eq("id", id);
  };

  const getRem = due_at => {
    const diff = new Date(due_at) - new Date();
    if (diff <= 0) return { expired: true };
    const m = Math.floor(diff / 60000);
    return { expired: false, days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), mins: m % 60 };
  };

  const getPct = (due_at, created_at) => {
    const due = new Date(due_at), c = created_at ? new Date(created_at) : new Date(due - 30*24*3600*1000);
    return Math.max(0, Math.min(1, (new Date() - c) / Math.max(1, due - c)));
  };

  const fmtDue = due_at => {
    const d = new Date(due_at);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const glass = {
    background: "linear-gradient(135deg,rgba(11,18,36,0.92) 0%,rgba(18,28,58,0.87) 100%)",
    border: `1px solid ${C.border}`, borderRadius: C.cardRadius,
    boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
  };

  const inp = {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
    borderRadius: 13, color: C.text, fontSize: 14, padding: "10px 13px", outline: "none",
    fontFamily: "'Inter','Segoe UI',sans-serif", width: "100%",
  };

  return (
    <>
      {editingCountdown && (
        <EditCountdownModal countdown={editingCountdown} onSave={updateCountdown}
          onClose={() => setEditingCountdown(null)} />
      )}
      <div className="wm-tab" style={{ minHeight: "100dvh", padding: "56px 16px 100px",
        fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 10, position: "relative" }}>

        <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, letterSpacing: "0.01em", marginBottom: 16 }}>
          Focus Space
        </div>

        <div style={{ ...glass, padding: "16px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em", textTransform: "uppercase", fontWeight: 500 }}>
            New Countdown
          </div>
          <input style={inp} type="text" placeholder="Event name"
            value={label} maxLength={80} disabled={saving}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addCountdown(); }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inp, flex: 3, width: "auto" }} type="date"
              value={dueDate} disabled={saving} onChange={e => setDueDate(e.target.value)} />
            <input style={{ ...inp, flex: 2, width: "auto" }} type="time"
              value={dueTime} disabled={saving} onChange={e => setDueTime(e.target.value)} />
          </div>
          <button className="wm-btn" onClick={addCountdown}
            disabled={saving || !label.trim() || !dueDate}
            style={{ border: `1px solid ${C.border2}`, borderRadius: C.btnRadius,
              background: `linear-gradient(135deg,${C.accentSoft},${C.violetSoft})`,
              color: C.accent, fontSize: 14, fontWeight: 600, padding: "10px 0",
              opacity: (saving || !label.trim() || !dueDate) ? 0.4 : 1,
              fontFamily: "'Inter','Segoe UI',sans-serif" }}>
            + Add Countdown
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: C.textFaint, padding: "30px 0", fontSize: 13 }}>Loading…</div>
        ) : countdowns.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textFaint, padding: "40px 0" }}>
            <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 10 }}>◎</div>
            <div style={{ fontSize: 13 }}>No countdowns yet</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {countdowns.map((c, ci) => {
              const rem = getRem(c.due_at);
              const pct = getPct(c.due_at, c.created_at);
              const col = rem.expired ? C.textFaint : pct > 0.85 ? C.rose : pct > 0.55 ? C.amber : C.accent;
              const glow = rem.expired ? "transparent" : pct > 0.85 ? C.roseGlow : pct > 0.55 ? C.amberGlow : C.accentGlow;
              const urgent = pct > 0.85;
              return (
                <div key={c.id} className="wm-btn wm-lift wm-fade"
                  onClick={() => setEditingCountdown(c)}
                  style={{ ...glass, padding: "20px 16px", cursor: "pointer",
                    position: "relative", overflow: "hidden",
                    border: `1px solid ${urgent ? "rgba(255,107,138,0.22)" : C.border}`,
                    animationDelay: `${ci * 0.08}s` }}>

                  {/* Top edge color accent */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1,
                    background: `linear-gradient(90deg,transparent,${col}80,transparent)`,
                    pointerEvents: "none" }} />

                  {/* Ambient glow behind ring */}
                  <div style={{ position: "absolute", top: 10, right: 12, width: 110, height: 110,
                    borderRadius: "50%",
                    background: `radial-gradient(circle,${glow} 0%,transparent 70%)`,
                    opacity: 0.3, pointerEvents: "none" }} />

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ flexShrink: 0, position: "relative" }}>
                      <CountdownRing pct={pct} radius={42} color={col} glow={glow} size={100} />
                      <div style={{ position: "absolute", inset: 0, display: "flex",
                        flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        {rem.expired ? (
                          <span style={{ fontSize: 10, color: C.textFaint, fontStyle: "italic" }}>done</span>
                        ) : (
                          <>
                            <div style={{ fontSize: 22, fontWeight: 700, color: col, lineHeight: 1,
                              textShadow: `0 0 16px ${glow}` }}>{rem.days}</div>
                            <div style={{ fontSize: 8, color: C.textFaint, letterSpacing: "0.1em",
                              textTransform: "uppercase" }}>days</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 12 }}>{fmtDue(c.due_at)}</div>
                      {!rem.expired && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[{ v: rem.hours, u: "hrs" }, { v: rem.mins, u: "min" }].map(({ v, u }) => (
                            <div key={u} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10,
                              padding: "6px 10px", border: `1px solid ${C.border}`, textAlign: "center", minWidth: 44 }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: col, letterSpacing: "-0.02em",
                                textShadow: `0 0 12px ${glow}` }}>{v}</div>
                              <div style={{ fontSize: 8, color: C.textFaint,
                                textTransform: "uppercase", letterSpacing: "0.1em" }}>{u}</div>
                            </div>
                          ))}
                          {/* Progress % */}
                          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10,
                            padding: "6px 10px", border: `1px solid ${C.border}`, textAlign: "center", minWidth: 44 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{Math.round(pct * 100)}%</div>
                            <div style={{ fontSize: 8, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>done</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button onClick={ev => { ev.stopPropagation(); deleteCountdown(c.id); }}
                      style={{ background: "none", border: "none", color: "rgba(255,107,138,0.4)",
                        fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>

                  {!rem.expired && (
                    <div style={{ marginTop: 14, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct * 100}%`, background: `linear-gradient(90deg,${col},${glow})`,
                        borderRadius: 1, boxShadow: `0 0 8px ${glow}`, transition: "width 0.9s ease" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Bills Tab ────────────────────────────────────────────────────────────────
function BillsTab({ now }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selDay, setSelDay] = useState(null);
  const [subName, setSubName] = useState("");
  const [subAmt, setSubAmt] = useState("");
  const [subDay, setSubDay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSubs(); }, []);

  const fetchSubs = async () => {
    setLoading(true);
    const { data } = await supabase.from("subscriptions").select("*").order("day_of_month", { ascending: true });
    if (data) setSubs(data);
    setLoading(false);
  };

  const addSub = async () => {
    const name = subName.trim(), amount = parseFloat(subAmt), day = parseInt(subDay, 10);
    if (!name || isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) return;
    setSaving(true);
    const { data } = await supabase.from("subscriptions").insert({ name, amount, day_of_month: day }).select().single();
    if (data) setSubs(prev => [...prev, data].sort((a,b) => a.day_of_month - b.day_of_month));
    setSubName(""); setSubAmt(""); setSubDay(""); setSaving(false);
  };

  const deleteSub = async id => {
    await supabase.from("subscriptions").delete().eq("id", id);
    setSubs(prev => prev.filter(s => s.id !== id));
  };

  const year = now.getFullYear(), month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const byDay = {};
  subs.forEach(s => { if (!byDay[s.day_of_month]) byDay[s.day_of_month] = []; byDay[s.day_of_month].push(s); });
  const upcoming = subs.filter(s => s.day_of_month >= todayDate).reduce((sum,s) => sum + Number(s.amount), 0);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const glass = {
    background: `linear-gradient(135deg,${C.glass} 0%,${C.glass2} 100%)`,
    border: `1px solid ${C.border}`, borderRadius: C.cardRadius,
    boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  };

  const inp = {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
    borderRadius: 12, color: C.text, fontSize: 14, padding: "10px 12px", outline: "none",
    fontFamily: "'Inter','Segoe UI',sans-serif",
  };

  return (
    <div className="wm-tab" style={{ minHeight: "100dvh", padding: "56px 16px 100px",
      fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 10, position: "relative" }}>

      <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, marginBottom: 16 }}>{monthLabel}</div>

      <div style={{ ...glass, padding: "14px 10px 12px", marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 8 }}>
          {["S","M","T","W","T","F","S"].map((d,i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 10, color: C.textFaint,
              fontWeight: 600, letterSpacing: "0.08em" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px 2px" }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const isPast = d < todayDate, isToday = d === todayDate, isSel = selDay === d;
            const hasBills = (byDay[d] || []).length > 0;
            const dotCount = Math.min((byDay[d] || []).length, 3);
            const dayUrgent = d === todayDate && hasBills;
            return (
              <div key={d} className={hasBills ? "wm-btn" : undefined}
                onClick={() => hasBills && setSelDay(isSel ? null : d)}
                style={{ position: "relative", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", height: 40, borderRadius: 12,
                  cursor: hasBills ? "pointer" : "default",
                  background: isSel ? C.accentSoft : dayUrgent ? "rgba(255,154,74,0.08)" : "transparent",
                  border: isToday ? `1px solid ${C.accent}` : isSel ? `1px solid ${C.border2}` : "1px solid transparent",
                  boxShadow: isToday ? `0 0 12px ${C.accentGlow}` : isSel ? `0 0 10px ${C.accentGlow}` : "none",
                  transition: "all 0.18s ease" }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, lineHeight: 1,
                  color: isToday ? C.accent : isPast ? C.textFaint : C.text,
                  marginBottom: hasBills ? 2 : 0 }}>{d}</span>
                {hasBills && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: dotCount }).map((_, di) => (
                      <div key={di} style={{ width: 3, height: 3, borderRadius: "50%",
                        background: dayUrgent ? C.amber : C.amber,
                        boxShadow: `0 0 4px ${C.amberGlow}`,
                        animation: dayUrgent ? "glowPulse 1.8s ease-in-out infinite" : "none" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selDay !== null && (
        <div className="wm-fade" style={{ ...glass, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 8, fontWeight: 500 }}>
            {now.toLocaleDateString("en-US", { month: "long" })} {selDay}
          </div>
          {(byDay[selDay] || []).map(sub => (
            <div key={sub.id} style={{ display: "flex", alignItems: "center",
              justifyContent: "space-between", padding: "6px 0" }}>
              <div>
                <div style={{ fontSize: 14, color: C.text }}>{sub.name}</div>
                <div style={{ fontSize: 12, color: C.amber }}>{fmt(sub.amount)}/mo</div>
              </div>
              <button onClick={() => deleteSub(sub.id)}
                style={{ background: "none", border: "none", color: "rgba(255,107,138,0.4)",
                  fontSize: 18, cursor: "pointer", padding: "4px 6px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {subs.length > 0 && (
        <div style={{ ...glass, padding: "10px 14px", marginBottom: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 500 }}>Upcoming this month</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.amber,
            textShadow: `0 0 14px ${C.amberGlow}` }}>{fmt(upcoming)}</span>
        </div>
      )}

      <div style={{ ...glass, padding: "14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
          textTransform: "uppercase", fontWeight: 500 }}>Add Subscription</div>
        <input style={{ ...inp, width: "100%" }} type="text" placeholder="Name (e.g. Netflix)"
          value={subName} maxLength={60} disabled={saving} onChange={e => setSubName(e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 2 }} type="number" inputMode="decimal"
            placeholder="Amount" value={subAmt} min="0" disabled={saving} onChange={e => setSubAmt(e.target.value)} />
          <input style={{ ...inp, flex: 1 }} type="number" inputMode="numeric"
            placeholder="Day" value={subDay} min="1" max="31" disabled={saving} onChange={e => setSubDay(e.target.value)} />
        </div>
        <button className="wm-btn" onClick={addSub} disabled={saving}
          style={{ border: `1px solid ${C.border2}`, borderRadius: C.btnRadius,
            background: `linear-gradient(135deg,${C.amberSoft},rgba(255,154,74,0.06))`,
            color: C.amber, fontSize: 14, fontWeight: 600, padding: "10px 0",
            opacity: saving ? 0.4 : 1, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
          + Add Subscription
        </button>
      </div>

      {!loading && subs.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
            textTransform: "uppercase", fontWeight: 500, marginBottom: 8 }}>Active</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {subs.map(sub => {
              const isUpcoming = sub.day_of_month >= todayDate;
              return (
                <div key={sub.id} className="wm-lift"
                  style={{ ...glass, borderRadius: 14, padding: "10px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    border: `1px solid ${isUpcoming ? "rgba(255,154,74,0.14)" : C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: C.amber, fontWeight: 700, minWidth: 22, textAlign: "right",
                      textShadow: isUpcoming ? `0 0 10px ${C.amberGlow}` : "none" }}>
                      {sub.day_of_month}
                    </span>
                    <span style={{ fontSize: 14, color: C.text }}>{sub.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.rose }}>-{fmt(sub.amount)}</span>
                    <button onClick={() => deleteSub(sub.id)}
                      style={{ background: "none", border: "none", color: "rgba(255,107,138,0.4)",
                        fontSize: 18, cursor: "pointer", padding: "4px 6px", lineHeight: 1 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: "center", color: C.textFaint, padding: "20px 0", fontSize: 13 }}>Loading…</div>}
    </div>
  );
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────
function InsightsTab({ entries, now }) {
  const ws = sundayOf(now);
  const lastWs = new Date(ws); lastWs.setDate(ws.getDate() - 7);
  const lastWe = new Date(ws); lastWe.setMilliseconds(-1);

  const thisWeekEntries = entries.filter(e => entryDate(e) >= ws);
  const lastWeekEntries = entries.filter(e => { const t = entryDate(e); return t >= lastWs && t <= lastWe; });
  const thisWeekNet = thisWeekEntries.reduce((s,e) => s + Number(e.change), 0);
  const lastWeekNet = lastWeekEntries.reduce((s,e) => s + Number(e.change), 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthNet = entries.filter(e => entryDate(e) >= monthStart).reduce((s,e) => s + Number(e.change), 0);
  const allTime = entries.reduce((s,e) => s + Number(e.change), 0);
  const weekDiff = lastWeekNet !== 0 ? ((thisWeekNet - lastWeekNet) / Math.abs(lastWeekNet)) * 100 : null;

  // Daily nets for last 14 days
  const dailyNets = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (13 - i)); d.setHours(0,0,0,0);
    const de = new Date(d); de.setHours(23,59,59,999);
    return {
      net: entries.filter(e => { const ts = entryDate(e); return ts >= d && ts <= de; }).reduce((s,e) => s + Number(e.change), 0),
      isToday: i === 13,
    };
  });

  const maxAbs = Math.max(...dailyNets.map(d => Math.abs(d.net)), 1);

  const glass = {
    background: `linear-gradient(135deg,${C.glass} 0%,${C.glass2} 100%)`,
    border: `1px solid ${C.border}`, borderRadius: C.cardRadius,
    boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  };

  return (
    <div className="wm-tab" style={{ minHeight: "100dvh", padding: "56px 16px 100px",
      fontFamily: "'Inter','Segoe UI',sans-serif", zIndex: 10, position: "relative" }}>

      <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, marginBottom: 16 }}>Flow Insights</div>

      {/* Week comparison */}
      <div style={{ ...glass, padding: "18px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
          textTransform: "uppercase", fontWeight: 500, marginBottom: 14 }}>Weekly Momentum</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "This Week", net: thisWeekNet },
            { label: "Last Week", net: lastWeekNet },
          ].map(({ label, net }) => (
            <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 14,
              padding: "14px", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg,transparent,${net < 0 ? C.rose : C.teal}50,transparent)` }} />
              <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em",
                color: net < 0 ? C.rose : C.teal,
                textShadow: `0 0 18px ${net < 0 ? C.roseGlow : C.tealGlow}` }}>
                {net > 0 ? "+" : ""}{fmt(net)}
              </div>
            </div>
          ))}
        </div>
        {weekDiff !== null && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600,
            color: weekDiff >= 0 ? C.teal : C.rose,
            textShadow: `0 0 12px ${weekDiff >= 0 ? C.tealGlow : C.roseGlow}` }}>
            {weekDiff >= 0 ? "↑" : "↓"} {Math.abs(weekDiff).toFixed(1)}% vs last week
          </div>
        )}
      </div>

      {/* 14-day animated bar chart */}
      <div style={{ ...glass, padding: "18px", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.13em",
          textTransform: "uppercase", fontWeight: 500, marginBottom: 14 }}>14-Day Flow</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
          {dailyNets.map(({ net, isToday }, i) => {
            const h = Math.max(4, (Math.abs(net) / maxAbs) * 72);
            const col = net < 0 ? C.rose : C.teal;
            const glow = net < 0 ? C.roseGlow : C.tealGlow;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end", height: 80 }}>
                <div className="wm-insight-bar"
                  style={{ width: "100%", height: h, borderRadius: "3px 3px 2px 2px",
                    background: `linear-gradient(to top,${col},${glow})`,
                    boxShadow: `0 0 ${isToday ? 12 : 6}px ${glow}`,
                    opacity: isToday ? 1 : 0.5,
                    animationDelay: `${i * 0.04}s` }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 9, color: C.textFaint }}>14 days ago</span>
          <span style={{ fontSize: 9, color: C.accent, fontWeight: 600 }}>Today</span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "This Month", value: fmt(monthNet), col: monthNet < 0 ? C.rose : C.teal, glow: monthNet < 0 ? C.roseGlow : C.tealGlow },
          { label: "All Time", value: fmt(allTime), col: allTime < 0 ? C.rose : C.accent, glow: allTime < 0 ? C.roseGlow : C.accentGlow },
          { label: "Transactions", value: entries.length, col: C.violet, glow: C.violetGlow },
          { label: "Avg / Day (wk)", value: fmt(thisWeekNet / Math.max(1, now.getDay() + 1)), col: C.textMuted, glow: "none" },
        ].map(({ label, value, col, glow }, idx) => (
          <div key={label} className="wm-lift wm-fade"
            style={{ ...glass, borderRadius: 16, padding: "14px 16px",
              position: "relative", overflow: "hidden",
              animationDelay: `${idx * 0.08}s` }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1,
              background: glow !== "none" ? `linear-gradient(90deg,transparent,${glow},transparent)` : "none" }} />
            <div style={{ fontSize: 10, color: C.textFaint, letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: col,
              textShadow: glow !== "none" ? `0 0 16px ${glow}` : "none",
              letterSpacing: "-0.01em" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PIN Lock ─────────────────────────────────────────────────────────────────
const CORRECT_PIN = "0204";

function PinLock({ onUnlock }) {
  const [digits, setDigits] = useState([]);
  const [shake, setShake] = useState(false);

  const press = d => {
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

  const keys = [1,2,3,4,5,6,7,8,9,null,0,"del"];

  return (
    <>
      <WaveBackground />
      <div style={{ position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter','Segoe UI',sans-serif", gap: 48 }}>

        <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.22em",
          textTransform: "uppercase", fontWeight: 500,
          textShadow: `0 0 20px ${C.accentGlow}` }}>
          Kingdom Builder
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center",
          animation: shake ? "shake 0.5s ease" : "none" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 13, height: 13, borderRadius: "50%",
              background: i < digits.length ? C.accent : "transparent",
              border: `2px solid ${i < digits.length ? C.accent : C.textFaint}`,
              boxShadow: i < digits.length ? `0 0 14px ${C.accentGlow}, 0 0 28px ${C.accentGlow}` : "none",
              transition: "all 0.14s ease" }} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,72px)", gap: 12 }}>
          {keys.map((k, i) => {
            if (k === null) return <div key={i} />;
            const isDel = k === "del";
            return (
              <button key={i} className="wm-btn"
                onPointerDown={() => isDel ? setDigits(p => p.slice(0, -1)) : press(k)}
                style={{ width: 72, height: 72, borderRadius: "50%",
                  background: isDel ? "transparent" :
                    "linear-gradient(135deg,rgba(11,18,36,0.9),rgba(15,24,48,0.8))",
                  border: isDel ? "none" : `1px solid ${C.border2}`,
                  color: isDel ? C.textFaint : C.text,
                  fontSize: isDel ? 20 : 26, fontWeight: 500, cursor: "pointer",
                  fontFamily: "'Inter','Segoe UI',sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isDel ? "none" : `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
                  userSelect: "none" }}>
                {isDel ? "⌫" : k}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Edit Entry Modal ─────────────────────────────────────────────────────────
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
    setSaving(false); onClose();
  };

  const handleDelete = async () => {
    setSaving(true);
    await onDelete(entry.id);
    setSaving(false); onClose();
  };

  const inp = {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
    borderRadius: 14, color: C.text, outline: "none", width: "100%",
    fontFamily: "'Inter','Segoe UI',sans-serif",
  };

  return (
    <div onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="wm-slide"
        style={{ width: "100%", maxWidth: 480,
          background: "linear-gradient(135deg,rgba(11,18,36,0.97) 0%,rgba(18,28,58,0.95) 100%)",
          borderRadius: "26px 26px 0 0", padding: "20px 20px 44px",
          border: `1px solid ${C.border2}`, borderBottom: "none",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", gap: 12,
          fontFamily: "'Inter','Segoe UI',sans-serif", position: "relative" }}>

        <div style={{ position: "absolute", top: 0, left: "30%", right: "30%", height: 1,
          background: `linear-gradient(90deg,transparent,${C.border2},transparent)` }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.12em",
            textTransform: "uppercase", fontWeight: 600 }}>Edit Transaction</span>
          <button onPointerDown={onClose}
            style={{ background: "none", border: "none", color: C.textFaint, fontSize: 22,
              cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: 11, color: C.textFaint }}>
          {entryDate(entry).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          {" · "}{entryDate(entry).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>

        <input style={{ ...inp, fontSize: 20, padding: "12px 16px", fontWeight: 700 }}
          type="number" inputMode="decimal" placeholder="0.00"
          value={amount} min="0" disabled={saving}
          onChange={e => setAmount(e.target.value)} />

        <input style={{ ...inp, fontSize: 14, padding: "9px 16px", color: C.textMuted }}
          type="text" placeholder="Note (optional)" value={note} maxLength={80} disabled={saving}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }} />

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button className="wm-btn" onPointerDown={handleSave} disabled={saving}
            style={{ flex: 1, border: `1px solid ${isNeg ? "rgba(255,107,138,0.25)" : "rgba(88,245,195,0.25)"}`,
              borderRadius: C.btnRadius, background: isNeg ? C.roseSoft : C.tealSoft,
              color: isNeg ? C.rose : C.teal, fontSize: 16, fontWeight: 700, padding: "13px 0",
              opacity: saving ? 0.4 : 1, fontFamily: "'Inter','Segoe UI',sans-serif" }}>Save</button>
          <button className="wm-btn" onPointerDown={handleDelete} disabled={saving}
            style={{ flex: "none", border: `1px solid rgba(255,107,138,0.2)`, borderRadius: C.btnRadius,
              background: "transparent", color: C.rose, fontSize: 15, fontWeight: 600, padding: "13px 20px",
              opacity: saving ? 0.4 : 1, cursor: "pointer",
              fontFamily: "'Inter','Segoe UI',sans-serif" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Countdown Modal ─────────────────────────────────────────────────────
function EditCountdownModal({ countdown, onSave, onClose }) {
  const existing = new Date(countdown.due_at);
  const pad2 = n => String(n).padStart(2, "0");
  const [label, setLabel] = useState(countdown.label);
  const [dueDate, setDueDate] = useState(`${existing.getFullYear()}-${pad2(existing.getMonth()+1)}-${pad2(existing.getDate())}`);
  const [dueTime, setDueTime] = useState(`${pad2(existing.getHours())}:${pad2(existing.getMinutes())}`);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimLabel = label.trim();
    if (!trimLabel || !dueDate) return;
    const due = new Date(`${dueDate}T${dueTime || "00:00"}:00`);
    if (isNaN(due.getTime())) return;
    setSaving(true);
    await onSave(countdown.id, trimLabel, due.toISOString());
    setSaving(false); onClose();
  };

  const inp = {
    background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`,
    borderRadius: 13, color: C.text, fontSize: 14, padding: "10px 13px", outline: "none",
    fontFamily: "'Inter','Segoe UI',sans-serif",
  };

  return (
    <div onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="wm-slide"
        style={{ width: "100%", maxWidth: 480,
          background: "linear-gradient(135deg,rgba(11,18,36,0.97) 0%,rgba(18,28,58,0.95) 100%)",
          borderRadius: "26px 26px 0 0", padding: "20px 20px 44px",
          border: `1px solid ${C.border2}`, borderBottom: "none",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex", flexDirection: "column", gap: 12,
          fontFamily: "'Inter','Segoe UI',sans-serif" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.12em",
            textTransform: "uppercase", fontWeight: 600 }}>Edit Countdown</span>
          <button onPointerDown={onClose}
            style={{ background: "none", border: "none", color: C.textFaint, fontSize: 22,
              cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
        </div>

        <input style={{ ...inp, width: "100%" }} type="text" placeholder="Event name"
          value={label} maxLength={80} disabled={saving}
          onChange={e => setLabel(e.target.value)} />

        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...inp, flex: 3 }} type="date" value={dueDate}
            disabled={saving} onChange={e => setDueDate(e.target.value)} />
          <input style={{ ...inp, flex: 2 }} type="time" value={dueTime}
            disabled={saving} onChange={e => setDueTime(e.target.value)} />
        </div>

        <button className="wm-btn" onPointerDown={handleSave}
          disabled={saving || !label.trim() || !dueDate}
          style={{ border: `1px solid ${C.border2}`, borderRadius: C.btnRadius,
            background: `linear-gradient(135deg,${C.accentSoft},${C.violetSoft})`,
            color: C.accent, fontSize: 15, fontWeight: 600, padding: "13px 0",
            opacity: (saving || !label.trim() || !dueDate) ? 0.4 : 1,
            fontFamily: "'Inter','Segoe UI',sans-serif" }}>Save</button>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("kb_unlocked") === "1");
  const [activeTab, setActiveTab] = useState("home");
  const [tabVisible, setTabVisible] = useState(true);
  const [pendingTab, setPendingTab] = useState(null);
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

  const weekSundayOf = d => { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0,0,0,0); return s; };

  // Tab transition
  const switchTab = id => {
    if (id === activeTab) return;
    setTabVisible(false);
    setPendingTab(id);
  };

  useEffect(() => {
    if (!tabVisible && pendingTab) {
      const t = setTimeout(() => {
        setActiveTab(pendingTab);
        setPendingTab(null);
        setTabVisible(true);
      }, 160);
      return () => clearTimeout(t);
    }
  }, [tabVisible, pendingTab]);

  useEffect(() => { fetchEntries().then(runSubscriptionDeductions); }, []);

  useEffect(() => {
    let timer;
    const schedule = () => {
      const n = new Date(), midnight = new Date(n); midnight.setHours(24,0,0,0);
      timer = setTimeout(() => { setNow(new Date()); setSelectedDay(new Date()); schedule(); }, midnight - n);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const runSubscriptionDeductions = async () => {
    const { data: subs } = await supabase.from("subscriptions").select("*");
    if (!subs || !subs.length) return;
    const today = new Date();
    const todayNum = today.getDate();
    const todayStr = today.toLocaleDateString("en-CA");
    const due = subs.filter(s => s.day_of_month === todayNum);
    if (!due.length) return;
    const { data: todayEntries } = await supabase.from("money_entries").select("*")
      .gte("ts", `${todayStr}T00:00:00`).lte("ts", `${todayStr}T23:59:59`);
    const midnight = new Date(`${todayStr}T00:00:00`).toISOString();
    for (const sub of due) {
      const note = `Subscription for ${sub.name}`;
      const already = (todayEntries || []).some(e => e.note === note);
      if (!already) {
        const { data } = await supabase.from("money_entries")
          .insert({ change: -Math.abs(Number(sub.amount)), note, ts: midnight, created_at: midnight })
          .select().single();
        if (data) {
          setEntries(prev => [data, ...prev]);
          const ws = weekSundayOf(new Date());
          if (new Date(data.ts) >= ws) setBalance(prev => prev + Number(data.change));
        }
      }
    }
  };

  const fetchEntries = async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.from("money_entries").select("*").order("created_at", { ascending: false });
    if (err) { setError(err.message); }
    else if (data) {
      setEntries(data);
      const ws = weekSundayOf(new Date());
      setBalance(data.filter(e => entryDate(e) >= ws).reduce((s,e) => s + Number(e.change), 0));
    }
    setLoading(false);
  };

  const apply = async sign => {
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) return;
    setSaving(true); setError(null);
    const target = selectedDay || now;
    const opt = { id: crypto.randomUUID(), change: sign * val, note: note.trim() || null,
      ts: target.toISOString(), created_at: target.toISOString() };
    setEntries(prev => [opt, ...prev]);
    const ws = weekSundayOf(new Date());
    if (new Date(opt.ts) >= ws) setBalance(prev => prev + opt.change);
    setAmount(""); setNote("");
    const { data, error: err } = await supabase.from("money_entries")
      .insert({ change: opt.change, note: opt.note, ts: opt.ts, created_at: opt.created_at })
      .select().single();
    if (err) setError("Not saved: " + err.message);
    else if (data) setEntries(prev => prev.map(e => e.id === opt.id ? data : e));
    setSaving(false);
  };

  const reset = async () => {
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("money_entries").delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (err) setError(err.message);
    else { setEntries([]); setBalance(0); }
    setShowReset(false); setSaving(false);
  };

  const deleteEntry = async id => {
    const target = entries.find(e => e.id === id);
    if (!target) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    const ws = weekSundayOf(new Date());
    if (entryDate(target) >= ws) setBalance(prev => prev - Number(target.change));
    await supabase.from("money_entries").delete().eq("id", id);
  };

  const updateEntry = async (id, newChange, newNote) => {
    const ws = weekSundayOf(new Date());
    const prev = entries.find(e => e.id === id);
    if (!prev) return;
    setEntries(list => list.map(e => e.id === id ? { ...e, change: newChange, note: newNote } : e));
    if (entryDate(prev) >= ws) setBalance(b => b - Number(prev.change) + newChange);
    await supabase.from("money_entries").update({ change: newChange, note: newNote }).eq("id", id);
  };

  const handleKey = e => { if (e.key === "Enter") apply(1); };

  if (!unlocked) return <PinLock onUnlock={() => setUnlocked(true)} />;

  const tabProps = {
    entries, balance, loading, saving, error, now,
    selectedDay, setSelectedDay, amount, setAmount, note, setNote,
    apply, deleteEntry, setEditingEntry, reset, showReset, setShowReset, handleKey,
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <WaveBackground />

      {editingEntry && (
        <EditEntryModal entry={editingEntry} onSave={updateEntry} onDelete={deleteEntry}
          onClose={() => setEditingEntry(null)} />
      )}

      {/* Tab content with transition */}
      <div style={{
        opacity: tabVisible ? 1 : 0,
        transform: tabVisible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 0.16s ease, transform 0.16s ease",
      }}>
        {activeTab === "home" && <HomeTab {...tabProps} />}
        {activeTab === "timeline" && <TimelineTab entries={entries} now={now} deleteEntry={deleteEntry} setEditingEntry={setEditingEntry} />}
        {activeTab === "countdown" && <CountdownTab />}
        {activeTab === "bills" && <BillsTab now={now} />}
        {activeTab === "insights" && <InsightsTab entries={entries} now={now} />}
      </div>

      <FloatingDock activeTab={activeTab} setActiveTab={switchTab} />
    </>
  );
}
