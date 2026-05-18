import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import {
  getGeminiKey,
  setGeminiKey,
  getGeminiModel,
  setGeminiModel,
  sendToMentor,
  handleRememberThis,
  handleForgetThis,
  detectKeyword,
  getMemories,
  archiveMemory,
  updateMemory,
  getTodayState,
  saveDailyState,
  clearChat,
} from "./mentor";

if (typeof document !== "undefined" && !document.getElementById("mentor-kf")) {
  const s = document.createElement("style");
  s.id = "mentor-kf";
  s.textContent = `
    @keyframes mentorPulse{0%,60%,100%{opacity:.2;transform:scale(.75)}30%{opacity:1;transform:scale(1)}}
    @keyframes mentorFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes mentorGlow{0%,100%{opacity:0.5}50%{opacity:1}}
  `;
  document.head.appendChild(s);
}

const CAT_LABELS = {
  profile: "Profile",
  current_goal: "Goals",
  habit_pattern: "Habits",
  reminder: "Reminders",
  task: "Tasks",
  preference: "Preferences",
  struggle: "Struggles",
  win: "Wins",
  schedule: "Schedule",
  long_term_plan: "Long-term",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MentorChat() {
  const [view, setView] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState([]);
  const [apiKey, setApiKeyState] = useState(getGeminiKey);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState(getGeminiModel);
  const [todayState, setTodayState] = useState(null);
  const [checkIn, setCheckIn] = useState({ prayer: false, workout: false, smoked: false, mood: 5, energy: 5 });
  const [editingMem, setEditingMem] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!apiKey) { setView("setup"); return; }
    loadMessages();
    getTodayState().then(setTodayState);
  }, [apiKey]);

  useEffect(() => {
    if (view === "memory") loadMemories();
  }, [view]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function loadMessages() {
    const { data } = await supabase
      .from("mentor_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    setMessages((data || []).reverse());
  }

  async function loadMemories() {
    const data = await getMemories();
    setMemories(data);
  }

  function appendLocal(role, content) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, created_at: new Date().toISOString() },
    ]);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const kw = detectKeyword(text);
    if (kw?.type === "show_memory") { setView("memory"); return; }
    if (kw?.type === "checkin") { setView("checkin"); return; }
    if (kw?.type === "remember") {
      setLoading(true);
      appendLocal("user", text);
      const result = await handleRememberThis(kw.value);
      appendLocal("assistant", result);
      setLoading(false);
      return;
    }
    if (kw?.type === "forget") {
      setLoading(true);
      appendLocal("user", text);
      const result = await handleForgetThis(kw.value);
      appendLocal("assistant", result);
      setLoading(false);
      return;
    }

    appendLocal("user", text);
    setLoading(true);
    try {
      const response = await sendToMentor(text);
      appendLocal("assistant", response);
    } catch (err) {
      const msg =
        err.message === "NO_KEY"
          ? "No API key set. Tap ⚙ to add your Gemini key."
          : err.message === "RATE_LIMIT"
          ? "Rate limit hit. Your API key needs billing enabled.\n\nGo to console.cloud.google.com → select your project → Billing → Link a billing account.\n\nGemini costs ~$0.10/month for normal use."
          : `Error: ${err.message}`;
      appendLocal("assistant", msg);
    }
    setLoading(false);
  }

  function saveKey() {
    const k = apiKeyInput.trim();
    if (!k) return;
    setGeminiKey(k);
    setApiKeyState(k);
    setApiKeyInput("");
    if (modelInput.trim()) setGeminiModel(modelInput.trim());
    setView("chat");
  }

  async function submitCheckIn() {
    const state = {
      prayer_completed: checkIn.prayer,
      workout_completed: checkIn.workout,
      smoked_today: checkIn.smoked,
      mood: checkIn.mood,
      energy: checkIn.energy,
    };
    await saveDailyState(state);
    setTodayState({ ...state, date: new Date().toLocaleDateString("en-CA") });

    const summary =
      `Daily check-in — Prayer: ${checkIn.prayer ? "done" : "not yet"}. ` +
      `Workout: ${checkIn.workout ? "done" : "not yet"}. ` +
      `Smoked: ${checkIn.smoked ? "yes" : "no"}. ` +
      `Mood: ${checkIn.mood}/10. Energy: ${checkIn.energy}/10. ` +
      `What should I focus on now?`;

    setView("chat");
    appendLocal("user", "daily check-in");
    setLoading(true);
    try {
      const response = await sendToMentor(summary);
      appendLocal("assistant", response);
    } catch (err) {
      appendLocal("assistant", `Check-in saved. Error: ${err.message}`);
    }
    setLoading(false);
  }

  async function handleClearChat() {
    if (clearing || loading) return;
    setClearing(true);
    await clearChat(apiKey);
    setMessages([]);
    setClearing(false);
  }

  // ── Views ──────────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <SetupView
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        modelInput={modelInput}
        setModelInput={setModelInput}
        onSave={saveKey}
        hasKey={!!apiKey}
        onBack={apiKey ? () => setView("chat") : null}
      />
    );
  }

  if (view === "memory") {
    return (
      <MemoryView
        memories={memories}
        onBack={() => setView("chat")}
        editingMem={editingMem}
        editContent={editContent}
        setEditingMem={setEditingMem}
        setEditContent={setEditContent}
        onArchive={async (id) => { await archiveMemory(id); loadMemories(); }}
        onUpdate={async (id, c) => { await updateMemory(id, c); setEditingMem(null); loadMemories(); }}
      />
    );
  }

  if (view === "checkin") {
    return (
      <CheckInView
        checkIn={checkIn}
        setCheckIn={setCheckIn}
        onBack={() => setView("chat")}
        onSubmit={submitCheckIn}
      />
    );
  }

  // ── Chat View ──────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={{ position: "relative" }}>
            <div style={S.avatar}>M</div>
            <div style={S.onlineDot} />
          </div>
          <div>
            <div style={S.headerName}>Mentor</div>
            <div style={S.headerSub}>{loading ? "typing..." : "online"}</div>
          </div>
        </div>
        <div style={S.headerActions}>
          {todayState && (
            <div style={S.statusPills}>
              {todayState.prayer_completed && <Pill label="prayed" color="#6bffb8" />}
              {todayState.workout_completed && <Pill label="workout" color="#6bffb8" />}
              {todayState.smoked_today && <Pill label="smoked" color="#ff6b6b" />}
            </div>
          )}
          <IconBtn onClick={handleClearChat} title="Clear chat" disabled={clearing || loading}>
            {clearing ? "…" : "⌫"}
          </IconBtn>
          <IconBtn onClick={() => setView("checkin")} title="Daily check-in">✓</IconBtn>
          <IconBtn onClick={() => setView("memory")} title="Memory">◈</IconBtn>
          <IconBtn onClick={() => setView("setup")} title="Settings">⚙</IconBtn>
        </div>
      </div>

      <div style={S.messages} ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div style={S.empty}>
            <div style={S.emptyGlow} />
            <div style={S.emptyAvatar}>M</div>
            <div style={S.emptyTitle}>Mentor</div>
            <div style={S.emptyHint}>Your personal accountability partner.</div>
            <div style={S.shortcuts}>
              {[
                "What should I do next?",
                "daily check-in",
                "Update my plan",
                "what do you remember about me?",
              ].map((label) => (
                <button
                  key={label}
                  style={S.shortcutBtn}
                  onClick={() => { setInput(label); textareaRef.current?.focus(); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {loading && <TypingIndicator />}
      </div>

      <div style={S.inputBar}>
        <textarea
          ref={textareaRef}
          style={S.textarea}
          placeholder="Message Mentor..."
          value={input}
          rows={1}
          disabled={loading}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button
          style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.3 : 1 }}
          onClick={send}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 4,
        animation: "mentorFadeUp 0.18s ease",
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          background: isUser
            ? "linear-gradient(145deg, #0c2118 0%, #102a1c 100%)"
            : "#111111",
          border: `1px solid ${isUser ? "#1b3d2a" : "#1d1d1d"}`,
          borderRadius: isUser ? "20px 20px 5px 20px" : "20px 20px 20px 5px",
          padding: "11px 16px",
          color: isUser ? "#cdfce6" : "#d6d6d6",
          fontSize: 15,
          lineHeight: 1.58,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: isUser
            ? "0 2px 16px rgba(107,255,184,0.05)"
            : "0 1px 6px rgba(0,0,0,0.5)",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 4 }}>
      <div
        style={{
          background: "#111111",
          border: "1px solid #1d1d1d",
          borderRadius: "20px 20px 20px 5px",
          padding: "14px 18px",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#6bffb8",
              animation: `mentorPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ label, color }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
        background: color + "14",
        border: `1px solid ${color}22`,
        borderRadius: 20,
        padding: "3px 8px",
      }}
    >
      {label}
    </span>
  );
}

// ─── Icon Button ──────────────────────────────────────────────────────────────
function IconBtn({ onClick, title, children, disabled }) {
  return (
    <button
      style={{ ...S.iconBtn, opacity: disabled ? 0.3 : 1 }}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// ─── Setup View ───────────────────────────────────────────────────────────────
function SetupView({ apiKeyInput, setApiKeyInput, modelInput, setModelInput, onSave, hasKey, onBack }) {
  return (
    <div style={S.wrap}>
      {onBack && (
        <div style={S.header}>
          <button style={S.backBtn} onClick={onBack}>← Back</button>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#d0d0d0", letterSpacing: "-0.01em" }}>Settings</div>
          <div style={{ width: 60 }} />
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px 52px", gap: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.03em" }}>
          {hasKey ? "Update API Key" : "Activate Mentor"}
        </div>
        <p style={{ fontSize: 14, color: "#555", lineHeight: 1.65, margin: 0 }}>
          Get a free key at{" "}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "#6bffb8", textDecoration: "none", fontWeight: 600 }}>
            aistudio.google.com
          </a>
        </p>
        <p style={{ fontSize: 11, color: "#2e2e2e", margin: 0 }}>
          Stored locally in your browser only. If you get a 404, update the model name below.
        </p>
        <input
          style={S.keyInput}
          type="password"
          placeholder="AIza... (API Key)"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          autoComplete="off"
        />
        <input
          style={{ ...S.keyInput, fontFamily: "monospace", fontSize: 13 }}
          type="text"
          placeholder="Model (e.g. gemini-2.5-flash)"
          value={modelInput}
          onChange={(e) => setModelInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          autoComplete="off"
        />
        <button
          style={{ ...S.primaryBtn, opacity: apiKeyInput.trim() ? 1 : 0.35 }}
          onClick={onSave}
          disabled={!apiKeyInput.trim()}
        >
          {hasKey ? "Update Key" : "Activate Mentor"}
        </button>
      </div>
    </div>
  );
}

// ─── Memory Viewer ────────────────────────────────────────────────────────────
function MemoryView({ memories, onBack, editingMem, editContent, setEditingMem, setEditContent, onArchive, onUpdate }) {
  const grouped = {};
  memories.forEach((m) => {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  });

  const catOrder = [
    "profile", "schedule", "current_goal", "long_term_plan",
    "task", "reminder", "habit_pattern", "struggle", "win", "preference",
  ];
  const orderedCats = [
    ...catOrder.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !catOrder.includes(c)),
  ];

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#d0d0d0", letterSpacing: "-0.01em" }}>Memory</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
        {orderedCats.length === 0 && (
          <div style={{ color: "#2e2e2e", fontSize: 14, textAlign: "center", marginTop: 70 }}>
            No memories yet. Start chatting with Mentor.
          </div>
        )}
        {orderedCats.map((cat) => (
          <div key={cat}>
            <div style={S.catLabel}>{CAT_LABELS[cat] || cat}</div>
            {grouped[cat].map((m) => (
              <div key={m.id} style={S.memItem}>
                {editingMem === m.id ? (
                  <div style={{ flex: 1, display: "flex", gap: 8, flexDirection: "column" }}>
                    <textarea
                      style={{ ...S.keyInput, fontSize: 13, resize: "none", minHeight: 64 }}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.primaryBtn, fontSize: 13, padding: "10px 14px", flex: 1 }} onClick={() => onUpdate(m.id, editContent)}>Save</button>
                      <button style={S.cancelBtn} onClick={() => setEditingMem(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{m.content}</div>
                      <div style={{ fontSize: 9, color: "#252525", marginTop: 4, letterSpacing: "0.06em" }}>importance {m.importance}</div>
                    </div>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button style={S.memBtn} onClick={() => { setEditingMem(m.id); setEditContent(m.content); }}>✎</button>
                      <button style={{ ...S.memBtn, color: "#3a1515" }} onClick={() => onArchive(m.id)}>×</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily Check-in ───────────────────────────────────────────────────────────
function CheckInView({ checkIn, setCheckIn, onBack, onSubmit }) {
  const set = (k, v) => setCheckIn((p) => ({ ...p, [k]: v }));
  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#d0d0d0", letterSpacing: "-0.01em" }}>Daily Check-in</div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px 40px", display: "flex", flexDirection: "column", gap: 26 }}>
        <YesNo label="Did you pray today?" value={checkIn.prayer} onChange={(v) => set("prayer", v)} />
        <YesNo label="Did you work out?" value={checkIn.workout} onChange={(v) => set("workout", v)} />
        <YesNo label="Did you smoke?" value={checkIn.smoked} onChange={(v) => set("smoked", v)} />
        <div>
          <div style={S.ciLabel}>Mood — {checkIn.mood}/10</div>
          <input type="range" min={1} max={10} value={checkIn.mood} onChange={(e) => set("mood", Number(e.target.value))} style={{ width: "100%", accentColor: "#6bffb8" }} />
        </div>
        <div>
          <div style={S.ciLabel}>Energy — {checkIn.energy}/10</div>
          <input type="range" min={1} max={10} value={checkIn.energy} onChange={(e) => set("energy", Number(e.target.value))} style={{ width: "100%", accentColor: "#6bffb8" }} />
        </div>
        <button style={{ ...S.primaryBtn, marginTop: 4 }} onClick={onSubmit}>
          Submit &amp; Ask Mentor
        </button>
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange }) {
  return (
    <div>
      <div style={S.ciLabel}>{label}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          style={{
            ...S.toggleBtn,
            background: value ? "#0c2118" : "#0d0d0d",
            borderColor: value ? "#1b3d28" : "#1c1c1c",
            color: value ? "#6bffb8" : "#2e2e2e",
          }}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          style={{
            ...S.toggleBtn,
            background: !value ? "#1c0e0e" : "#0d0d0d",
            borderColor: !value ? "#3a1818" : "#1c1c1c",
            color: !value ? "#ff6b6b" : "#2e2e2e",
          }}
          onClick={() => onChange(false)}
        >
          No
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    height: "calc(100dvh - 56px)",
    display: "flex",
    flexDirection: "column",
    background: "#080808",
    overflow: "hidden",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
    paddingBottom: "13px",
    paddingLeft: "16px",
    paddingRight: "12px",
    background: "rgba(8,8,8,0.9)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderBottom: "1px solid #161616",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 11,
  },
  headerActions: {
    display: "flex",
    gap: 5,
    alignItems: "center",
  },
  headerName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#efefef",
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: 11,
    color: "#353535",
    marginTop: 2,
    letterSpacing: "0.01em",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(140deg, #0c2118 0%, #183326 100%)",
    border: "1.5px solid #1e3d2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "#6bffb8",
    boxShadow: "0 0 14px rgba(107,255,184,0.1)",
    flexShrink: 0,
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#6bffb8",
    border: "2px solid #080808",
    boxShadow: "0 0 6px rgba(107,255,184,0.7)",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "18px 14px 10px",
    display: "flex",
    flexDirection: "column",
  },
  inputBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: 9,
    padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
    background: "rgba(8,8,8,0.9)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderTop: "1px solid #161616",
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: "#131313",
    border: "1px solid #222",
    borderRadius: 24,
    color: "#e8e8e8",
    fontSize: 15,
    padding: "11px 18px",
    outline: "none",
    resize: "none",
    lineHeight: 1.45,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    minHeight: 44,
    boxSizing: "border-box",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#6bffb8",
    border: "none",
    color: "#041510",
    fontSize: 20,
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 60,
    position: "relative",
  },
  emptyGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(107,255,184,0.05) 0%, transparent 68%)",
    pointerEvents: "none",
  },
  emptyAvatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(140deg, #0c2118, #1a3d28)",
    border: "1.5px solid #1e3d2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 800,
    color: "#6bffb8",
    boxShadow: "0 0 30px rgba(107,255,184,0.12)",
    marginBottom: 6,
    zIndex: 1,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: "#f0f0f0",
    letterSpacing: "-0.04em",
    zIndex: 1,
  },
  emptyHint: {
    fontSize: 13,
    color: "#2e2e2e",
    zIndex: 1,
    letterSpacing: "0.01em",
    marginBottom: 8,
  },
  shortcuts: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 10,
    width: "100%",
    maxWidth: 300,
    zIndex: 1,
  },
  shortcutBtn: {
    background: "#0e0e0e",
    border: "1px solid #1c1c1c",
    borderRadius: 14,
    color: "#383838",
    fontSize: 13,
    padding: "13px 18px",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    letterSpacing: "-0.01em",
    transition: "color 0.15s, border-color 0.15s",
  },
  iconBtn: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 10,
    color: "#484848",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    padding: "7px 10px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    lineHeight: 1,
    transition: "opacity 0.15s",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#6bffb8",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    padding: "4px 0",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    letterSpacing: "-0.01em",
  },
  statusPills: {
    display: "flex",
    gap: 5,
    alignItems: "center",
    marginRight: 2,
  },
  keyInput: {
    background: "#101010",
    border: "1px solid #202020",
    borderRadius: 14,
    color: "#e0e0e0",
    fontSize: 14,
    padding: "14px 16px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  primaryBtn: {
    background: "#6bffb8",
    border: "none",
    borderRadius: 14,
    color: "#041510",
    fontSize: 15,
    fontWeight: 700,
    padding: "15px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    letterSpacing: "-0.01em",
    transition: "opacity 0.15s",
  },
  cancelBtn: {
    background: "#111",
    border: "1px solid #202020",
    borderRadius: 10,
    color: "#444",
    fontSize: 12,
    padding: "10px 14px",
    flex: 1,
    cursor: "pointer",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  memBtn: {
    background: "none",
    border: "none",
    color: "#252525",
    fontSize: 16,
    cursor: "pointer",
    padding: "3px 6px",
    lineHeight: 1,
  },
  memItem: {
    background: "#0d0d0d",
    border: "1px solid #181818",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 6,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },
  catLabel: {
    fontSize: 10,
    color: "#282828",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginBottom: 10,
    fontWeight: 700,
  },
  ciLabel: {
    fontSize: 11,
    color: "#404040",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 10,
    fontWeight: 600,
  },
  toggleBtn: {
    flex: 1,
    border: "1px solid",
    borderRadius: 12,
    padding: "14px 0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    transition: "all 0.12s",
    letterSpacing: "-0.01em",
  },
};
