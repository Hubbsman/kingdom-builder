// ─── Aurora — modern, colorful (default) ─────────────────────────────────────
const AURORA = {
  name: "aurora",
  bg: "#0E0B1F",
  glass: "rgba(26,21,52,0.78)",
  glass2: "rgba(34,27,68,0.88)",
  border: "rgba(168,130,255,0.15)",
  border2: "rgba(168,130,255,0.3)",
  accent: "#8B5CF6",
  accentGlow: "rgba(139,92,246,0.45)",
  accentSoft: "rgba(139,92,246,0.14)",
  violet: "#EC4899",
  violetGlow: "rgba(236,72,153,0.4)",
  violetSoft: "rgba(236,72,153,0.12)",
  teal: "#34D399",
  tealGlow: "rgba(52,211,153,0.4)",
  tealSoft: "rgba(52,211,153,0.12)",
  rose: "#FB7185",
  roseGlow: "rgba(251,113,133,0.4)",
  roseSoft: "rgba(251,113,133,0.12)",
  amber: "#FBBF24",
  amberGlow: "rgba(251,191,36,0.4)",
  amberSoft: "rgba(251,191,36,0.12)",
  text: "#F8F7FF",
  textMuted: "#A8A3CE",
  textFaint: "#5C5584",
  cardRadius: 22,
  btnRadius: 16,
  pillRadius: 50,
};

// ─── Waves — the original look ────────────────────────────────────────────────
const WAVES = {
  name: "waves",
  bg: "#050816",
  glass: "rgba(11,18,36,0.78)",
  glass2: "rgba(15,24,48,0.88)",
  border: "rgba(91,124,255,0.13)",
  border2: "rgba(91,124,255,0.25)",
  accent: "#5B7CFF",
  accentGlow: "rgba(91,124,255,0.4)",
  accentSoft: "rgba(91,124,255,0.12)",
  violet: "#8B5CFF",
  violetGlow: "rgba(139,92,255,0.38)",
  violetSoft: "rgba(139,92,255,0.1)",
  teal: "#58F5C3",
  tealGlow: "rgba(88,245,195,0.38)",
  tealSoft: "rgba(88,245,195,0.1)",
  rose: "#FF6B8A",
  roseGlow: "rgba(255,107,138,0.38)",
  roseSoft: "rgba(255,107,138,0.1)",
  amber: "#FF9A4A",
  amberGlow: "rgba(255,154,74,0.38)",
  amberSoft: "rgba(255,154,74,0.1)",
  text: "#F4F7FF",
  textMuted: "#8EA0C9",
  textFaint: "#3A4F7A",
  cardRadius: 22,
  btnRadius: 16,
  pillRadius: 50,
};

export const THEMES = { aurora: AURORA, waves: WAVES };

const saved = typeof localStorage !== "undefined" ? localStorage.getItem("kb_theme") : null;
export const ACTIVE_THEME = THEMES[saved] ? saved : "aurora";

export const WM = THEMES[ACTIVE_THEME];

export function setTheme(name) {
  if (!THEMES[name]) return;
  localStorage.setItem("kb_theme", name);
  location.reload();
}
