import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import {
  getGeminiKey,
  setGeminiKey,
  sendToMentor,
  handleRememberThis,
  handleForgetThis,
  detectKeyword,
  getMemories,
  archiveMemory,
  updateMemory,
  getTodayState,
  saveDailyState,
} from "./mentor";

// Inject keyframe animation once
if (typeof document !== "undefined" && !document.getElementById("mentor-kf")) {
  const s = document.createElement("style");
  s.id = "mentor-kf";
  s.textContent = `@keyframes mentorPulse{0%,60%,100%{opacity:.25;transform:scale(.8)}30%{opacity:1;transform:scale(1)}}`;
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
  const [view, setView] = useState("chat"); // chat | memory | setup | checkin
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState([]);
  const [apiKey, setApiKeyState] = useState(getGeminiKey);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [todayState, setTodayState] = useState(null);
  const [checkIn, setCheckIn] = useState({
    prayer: false,
    workout: false,
    smoked: false,
    mood: 5,
    energy: 5,
  });
  const [editingMem, setEditingMem] = useState(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!apiKey) {
      setView("setup");
      return;
    }
    loadMessages();
    getTodayState().then(setTodayState);
  }, [apiKey]);

  useEffect(() => {
    if (view === "memory") loadMemories();
  }, [view]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const kw = detectKeyword(text);

    if (kw?.type === "show_memory") {
      setView("memory");
      return;
    }
    if (kw?.type === "checkin") {
      setView("checkin");
      return;
    }
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

  // ── Views ──────────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <SetupView
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
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
        onArchive={async (id) => {
          await archiveMemory(id);
          loadMemories();
        }}
        onUpdate={async (id, c) => {
          await updateMemory(id, c);
          setEditingMem(null);
          loadMemories();
        }}
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
        <div style={S.headerTitle}>
          <span style={S.dot} />
          Mentor
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {todayState && (
            <div style={S.statusPills}>
              {todayState.prayer_completed && <Pill label="prayed" color="#6bffb8" />}
              {todayState.workout_completed && <Pill label="workout" color="#6bffb8" />}
              {todayState.smoked_today && <Pill label="smoked" color="#ff6b6b" />}
            </div>
          )}
          <IconBtn onClick={() => setView("checkin")} title="Daily check-in">✓</IconBtn>
          <IconBtn onClick={() => setView("memory")} title="Memory">◈</IconBtn>
          <IconBtn onClick={() => setView("setup")} title="Settings">⚙</IconBtn>
        </div>
      </div>

      <div style={S.messages} ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div style={S.empty}>
            <div style={S.emptyTitle}>Mentor</div>
            <div style={S.emptyHint}>
              Ask anything. Or tap a shortcut below.
            </div>
            <div style={S.shortcuts}>
              {[
                "What should I do next?",
                "daily check-in",
                "Update my plan",
                "what do you remember about me?",
              ].map((s) => (
                <button
                  key={s}
                  style={S.shortcutBtn}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                >
                  {s}
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
          placeholder="Ask Mentor..."
          value={input}
          rows={1}
          disabled={loading}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.35 : 1 }}
          onClick={send}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          background: isUser ? "#1a3a2a" : "#181818",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          padding: "10px 14px",
          color: isUser ? "#c8ffe0" : "#d4d4d4",
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
      <div
        style={{
          background: "#181818",
          borderRadius: "16px 16px 16px 4px",
          padding: "12px 16px",
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
              background: "#555",
              animation: `mentorPulse 1.3s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        background: color + "18",
        borderRadius: 4,
        padding: "2px 5px",
      }}
    >
      {label}
    </span>
  );
}

function IconBtn({ onClick, title, children }) {
  return (
    <button style={S.iconBtn} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

// ─── Setup View ───────────────────────────────────────────────────────────────
function SetupView({ apiKeyInput, setApiKeyInput, onSave, hasKey, onBack }) {
  return (
    <div style={S.wrap}>
      {onBack && (
        <div style={S.header}>
          <button style={S.iconBtn} onClick={onBack}>
            ← Back
          </button>
          <div style={{ ...S.headerTitle, fontSize: 14 }}>Settings</div>
          <div style={{ width: 60 }} />
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 24px 40px",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e2e2" }}>
          {hasKey ? "Update API Key" : "Activate Mentor"}
        </div>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.55, margin: 0 }}>
          Mentor uses Gemini 2.0 Flash-Lite. Get a free key at{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#6bffb8" }}
          >
            aistudio.google.com
          </a>
        </p>
        <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
          Estimated cost: $0.02–$0.10/month for normal personal use.
          Stored in your browser only.
        </p>
        <input
          style={S.keyInput}
          type="password"
          placeholder="AIza..."
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          autoComplete="off"
        />
        <button
          style={{ ...S.saveKeyBtn, opacity: apiKeyInput.trim() ? 1 : 0.4 }}
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
function MemoryView({
  memories,
  onBack,
  editingMem,
  editContent,
  setEditingMem,
  setEditContent,
  onArchive,
  onUpdate,
}) {
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
        <button style={S.iconBtn} onClick={onBack}>
          ← Back
        </button>
        <div style={{ ...S.headerTitle, fontSize: 14 }}>Memory</div>
        <div style={{ width: 60 }} />
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {orderedCats.length === 0 && (
          <div
            style={{
              color: "#444",
              fontSize: 14,
              textAlign: "center",
              marginTop: 60,
            }}
          >
            No memories saved yet. Start chatting with Mentor.
          </div>
        )}
        {orderedCats.map((cat) => (
          <div key={cat}>
            <div
              style={{
                fontSize: 10,
                color: "#3a3a3a",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {CAT_LABELS[cat] || cat}
            </div>
            {grouped[cat].map((m) => (
              <div
                key={m.id}
                style={{
                  background: "#141414",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 4,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                {editingMem === m.id ? (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      gap: 6,
                      flexDirection: "column",
                    }}
                  >
                    <textarea
                      style={{ ...S.keyInput, fontSize: 13, resize: "none", minHeight: 56 }}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={{
                          ...S.saveKeyBtn,
                          fontSize: 12,
                          padding: "7px 12px",
                          flex: 1,
                        }}
                        onClick={() => onUpdate(m.id, editContent)}
                      >
                        Save
                      </button>
                      <button
                        style={S.cancelBtn}
                        onClick={() => setEditingMem(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#bbb",
                          lineHeight: 1.45,
                        }}
                      >
                        {m.content}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#2e2e2e",
                          marginTop: 4,
                          letterSpacing: "0.06em",
                        }}
                      >
                        importance {m.importance}
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 2, flexShrink: 0 }}
                    >
                      <button
                        style={S.memBtn}
                        onClick={() => {
                          setEditingMem(m.id);
                          setEditContent(m.content);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        style={{ ...S.memBtn, color: "#4a1a1a" }}
                        onClick={() => onArchive(m.id)}
                      >
                        ×
                      </button>
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
        <button style={S.iconBtn} onClick={onBack}>
          ← Back
        </button>
        <div style={{ ...S.headerTitle, fontSize: 14 }}>Daily Check-in</div>
        <div style={{ width: 60 }} />
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <YesNo label="Did you pray today?" value={checkIn.prayer} onChange={(v) => set("prayer", v)} />
        <YesNo label="Did you work out?" value={checkIn.workout} onChange={(v) => set("workout", v)} />
        <YesNo label="Did you smoke?" value={checkIn.smoked} onChange={(v) => set("smoked", v)} />

        <div>
          <div style={S.ciLabel}>Mood — {checkIn.mood}/10</div>
          <input
            type="range"
            min={1}
            max={10}
            value={checkIn.mood}
            onChange={(e) => set("mood", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#6bffb8" }}
          />
        </div>

        <div>
          <div style={S.ciLabel}>Energy — {checkIn.energy}/10</div>
          <input
            type="range"
            min={1}
            max={10}
            value={checkIn.energy}
            onChange={(e) => set("energy", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#6bffb8" }}
          />
        </div>

        <button style={{ ...S.saveKeyBtn, marginTop: 8 }} onClick={onSubmit}>
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
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{
            ...S.toggleBtn,
            background: value ? "#1a3a2a" : "#141414",
            borderColor: value ? "#2a5a2a" : "#222",
            color: value ? "#6bffb8" : "#444",
          }}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
        <button
          style={{
            ...S.toggleBtn,
            background: !value ? "#2a1a1a" : "#141414",
            borderColor: !value ? "#4a2a2a" : "#222",
            color: !value ? "#ff6b6b" : "#444",
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
    background: "#0f0f0f",
    overflow: "hidden",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
    paddingBottom: "12px",
    paddingLeft: "14px",
    paddingRight: "14px",
    borderBottom: "1px solid #181818",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e2e2e2",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#6bffb8",
    boxShadow: "0 0 8px #6bffb860",
    display: "inline-block",
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 14px 8px",
    display: "flex",
    flexDirection: "column",
  },
  inputBar: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    padding: "10px 12px",
    borderTop: "1px solid #181818",
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: "#181818",
    border: "1px solid #252525",
    borderRadius: 12,
    color: "#e2e2e2",
    fontSize: 15,
    padding: "10px 14px",
    outline: "none",
    resize: "none",
    lineHeight: 1.4,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    minHeight: 40,
    boxSizing: "border-box",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "#1a3a2a",
    border: "none",
    color: "#6bffb8",
    fontSize: 18,
    fontWeight: 700,
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
    gap: 10,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 30,
    fontWeight: 700,
    color: "#6bffb8",
    letterSpacing: "-0.02em",
  },
  emptyHint: {
    fontSize: 13,
    color: "#3a3a3a",
    textAlign: "center",
    maxWidth: 240,
  },
  shortcuts: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 10,
    width: "100%",
    maxWidth: 310,
  },
  shortcutBtn: {
    background: "#111",
    border: "1px solid #222",
    borderRadius: 10,
    color: "#444",
    fontSize: 13,
    padding: "10px 16px",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "#555",
    fontSize: 14,
    cursor: "pointer",
    padding: "4px 6px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  statusPills: {
    display: "flex",
    gap: 4,
    alignItems: "center",
  },
  keyInput: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    color: "#e2e2e2",
    fontSize: 14,
    padding: "11px 14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  saveKeyBtn: {
    background: "#1a3a2a",
    border: "none",
    borderRadius: 10,
    color: "#6bffb8",
    fontSize: 15,
    fontWeight: 600,
    padding: "13px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    transition: "opacity 0.15s",
  },
  cancelBtn: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    color: "#555",
    fontSize: 12,
    padding: "7px 12px",
    flex: 1,
    cursor: "pointer",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  memBtn: {
    background: "none",
    border: "none",
    color: "#333",
    fontSize: 16,
    cursor: "pointer",
    padding: "2px 5px",
    lineHeight: 1,
  },
  ciLabel: {
    fontSize: 11,
    color: "#555",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom: 8,
    fontWeight: 500,
  },
  toggleBtn: {
    flex: 1,
    border: "1px solid",
    borderRadius: 8,
    padding: "11px 0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    transition: "all 0.12s",
  },
};
