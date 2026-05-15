import { supabase } from "./supabase";

// ─── API Key ──────────────────────────────────────────────────────────────────
export const getGeminiKey = () => localStorage.getItem("mentor_gemini_key") || "";
export const setGeminiKey = (k) => localStorage.setItem("mentor_gemini_key", k.trim());

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Mentor, Austin's personal AI life mentor and accountability partner.

Your purpose is to help Austin live intentionally, stay spiritually grounded, avoid comfort loops, build discipline, create adventure, and move toward his long-term goals.

You are not a therapist. You are not a corporate productivity bot. You are a practical, direct, grounded mentor.

Tone: concise · direct · calm · masculine · practical · honest · not cringe · not fake motivational · not overly emotional

Your priorities:
1. Help Austin choose the next best action.
2. Keep him consistent with prayer.
3. Help him avoid smoking when he does not want to.
4. Help him work out and stay active.
5. Help him build his app.
6. Help him prepare financially and mentally for Florida.
7. Help him make each day feel unique.
8. Help him reduce procrastination.
9. Help him think clearly without overthinking.
10. Help him balance ambition with rest.

When Austin asks what to do, use this format:

READ:
Briefly explain what is happening.

NEXT MOVE:
Give the exact next action.

PLAN:
Give a realistic schedule or adjusted plan.

ACCOUNTABILITY:
Ask about prayer, workout, smoking, and the one task he is avoiding.

ADVENTURE:
Give one realistic novelty idea.

MEMORY:
Mention what should be remembered or updated.

When Austin gives roadblocks, adjust the plan. Do not guilt-trip him.
Be honest about Florida — neither blindly encouraging nor discouraging.`;

// ─── Gemini API ───────────────────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.0-flash";

async function callGemini(key, systemInstruction, contents, maxTokens = 900) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const body = {
    contents,
    generationConfig: { temperature: 0.75, maxOutputTokens: maxTokens },
  };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── Context Builder ──────────────────────────────────────────────────────────
export async function buildDailyContext() {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const timeLabel =
    now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";

  const [profileRes, goalsRes, tasksRes, stateRes, summaryRes] = await Promise.all([
    supabase
      .from("mentor_memory")
      .select("content")
      .in("category", ["profile", "schedule"])
      .eq("status", "active")
      .order("importance", { ascending: false })
      .limit(12),
    supabase
      .from("mentor_memory")
      .select("content")
      .eq("category", "current_goal")
      .eq("status", "active")
      .order("importance", { ascending: false })
      .limit(5),
    supabase
      .from("mentor_memory")
      .select("content, category")
      .in("category", ["task", "reminder", "struggle", "long_term_plan", "win"])
      .eq("status", "active")
      .order("importance", { ascending: false })
      .limit(8),
    supabase.from("daily_state").select("*").eq("date", today).maybeSingle(),
    supabase
      .from("mentor_summaries")
      .select("summary")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  let ctx = `TODAY: ${dayName}, ${today} (${timeLabel})\n`;

  if (profileRes.data?.length) {
    ctx += `\nPROFILE & SCHEDULE:\n${profileRes.data.map((m) => `• ${m.content}`).join("\n")}\n`;
  }
  if (goalsRes.data?.length) {
    ctx += `\nACTIVE GOALS:\n${goalsRes.data.map((g) => `• ${g.content}`).join("\n")}\n`;
  }
  if (tasksRes.data?.length) {
    ctx += `\nTASKS & REMINDERS:\n${tasksRes.data.map((t) => `• ${t.content}`).join("\n")}\n`;
  }

  const ds = stateRes.data;
  if (ds) {
    ctx += `\nTODAY'S STATE: Prayer: ${ds.prayer_completed ? "done" : "not yet"} | Workout: ${
      ds.workout_completed ? "done" : "not yet"
    } | Smoked: ${ds.smoked_today ? "yes" : "no"}`;
    if (ds.mood) ctx += ` | Mood: ${ds.mood}/10`;
    if (ds.energy) ctx += ` | Energy: ${ds.energy}/10`;
    if (ds.notes) ctx += `\nNotes: ${ds.notes}`;
    ctx += "\n";
  }

  if (summaryRes.data?.[0]) {
    ctx += `\nLAST SUMMARY:\n${summaryRes.data[0].summary}\n`;
  }

  return ctx;
}

// ─── Send Message ─────────────────────────────────────────────────────────────
export async function sendToMentor(userText) {
  const key = getGeminiKey();
  if (!key) throw new Error("NO_KEY");

  // Fetch context and recent history before saving the new message
  const [context, recentRes] = await Promise.all([
    buildDailyContext(),
    supabase
      .from("mentor_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  let recent = (recentRes.data || []).reverse();
  // Trim leading assistant turns so Gemini sees user → model alternation
  while (recent.length && recent[0].role !== "user") recent.shift();

  const contents = [
    { role: "user", parts: [{ text: `[CONTEXT]\n${context}` }] },
    { role: "model", parts: [{ text: "Context received." }] },
    ...recent.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const response = await callGemini(key, SYSTEM_PROMPT, contents, 900);

  // Persist both turns
  const ts = new Date().toISOString();
  await Promise.all([
    supabase.from("mentor_messages").insert({ role: "user", content: userText, created_at: ts }),
    supabase.from("mentor_messages").insert({
      role: "assistant",
      content: response,
      created_at: new Date().toISOString(),
    }),
  ]);

  // Background: extract memory + maybe summarize
  extractMemory(userText, response, key).catch(() => {});
  maybeSummarize(key).catch(() => {});

  return response;
}

// ─── Memory Extraction ────────────────────────────────────────────────────────
async function extractMemory(userMsg, assistantMsg, key) {
  const prompt = `Extract 0-3 important long-term facts worth remembering about Austin from this exchange.
Return ONLY a valid JSON array, no markdown, no explanation.
Schema: [{"category":"profile|current_goal|habit_pattern|reminder|task|preference|struggle|win|schedule|long_term_plan","content":"concise fact under 120 chars","importance":1-5}]
Return [] if nothing notable.

User: ${userMsg.slice(0, 400)}
Assistant: ${assistantMsg.slice(0, 400)}`;

  let raw;
  try {
    raw = await callGemini(key, null, [{ role: "user", parts: [{ text: prompt }] }], 300);
  } catch {
    return;
  }

  let memories;
  try {
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    memories = JSON.parse(cleaned);
  } catch {
    return;
  }

  if (!Array.isArray(memories) || !memories.length) return;

  const ts = new Date().toISOString();
  for (const mem of memories) {
    if (!mem.category || !mem.content) continue;
    await supabase.from("mentor_memory").insert({
      category: mem.category,
      content: String(mem.content).slice(0, 200),
      importance: Math.min(5, Math.max(1, Number(mem.importance) || 3)),
      status: "active",
      created_at: ts,
      updated_at: ts,
      last_used_at: ts,
    });
  }
}

// ─── Auto-summarize old messages ──────────────────────────────────────────────
async function maybeSummarize(key) {
  const { count } = await supabase
    .from("mentor_messages")
    .select("*", { count: "exact", head: true });
  if (!count || count < 30) return;

  const { data: last } = await supabase
    .from("mentor_summaries")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hoursSinceLast = last
    ? (Date.now() - new Date(last.created_at)) / 3600000
    : Infinity;
  if (hoursSinceLast < 2) return;

  const { data: old } = await supabase
    .from("mentor_messages")
    .select("role, content")
    .order("created_at", { ascending: true })
    .limit(20);
  if (!old?.length) return;

  const transcript = old
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join("\n");
  const prompt = `Summarize in 3-5 bullet points the key facts, decisions, and patterns from this Austin-Mentor exchange:\n\n${transcript}`;

  let summary;
  try {
    summary = await callGemini(key, null, [{ role: "user", parts: [{ text: prompt }] }], 250);
  } catch {
    return;
  }
  if (!summary) return;

  await supabase.from("mentor_summaries").insert({
    summary,
    created_at: new Date().toISOString(),
  });
}

// ─── Keyword Commands ─────────────────────────────────────────────────────────
export function detectKeyword(text) {
  const lower = text.trim().toLowerCase();
  if (lower.startsWith("remember this:"))
    return { type: "remember", value: text.trim().slice(14).trim() };
  if (lower.startsWith("forget this:"))
    return { type: "forget", value: text.trim().slice(12).trim() };
  if (lower.includes("what do you remember about me"))
    return { type: "show_memory" };
  if (lower === "daily check-in") return { type: "checkin" };
  return null;
}

export async function handleRememberThis(text) {
  const ts = new Date().toISOString();
  await supabase.from("mentor_memory").insert({
    category: "preference",
    content: text.slice(0, 200),
    importance: 4,
    status: "active",
    created_at: ts,
    updated_at: ts,
    last_used_at: ts,
  });
  return `Saved to memory: "${text}"`;
}

export async function handleForgetThis(text) {
  const { data } = await supabase
    .from("mentor_memory")
    .select("id, content")
    .ilike("content", `%${text}%`)
    .eq("status", "active")
    .limit(5);
  if (!data?.length) return "No matching memory found.";
  await supabase
    .from("mentor_memory")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .in("id", data.map((m) => m.id));
  return `Archived ${data.length} memory item(s) matching "${text}".`;
}

// ─── Memory CRUD ──────────────────────────────────────────────────────────────
export async function getMemories() {
  const { data } = await supabase
    .from("mentor_memory")
    .select("*")
    .eq("status", "active")
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false });
  return data || [];
}

export async function archiveMemory(id) {
  await supabase
    .from("mentor_memory")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function updateMemory(id, content) {
  await supabase
    .from("mentor_memory")
    .update({ content: content.slice(0, 200), updated_at: new Date().toISOString() })
    .eq("id", id);
}

// ─── Daily State ──────────────────────────────────────────────────────────────
export async function getTodayState() {
  const today = new Date().toLocaleDateString("en-CA");
  const { data } = await supabase
    .from("daily_state")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  return data;
}

export async function saveDailyState(state) {
  const today = new Date().toLocaleDateString("en-CA");
  const ts = new Date().toISOString();
  const existing = await getTodayState();
  if (existing) {
    await supabase
      .from("daily_state")
      .update({ ...state, updated_at: ts })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("daily_state")
      .insert({ ...state, date: today, created_at: ts, updated_at: ts });
  }
}
