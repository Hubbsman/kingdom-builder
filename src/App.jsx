import React, { useEffect, useMemo, useRef, useState } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');`;

const safeLoad = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const niceDate = (date = new Date()) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const monthKey = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

const getTheme = (isDark) => isDark ? {
  bg: "#040709", surface: "rgba(255,255,255,0.052)", surface2: "rgba(255,255,255,0.082)", border: "rgba(255,255,255,0.082)", borderSoft: "rgba(255,255,255,0.038)", text: "#f5f0eb", muted: "rgba(245,240,235,0.52)", dim: "rgba(245,240,235,0.28)", accent: "#f97316", accentSoft: "rgba(249,115,22,0.13)", shadow: "0 2px 4px rgba(0,0,0,.55),0 16px 44px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.058)"
} : {
  bg: "#ede9e2", surface: "rgba(255,255,255,0.78)", surface2: "rgba(255,255,255,0.97)", border: "rgba(15,10,5,0.08)", borderSoft: "rgba(15,10,5,0.045)", text: "#1a1008", muted: "rgba(26,16,8,0.52)", dim: "rgba(26,16,8,0.28)", accent: "#ea580c", accentSoft: "rgba(234,88,12,0.1)", shadow: "0 1px 3px rgba(15,10,5,.07),0 12px 32px rgba(15,10,5,.09),inset 0 1px 0 rgba(255,255,255,.92)"
};

const Card = ({ T, children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: T.shadow, ...style }}>{children}</div>
);

const Ring = ({ pct, size = 56, color = "#f97316", children }) => {
  const stroke = 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(128,128,128,.14)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamp(pct) / 100)} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
};

const HeaderArt = ({ T, title, kicker }) => (
  <div style={{ height: 176, position: "relative", overflow: "hidden", background: `radial-gradient(ellipse at 78% 18%, rgba(249,115,22,.58) 0%, transparent 42%), radial-gradient(ellipse at 22% 90%, rgba(59,130,246,.09) 0%, transparent 50%), linear-gradient(180deg, #071025 0%, #0a1428 45%, ${T.bg} 100%)` }}>
    {[...Array(48)].map((_, i) => {
      const size = i % 5 === 0 ? 3 : i % 3 === 0 ? 1 : 2;
      const op = i % 5 === 0 ? .55 : i % 3 === 0 ? .22 : .36;
      return <div key={i} style={{ position: "absolute", left: `${(i * 37 + 11) % 100}%`, top: `${(i * 23 + 7) % 72}%`, width: size, height: size, borderRadius: 99, background: `rgba(255,255,255,${op})` }} />;
    })}
    <div style={{ position: "absolute", right: 22, top: 28, width: 90, height: 90, borderRadius: 99, background: "rgba(249,115,22,.06)", filter: "blur(18px)" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 22px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <div style={{ width: 20, height: 1, background: `rgba(249,115,22,.5)`, borderRadius: 99 }} />
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".18em", color: "rgba(249,115,22,.7)" }}>{kicker}</div>
      </div>
      <div className="serif" style={{ fontSize: 34, color: T.text, lineHeight: 1.08, letterSpacing: "-.01em" }}>{title}</div>
    </div>
  </div>
);

const PILLAR_PRESETS = ["Faith", "Work", "Body", "Mind", "Money", "Debt", "Family", "Service", "Health", "Discipline", "Learning", "Relationships", "Business", "Purpose", "Custom"];
const RITUAL_PRESETS = [
  { name: "Morning prayer", tag: "Faith", time: "6:00 AM" },
  { name: "Gratitude note", tag: "Faith", time: "7:00 AM" },
  { name: "Follow up with leads", tag: "Work", time: "9:00 AM" },
  { name: "Train / lift", tag: "Body", time: "6:00 PM" },
  { name: "Read 10 pages", tag: "Mind", time: "9:30 PM" },
  { name: "Review money", tag: "Money", time: "8:30 PM" },
];
const JOURNAL_PROMPTS = [
  "What took the most mental energy today?",
  "What did you avoid, and why?",
  "What moved your life forward today?",
  "Where did you act with discipline today?",
  "What decision today deserves a second look?",
  "What do you need to surrender to God instead of forcing?",
  "What would tomorrow-you thank you for doing?",
];

const parseAmount = (text) => {
  const m = text.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
};

const cleanLabel = (text) => text
  .replace(/\$?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?/g, " ")
  .replace(/\b(i|just|today|yesterday|from|for|on|to|my|me|a|an|the|and|then)\b/gi, " ")
  .replace(/\b(made|make|earned|earn|got paid|got payed|paid me|received|receive|sold|income|profit|deposit|spent|spend|bought|buy|paid|pay|lost|loss|gambling|expense|charge|charged)\b/gi, " ")
  .replace(/\s+/g, " ").trim().replace(/^./, c => c.toUpperCase());

const parseFinanceText = (text) => {
  const amount = parseAmount(text);
  if (!amount) return null;
  const lower = text.toLowerCase();
  const income = /\b(made|earned|got paid|got payed|paid me|received|sold|income|profit|deposit)\b/.test(lower);
  const negative = /\b(lost|loss|spent|bought|paid|bill|gas|food|rent|expense|charge|charged|gambling)\b/.test(lower) && !income;
  const label = cleanLabel(text) || (negative ? "Expense" : "Income");
  const category = /gambl/.test(lower) ? "Loss" : /gas|food|rent|bill|internet/.test(lower) ? "Bills" : income ? "Income" : "Expense";
  return { id: Date.now(), type: negative ? "out" : "in", amount, label, category, date: "Today", created: new Date().toISOString() };
};

const summarizeJournal = (answers) => {
  const text = answers.filter(Boolean).join(" ").trim();
  if (!text) return "No reflection written.";
  const first = text.split(/[.!?]/).filter(Boolean)[0] || text;
  return `${first.trim()}. Main theme: stay honest, stay specific, and turn the reflection into one clear next action.`;
};

const getWeekKey = () => {
  const d = new Date(), day = d.getDay(), m = new Date(d);
  m.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return m.toISOString().slice(0, 10);
};
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const generateDailyBrief = ({ tasks, txns, weekProfit, lawnJobs = [] }) => {
  const today = todayISO(), parts = [];
  const todayLawnJobs = lawnJobs.filter(j => j.date === today && j.status !== "skipped");
  if (todayLawnJobs.length) { const rev = todayLawnJobs.reduce((s,j) => s + Number(j.price||0), 0); parts.push(`${todayLawnJobs.length} cut${todayLawnJobs.length > 1 ? "s" : ""} · ${money(rev)} expected`); }
  const unpaidLawn = lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed").reduce((s,j) => s + Number(j.price||0), 0);
  if (unpaidLawn > 0) parts.push(`${money(unpaidLawn)} unpaid`);
  const todayDue = tasks.filter(t => !t.done && (t.due === today || t.due === "today"));
  if (todayDue.length) parts.push(`${todayDue.length} task${todayDue.length > 1 ? "s" : ""} due today`);
  const overdue = tasks.filter(t => !t.done && t.due && t.due !== "none" && t.due !== "today" && t.due < today);
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  const todayIncome = txns.filter(t => t.type === "in" && (t.date === "Today" || (t.created && t.created.slice(0,10) === today))).reduce((s,t) => s + Number(t.amount||0), 0);
  if (todayIncome > 0) parts.push(`${money(todayIncome)} earned today`);
  if (weekProfit < 0) parts.push(`week at ${money(weekProfit)}`);
  if (!parts.length) return weekProfit >= 500 ? "Strong week in progress. Stay consistent." : "Clear board. Set your intention and execute.";
  return parts.join(" · ");
};

const generateSmartReminders = ({ tasks, txns, weekProfit, totalDebt, lawnJobs = [], lawnLeads = [], lawnClients = [] }) => {
  const today = todayISO(), tomorrow = _d(1), items = [];
  tasks.filter(t => !t.done && t.due && t.due !== "none" && t.due !== "today" && t.due < today)
    .forEach(t => items.push({ id: `task-od-${t.id}`, title: "Task Overdue", message: `"${t.title}" was due ${t.due}`, priority: "high", category: "tasks" }));
  tasks.filter(t => !t.done && (t.due === today || t.due === "today"))
    .forEach(t => items.push({ id: `task-today-${t.id}`, title: "Due Today", message: `"${t.title}"`, priority: "medium", category: "tasks" }));
  if (weekProfit < 0) items.push({ id: "profit-neg", title: "Profit Negative", message: `Week at ${money(weekProfit)}. Create income or cut spending.`, priority: "high", category: "money" });
  if (totalDebt > 8000) items.push({ id: "debt-high", title: "High Debt Balance", message: `${money(totalDebt)} outstanding. Schedule a payment this week.`, priority: "medium", category: "money" });
  lawnJobs.filter(j => j.date === today && j.status === "scheduled")
    .forEach(j => items.push({ id: `lawn-today-${j.id}`, title: "Cut Scheduled Today", message: `${j.clientName} — ${money(j.price)}`, priority: "medium", category: "lawn" }));
  lawnJobs.filter(j => j.date === tomorrow && j.status === "scheduled")
    .forEach(j => items.push({ id: `lawn-tmr-${j.id}`, title: "Cut Tomorrow", message: `${j.clientName} — ${money(j.price)}`, priority: "low", category: "lawn" }));
  lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed")
    .forEach(j => items.push({ id: `lawn-unpaid-${j.id}`, title: "Unpaid Invoice", message: `${j.clientName} owes ${money(j.price)} — service ${j.date}`, priority: "high", category: "lawn" }));
  lawnLeads.filter(l => l.followUpDate && l.followUpDate <= today && l.status !== "won" && l.status !== "lost")
    .forEach(l => items.push({ id: `lead-fu-${l.id}`, title: "Lead Follow-Up Due", message: `${l.name} — follow up now or mark lost`, priority: "high", category: "leads" }));
  lawnLeads.filter(l => l.status === "quote_sent" && l.quoteSentDate && (new Date() - new Date(`${l.quoteSentDate}T12:00:00`)) / 86400000 >= 5)
    .forEach(l => { const days = Math.floor((new Date() - new Date(`${l.quoteSentDate}T12:00:00`)) / 86400000); items.push({ id: `lead-cold-${l.id}`, title: "Quote Going Cold", message: `${l.name} — quote is ${days}d old`, priority: "high", category: "leads" }); });
  const now2 = new Date();
  lawnClients.filter(c => c.status === "active").forEach(c => {
    const last = c.lastContacted || c.lastCutDate;
    if (!last) return;
    const days = Math.floor((now2 - new Date(`${last}T12:00:00`)) / 86400000);
    if (days >= 30 && c.amountOwed > 0) items.push({ id: `client-contact-${c.id}`, title: "Collect + Check In", message: `${c.name} owes ${money(c.amountOwed)} and hasn't been contacted in ${days} days`, priority: "high", category: "lawn" });
    else if (days >= 30) items.push({ id: `client-contact-${c.id}`, title: "No Recent Contact", message: `${c.name} — ${days} days without contact`, priority: "low", category: "lawn" });
  });
  lawnLeads.filter(l => l.status !== "won" && l.status !== "lost" && l.lastContactedDate).forEach(l => {
    const days = Math.floor((now2 - new Date(`${l.lastContactedDate}T12:00:00`)) / 86400000);
    if (days >= 3 && l.status !== "new") items.push({ id: `lead-nocontact-${l.id}`, title: "Lead Going Cold", message: `${l.name} — ${days}d without contact`, priority: days >= 5 ? "high" : "medium", category: "leads" });
  });
  detectMissedCuts(lawnClients, lawnJobs).forEach(alert => {
    if (alert.type === "overdue") items.push({ id: `missed-cut-${alert.clientId}`, title: "Overdue Cut", message: `${alert.clientName} is ${alert.daysSinceLast} days past expected ${alert.frequency} service.`, priority: "high", category: "lawn" });
    else if (alert.type === "no_record") items.push({ id: `no-record-${alert.clientId}`, title: "No Service Record", message: `${alert.clientName} has no recorded service and no next cut scheduled.`, priority: "medium", category: "lawn" });
    else if (alert.type === "overdue_scheduled") items.push({ id: `overdue-sched-${alert.clientId}`, title: "Scheduled Cut Overdue", message: `${alert.clientName} — scheduled job from ${alert.scheduledDate} not yet completed.`, priority: "high", category: "lawn" });
  });
  lawnClients.filter(c => c.status === "active" && calcChurnRisk(c, lawnJobs) === "high").forEach(c => {
    if (!items.find(i => i.id === `missed-cut-${c.id}` || i.id === `overdue-sched-${c.id}`))
      items.push({ id: `churn-high-${c.id}`, title: "High Churn Risk", message: `${c.name} — overdue service or no upcoming job. Risk of losing this client.`, priority: "high", category: "lawn" });
  });
  return items;
};

const generateMentorNudges = ({ weekProfit, tasks, totalDebt, lawnJobs = [], lawnLeads = [], lawnClients = [] }) => {
  const today = todayISO(), day = new Date().getDay(), nudges = [];
  if (weekProfit < 0 && day >= 3) nudges.push({ id: "nudge-profit-mid", message: `Your week profit is ${money(weekProfit)} and it's ${DAYS[day]}. What income action are you taking today?` });
  const od = tasks.filter(t => !t.done && t.due && t.due !== "none" && t.due !== "today" && t.due < today);
  if (od.length >= 2) nudges.push({ id: "nudge-overdue", message: `${od.length} overdue tasks stacking up. Handle one right now before adding new ones.` });
  const todayCount = tasks.filter(t => !t.done && (t.due === today || t.due === "today")).length;
  if (todayCount >= 4) nudges.push({ id: "nudge-overloaded", message: `${todayCount} tasks today. Stop planning. Execute the top 2 first.` });
  const unpaidLawn = lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed").reduce((s,j) => s + Number(j.price||0), 0);
  if (unpaidLawn > 300) nudges.push({ id: "nudge-collect-unpaid", message: `You have ${money(unpaidLawn)} in unpaid lawn work sitting. Collect before chasing new revenue.` });
  const coldLeads = lawnLeads.filter(l => l.status === "quote_sent" && l.quoteSentDate && (new Date() - new Date(`${l.quoteSentDate}T12:00:00`)) / 86400000 >= 5);
  if (coldLeads.length) nudges.push({ id: "nudge-cold-quotes", message: `${coldLeads.length} quote${coldLeads.length > 1 ? "s are" : " is"} going cold. Follow up today or mark ${coldLeads.length > 1 ? "them" : "it"} lost.` });
  const highRisk = lawnClients.filter(c => c.status === "active" && calcChurnRisk(c, lawnJobs) === "high");
  if (highRisk.length >= 2) nudges.push({ id: "nudge-churn-multi", message: `${highRisk.length} clients are high churn risk. Review retention in the Lawn Report before you lose the revenue.` });
  else if (highRisk.length === 1) nudges.push({ id: `nudge-churn-${highRisk[0].id}`, message: `${highRisk[0].name} is high churn risk — no recent cut or no next job scheduled. Take action today.` });
  return nudges;
};

const generateWeeklySummary = ({ income, outflow, weekProfit, tasks, totalDebt }) => {
  const completed = tasks.filter(t => t.done).length, total = tasks.length;
  let focus = "Build one clear income action for the week.";
  if (weekProfit < 0) focus = "Profit is negative. Prioritize income and cut unnecessary spending.";
  else if (weekProfit > 800) focus = "Solid week. Assign surplus to your highest-interest debt.";
  else if (completed === 0 && total > 0) focus = "Tasks exist but nothing completed. Execution is the gap.";
  else if (totalDebt > 5000) focus = "Debt is still high. Make one extra payment this week.";
  return { income, outflow, weekProfit, completedTasks: completed, totalTasks: total, totalDebt, focus };
};

const lawnReport = (jobs, clients, leads) => {
  const today = todayISO(), now = new Date();
  const weekStart = _d(-(now.getDay() === 0 ? 6 : now.getDay() - 1));
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevWeekStart = _d(-(now.getDay() === 0 ? 13 : now.getDay() + 6));
  const prevWeekEnd = _d(-(now.getDay() === 0 ? 7 : now.getDay()));
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const completed = jobs.filter(j => j.status === "completed");
  const paid = jobs.filter(j => j.paymentStatus === "paid" && j.status === "completed");
  const weekRevenue = completed.filter(j => j.date >= weekStart && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const monthRevenue = completed.filter(j => j.date >= monthStart && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const prevWeekRevenue = completed.filter(j => j.date >= prevWeekStart && j.date <= prevWeekEnd).reduce((s, j) => s + Number(j.price || 0), 0);
  const prevMonthRevenue = completed.filter(j => j.date >= prevMonthStart && j.date <= prevMonthEnd).reduce((s, j) => s + Number(j.price || 0), 0);
  const completedCount = completed.length, skippedCount = jobs.filter(j => j.status === "skipped").length;
  const scheduledCount = jobs.filter(j => j.status === "scheduled").length;
  const unpaidJobs = jobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed");
  const unpaidTotal = unpaidJobs.reduce((s, j) => s + Number(j.price || 0), 0);
  const doneOrSkipped = completedCount + skippedCount;
  const completionRate = doneOrSkipped ? clamp((completedCount / doneOrSkipped) * 100) : 0;
  const paidRate = completedCount ? clamp((paid.length / completedCount) * 100) : 0;
  const revMap = {};
  completed.forEach(j => { revMap[j.clientId] = (revMap[j.clientId] || 0) + Number(j.price || 0); });
  const topClients = Object.entries(revMap).map(([id, rev]) => ({ client: clients.find(c => c.id === Number(id)), rev })).filter(x => x.client).sort((a, b) => b.rev - a.rev).slice(0, 3);
  const projectedMonthly = clients.filter(c => c.status === "active").reduce((s, c) => s + Number(c.price || 0) * (c.frequency === "weekly" ? 4 : c.frequency === "biweekly" ? 2 : 1), 0);
  const wonLeads = leads.filter(l => l.status === "won"), closedLeads = leads.filter(l => l.status === "won" || l.status === "lost");
  const closeRate = closedLeads.length ? clamp((wonLeads.length / closedLeads.length) * 100) : null;
  const srcMap = {};
  leads.forEach(l => { const s = l.source || "Unknown"; if (!srcMap[s]) srcMap[s] = { won: 0, total: 0 }; if (l.status === "won" || l.status === "lost") { srcMap[s].total++; if (l.status === "won") srcMap[s].won++; } });
  const closeRateBySource = Object.entries(srcMap).filter(([, v]) => v.total > 0).map(([src, v]) => ({ src, rate: Math.round((v.won / v.total) * 100), won: v.won, total: v.total }));
  const insights = [];
  if (unpaidTotal > 200) insights.push(`Collect ${money(unpaidTotal)} in unpaid work before chasing new jobs.`);
  if (prevWeekRevenue > 0 && weekRevenue > prevWeekRevenue * 1.2) insights.push(`Revenue up ${Math.round(((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100)}% vs last week. Keep the pace.`);
  if (prevWeekRevenue > 0 && weekRevenue < prevWeekRevenue * 0.8) insights.push(`Revenue down vs last week. Check for skipped jobs or lost clients.`);
  const coldLeads = leads.filter(l => l.status === "quote_sent" && l.quoteSentDate && (new Date() - new Date(`${l.quoteSentDate}T12:00:00`)) / 86400000 >= 5);
  if (coldLeads.length) insights.push(`${coldLeads.length} quote${coldLeads.length > 1 ? "s" : ""} going cold. Follow up or lose the deal.`);
  if (projectedMonthly > 0 && now.getDate() > 15 && monthRevenue / projectedMonthly < 0.5) insights.push(`Behind monthly pace. ${money(projectedMonthly - monthRevenue)} more to hit ${money(projectedMonthly)} projected.`);
  return { weekRevenue, monthRevenue, prevWeekRevenue, prevMonthRevenue, completedCount, skippedCount, scheduledCount, unpaidJobs, unpaidTotal, completionRate, paidRate, topClients, projectedMonthly, closeRate, closeRateBySource, insights, wonLeads: wonLeads.length, closedLeads: closedLeads.length };
};

const lawnForecast = (jobs, clients) => {
  const today = todayISO(), now = new Date();
  const weekStart = _d(-(now.getDay() === 0 ? 6 : now.getDay() - 1));
  const monthStart = `${today.slice(0, 7)}-01`;
  const next30End = _d(30);
  const activeClients = clients.filter(c => c.status === "active");
  const completed = jobs.filter(j => j.status === "completed");
  const weekRevenue = completed.filter(j => j.date >= weekStart && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const monthRevenue = completed.filter(j => j.date >= monthStart && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const weekCollected = completed.filter(j => j.paymentStatus === "paid" && j.date >= weekStart && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const monthCollected = completed.filter(j => j.paymentStatus === "paid" && j.date >= monthStart && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const unpaidJobs = completed.filter(j => j.paymentStatus === "unpaid");
  const unpaidTotal = unpaidJobs.reduce((s, j) => s + Number(j.price || 0), 0);
  const scheduledTotal = jobs.filter(j => j.status === "scheduled" && j.date >= today).reduce((s, j) => s + Number(j.price || 0), 0);
  const next30Scheduled = jobs.filter(j => j.status === "scheduled" && j.date >= today && j.date <= next30End).reduce((s, j) => s + Number(j.price || 0), 0);
  const projWeekly = activeClients.reduce((s, c) => s + Number(c.price || 0) * (c.frequency === "weekly" ? 1 : c.frequency === "biweekly" ? 0.5 : 0), 0);
  const projMonthly = activeClients.reduce((s, c) => s + Number(c.price || 0) * (c.frequency === "weekly" ? 4 : c.frequency === "biweekly" ? 2 : 0), 0);
  return { projWeekly, projMonthly, next30Scheduled, weekCollected, monthCollected, weekRevenue, monthRevenue, unpaidTotal, unpaidJobs, scheduledTotal };
};

const clientLTV = (client, jobs) => {
  const cJobs = jobs.filter(j => j.clientId === client.id);
  const completed = cJobs.filter(j => j.status === "completed");
  const totalRevenue = completed.reduce((s, j) => s + Number(j.price || 0), 0);
  const collectedRevenue = completed.filter(j => j.paymentStatus === "paid").reduce((s, j) => s + Number(j.price || 0), 0);
  const avgJobValue = completed.length ? totalRevenue / completed.length : Number(client.price || 0);
  const projMonthly = client.frequency === "weekly" ? Number(client.price || 0) * 4 : client.frequency === "biweekly" ? Number(client.price || 0) * 2 : 0;
  const sorted = completed.filter(j => j.date).sort((a, b) => a.date.localeCompare(b.date));
  const firstServiceDate = sorted[0]?.date || null;
  const lastServiceDate = sorted[sorted.length - 1]?.date || client.lastCutDate || null;
  const daysSinceLast = lastServiceDate ? Math.floor((new Date() - new Date(`${lastServiceDate}T12:00:00`)) / 86400000) : null;
  return { totalRevenue, collectedRevenue, unpaidBalance: Number(client.amountOwed || 0), jobCount: completed.length, avgJobValue, projMonthly, firstServiceDate, lastServiceDate, daysSinceLast };
};

const detectMissedCuts = (clients, jobs) => {
  const today = todayISO();
  return clients.filter(c => c.status === "active" && c.frequency !== "one-time").reduce((alerts, c) => {
    const threshold = c.frequency === "weekly" ? 10 : 18;
    const cJobs = jobs.filter(j => j.clientId === c.id);
    const lastDone = cJobs.filter(j => j.status === "completed" && j.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    const nextSched = cJobs.filter(j => j.status === "scheduled" && j.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    const lastDate = lastDone?.date || c.lastCutDate;
    const daysSinceLast = lastDate ? Math.floor((new Date() - new Date(`${lastDate}T12:00:00`)) / 86400000) : null;
    if (!nextSched && daysSinceLast !== null && daysSinceLast > threshold) {
      alerts.push({ clientId: c.id, clientName: c.name, type: "overdue", daysSinceLast, frequency: c.frequency, price: Number(c.price || 0) });
    } else if (!nextSched && daysSinceLast === null) {
      alerts.push({ clientId: c.id, clientName: c.name, type: "no_record", daysSinceLast: null, frequency: c.frequency, price: Number(c.price || 0) });
    } else if (nextSched && nextSched.date < today) {
      alerts.push({ clientId: c.id, clientName: c.name, type: "overdue_scheduled", daysSinceLast, frequency: c.frequency, price: Number(c.price || 0), scheduledDate: nextSched.date });
    }
    return alerts;
  }, []);
};

const calcChurnRisk = (client, jobs, clientComms = []) => {
  if (client.status !== "active") return "n/a";
  const today = todayISO();
  let score = 0;
  const cJobs = jobs.filter(j => j.clientId === client.id);
  const lastDone = cJobs.filter(j => j.status === "completed" && j.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const nextSched = cJobs.filter(j => j.status === "scheduled" && j.date >= today)[0];
  const lastDate = lastDone?.date || client.lastCutDate;
  const daysSinceLast = lastDate ? Math.floor((new Date() - new Date(`${lastDate}T12:00:00`)) / 86400000) : 999;
  const threshold = client.frequency === "weekly" ? 10 : 18;
  if (daysSinceLast > threshold) score += 2;
  if (daysSinceLast > threshold * 2) score += 1;
  if (!nextSched && client.frequency !== "one-time") score += 2;
  if (Number(client.amountOwed || 0) > 0) score += 1;
  const lastContact = client.lastContacted || lastDate;
  const daysSinceContact = lastContact ? Math.floor((new Date() - new Date(`${lastContact}T12:00:00`)) / 86400000) : 999;
  if (daysSinceContact > 30) score += 1;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
};

const retentionSummary = (clients, jobs, clientComms = []) => {
  const active = clients.filter(c => c.status === "active");
  const risks = active.map(c => ({ client: c, risk: calcChurnRisk(c, jobs, clientComms), ltv: clientLTV(c, jobs) }));
  const high = risks.filter(r => r.risk === "high");
  const medium = risks.filter(r => r.risk === "medium");
  const low = risks.filter(r => r.risk === "low");
  const missed = detectMissedCuts(clients, jobs);
  const atRiskRevenue = [...high, ...medium].reduce((s, r) => s + (r.client.frequency === "weekly" ? Number(r.client.price || 0) * 4 : r.client.frequency === "biweekly" ? Number(r.client.price || 0) * 2 : 0), 0);
  return { activeCount: active.length, low: low.length, medium: medium.length, high: high.length, missed: missed.length, atRiskRevenue, risks, missedCuts: missed };
};

const generateBizPrompts = ({ lawnJobs = [], lawnClients = [], lawnLeads = [] }) => {
  const today = todayISO();
  const prompts = ["What client interaction taught you something today?"];
  const unpaid = lawnClients.filter(c => c.amountOwed > 0);
  if (unpaid.length) prompts.push(`You have ${unpaid.length} unpaid client${unpaid.length > 1 ? "s" : ""}. What's holding you back from collecting?`);
  const lostLeads = lawnLeads.filter(l => l.status === "lost");
  if (lostLeads.length) prompts.push("What part of your sales process caused you to lose a lead? What would you change next time?");
  const wonLeads = lawnLeads.filter(l => l.status === "won");
  if (wonLeads.length) prompts.push("What did you do right when closing your last win? How do you repeat that system?");
  const skipped = lawnJobs.filter(j => j.date === today && j.status === "skipped");
  if (skipped.length) prompts.push(`You skipped ${skipped.length} job${skipped.length > 1 ? "s" : ""} today. What was the real reason — weather, motivation, or time?`);
  prompts.push("What one system change would save you the most time or money next week?");
  prompts.push("What mistake this week should never repeat?");
  prompts.push("What would make tomorrow's route smoother?");
  return prompts.slice(0, 5);
};

const generatePaymentRequest = (client, job, profile) => {
  const name = client?.name || "Client";
  const amount = money(job?.price || client?.amountOwed || 0);
  const owner = profile?.ownerName || "Your lawn pro";
  const biz = profile?.businessName || "Lawn Service";
  const methods = [];
  if (profile?.cashApp) methods.push(`Cash App: ${profile.cashApp}`);
  if (profile?.venmo) methods.push(`Venmo: ${profile.venmo}`);
  const methodStr = methods.length ? methods.join(" or ") : "Cash App or Venmo";
  const dateStr = job?.date ? ` for service on ${job.date}` : "";
  return `Hey ${name}, this is ${owner} with ${biz}. Your balance${dateStr} is ${amount}. You can send payment through ${methodStr}. Thank you!`;
};

const checkNotifPermission = () => (typeof window !== "undefined" && "Notification" in window) ? Notification.permission : "unsupported";
const sendLocalNotification = (title, body) => { if (checkNotifPermission() === "granted") new Notification(title, { body }); };

const calcNextCutDate = (fromDate, frequency) => {
  if (!fromDate || frequency === "one-time") return null;
  const d = new Date(`${fromDate}T12:00:00`);
  d.setDate(d.getDate() + (frequency === "weekly" ? 7 : 14));
  return d.toISOString().slice(0, 10);
};
const _d = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

const DEFAULT_LAWN_CLIENTS = [
  { id: 1, name: "Mike Johnson", phone: "555-0101", address: "123 Oak St", price: 60, frequency: "biweekly", status: "active", lastCutDate: _d(-14), nextCutDate: _d(0), notes: "", paymentStatus: "paid", amountOwed: 0 },
  { id: 2, name: "Sarah Chen", phone: "555-0102", address: "456 Elm Ave", price: 75, frequency: "weekly", status: "active", lastCutDate: _d(-7), nextCutDate: _d(0), notes: "", paymentStatus: "unpaid", amountOwed: 75 },
  { id: 3, name: "David Brown", phone: "555-0103", address: "789 Pine Rd", price: 50, frequency: "biweekly", status: "active", lastCutDate: _d(-3), nextCutDate: _d(11), notes: "Gate code: 1234", paymentStatus: "paid", amountOwed: 0 },
];
const DEFAULT_LAWN_JOBS = [
  { id: 101, clientId: 1, clientName: "Mike Johnson", date: _d(0), price: 60, status: "scheduled", paymentStatus: "pending", notes: "" },
  { id: 102, clientId: 2, clientName: "Sarah Chen", date: _d(0), price: 75, status: "scheduled", paymentStatus: "pending", notes: "" },
  { id: 103, clientId: 2, clientName: "Sarah Chen", date: _d(-7), price: 75, status: "completed", paymentStatus: "unpaid", notes: "" },
];
const DEFAULT_LAWN_LEADS = [
  { id: 201, name: "Tom Wilson", phone: "555-0201", address: "321 Birch Ln", source: "Referral", quoteAmount: 65, status: "quote_sent", quoteSentDate: _d(-6), followUpDate: _d(1), notes: "Interested in biweekly", createdDate: _d(-8), lastContactedDate: _d(-6) },
  { id: 202, name: "Lisa Park", phone: "555-0202", address: "654 Maple Dr", source: "Door knock", quoteAmount: null, status: "new", quoteSentDate: null, followUpDate: null, notes: "", createdDate: _d(-2), lastContactedDate: null },
];

function usePersistedState(key, fallback) {
  const [value, setValue] = useState(() => safeLoad(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue];
}

function DailyBriefBanner({ T, text, onDismiss }) {
  return (
    <div style={{ margin: "0 16px 9px", padding: "12px 14px 12px 15px", borderRadius: 16, background: T.accentSoft, border: `1px solid rgba(249,115,22,.22)`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.accent, marginBottom: 4 }}>TODAY'S BRIEF</div>
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{text}</div>
      </div>
      <button onClick={onDismiss} style={{ fontSize: 18, color: T.muted, lineHeight: 1, marginTop: -1, flexShrink: 0 }}>×</button>
    </div>
  );
}

function WeeklySummaryCard({ T, summary, onDismiss }) {
  return (
    <div style={{ margin: "0 16px 9px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "15px 16px 14px", boxShadow: T.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 11 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 2 }}>WEEKLY SUMMARY</div>
          <div className="serif" style={{ fontSize: 19 }}>Last Week Review</div>
        </div>
        <button onClick={onDismiss} style={{ fontSize: 18, color: T.muted, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 11 }}>
        {[["Revenue", money(summary.income), "#10b981"], ["Profit", money(summary.weekProfit), summary.weekProfit >= 0 ? "#10b981" : "#ef4444"], ["Debt", money(summary.totalDebt), "#ef4444"]].map(([label, val, color]) => (
          <div key={label} style={{ padding: "9px 10px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 12px", borderRadius: 12, background: T.accentSoft, border: `1px solid rgba(249,115,22,.2)` }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".13em", color: T.accent, marginBottom: 4 }}>FOCUS THIS WEEK</div>
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{summary.focus}</div>
      </div>
    </div>
  );
}

const PRIORITY_COLOR = { high: "#ef4444", medium: "#f97316", low: "#6b7280" };

function NotificationsScreen({ T, smartReminders: reminders, dismissedReminders, onDismissReminder: onDismiss, onClearDismissedReminders: onClearDismissed, notifPermission, onRequestNotif, onTestNotif }) {
  const [filter, setFilter] = useState("all");
  const cats = ["all", "tasks", "money", "lawn", "leads"];
  const active = (reminders || []).filter(r => !dismissedReminders.includes(r.id));
  const dismissed = (reminders || []).filter(r => dismissedReminders.includes(r.id));
  const filtered = filter === "all" ? active : active.filter(r => r.category === filter);
  return (
    <div className="au">
      <HeaderArt T={T} title="Reminders" kicker="NOTIFICATION CENTER" />
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 13, paddingBottom: 2 }} className="hs">
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 99, whiteSpace: "nowrap", background: filter === c ? T.accent : T.surface, color: filter === c ? "#fff" : T.muted, border: `1px solid ${filter === c ? T.accent : T.border}` }}>
              {c === "all" ? `All (${active.length})` : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "36px 0", color: T.muted, fontSize: 13 }}>No active reminders.</div>}
        {filtered.map(r => (
          <div key={r.id} style={{ marginBottom: 8, padding: "12px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}`, display: "flex", gap: 11, alignItems: "flex-start" }}>
            <div style={{ width: 7, height: 7, borderRadius: 99, background: PRIORITY_COLOR[r.priority] || T.muted, marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.55 }}>{r.message}</div>
              <div style={{ fontSize: 9, color: T.dim, marginTop: 4, fontWeight: 700, letterSpacing: ".1em" }}>{r.category?.toUpperCase()}</div>
            </div>
            <button onClick={() => onDismiss(r.id)} style={{ fontSize: 16, color: T.muted, flexShrink: 0 }}>×</button>
          </div>
        ))}
        <div style={{ marginTop: 18, padding: "14px 15px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 10 }}>BROWSER NOTIFICATIONS</div>
          {notifPermission === "unsupported" && <div style={{ fontSize: 12, color: T.muted }}>Not supported in this browser.</div>}
          {notifPermission === "denied" && <div style={{ fontSize: 12, color: "#ef4444" }}>Blocked by browser. Allow notifications in site settings to enable.</div>}
          {notifPermission === "default" && <button onClick={onRequestNotif} style={{ width: "100%", padding: "11px 0", borderRadius: 13, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 13 }}>Enable Notifications</button>}
          {notifPermission === "granted" && (
            <div>
              <div style={{ fontSize: 12, color: "#10b981", marginBottom: 10 }}>✓ Notifications enabled</div>
              <button onClick={onTestNotif} style={{ width: "100%", padding: "10px 0", borderRadius: 13, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>Send test notification</button>
            </div>
          )}
        </div>
        {dismissed.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.dim }}>DISMISSED ({dismissed.length})</div>
              <button onClick={onClearDismissed} style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>Clear all</button>
            </div>
            {dismissed.map(r => (
              <div key={r.id} style={{ marginBottom: 7, padding: "10px 13px", borderRadius: 13, background: T.surface, border: `1px solid ${T.borderSoft}`, opacity: 0.4, fontSize: 12, color: T.muted }}>
                {r.title} — {r.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsScreen({ T, isDark, theme, setTheme, notifPermission, onRequestNotif, onTestNotif, bizProfile, setBizProfile }) {
  return (
    <div className="au">
      <HeaderArt T={T} title="Settings" kicker="PREFERENCES" />
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "15px 16px", marginBottom: 9 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 12 }}>APPEARANCE</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>Theme</span>
            <button onClick={() => setTheme(isDark ? "light" : "dark")} style={{ padding: "7px 16px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 12, color: T.text }}>
              {isDark ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "15px 16px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 12 }}>BROWSER NOTIFICATIONS</div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>Opt in to receive reminders about overdue tasks and follow-ups. Notifications only fire while the app is open in a browser tab.</div>
          {notifPermission === "unsupported" && <div style={{ fontSize: 12, color: T.muted }}>Not supported in this browser.</div>}
          {notifPermission === "denied" && <div style={{ fontSize: 12, color: "#ef4444", lineHeight: 1.55 }}>Blocked by browser. Go to your browser's site settings and allow notifications for this page.</div>}
          {notifPermission === "default" && <button onClick={onRequestNotif} style={{ width: "100%", padding: "12px 0", borderRadius: 13, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 13 }}>Enable Notifications</button>}
          {notifPermission === "granted" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}><div style={{ width: 8, height: 8, borderRadius: 99, background: "#10b981" }} /><span style={{ fontSize: 12, color: "#10b981" }}>Enabled</span></div>
              <button onClick={onTestNotif} style={{ width: "100%", padding: "11px 0", borderRadius: 13, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>Send test notification</button>
            </div>
          )}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "15px 16px", marginTop: 9 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 12 }}>BUSINESS PROFILE</div>
          {[["businessName","Business Name"],["ownerName","Your Name"],["cashApp","Cash App handle ($username)"],["venmo","Venmo handle (@username)"]].map(([k, ph]) => (
            <input key={k} value={(bizProfile || {})[k] || ""} onChange={e => setBizProfile(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12, marginBottom: 7 }} />
          ))}
          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Used in payment requests and bulk messages.</div>
        </div>
      </div>
    </div>
  );
}

function CommLog({ T, entries, onAdd }) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ text: "", method: "text" });
  const iStyle = { width: "100%", padding: "9px 11px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12, marginBottom: 7 };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.dim }}>COMMS ({entries.length})</div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{showAdd ? "Cancel" : "+ Log"}</button>
      </div>
      {showAdd && (
        <div style={{ marginBottom: 9, padding: "11px 12px", borderRadius: 14, background: T.surface2, border: `1px solid ${T.border}` }}>
          <select value={draft.method} onChange={e => setDraft(p => ({ ...p, method: e.target.value }))} style={{ ...iStyle, marginBottom: 6 }}>
            {[["text","Text"],["call","Call"],["in_person","In Person"],["email","Email"],["other","Note"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea value={draft.text} onChange={e => setDraft(p => ({ ...p, text: e.target.value }))} placeholder="What was said or happened..." rows={2} style={{ ...iStyle, resize: "none", lineHeight: 1.5 }} />
          <button onClick={() => { if (!draft.text.trim()) return; onAdd("note", draft.text, draft.method); setDraft({ text: "", method: "text" }); setShowAdd(false); }} style={{ width: "100%", padding: "9px 0", borderRadius: 11, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 12 }}>Save</button>
        </div>
      )}
      {entries.length === 0 && <div style={{ fontSize: 11, color: T.dim }}>No communications logged yet.</div>}
      {entries.slice(0, 6).map((e, i) => (
        <div key={e.id} style={{ padding: "7px 0", borderTop: `1px solid ${T.borderSoft}` }}>
          <div style={{ fontSize: 12, color: T.text, lineHeight: 1.5 }}>{e.text}</div>
          <div style={{ fontSize: 9, color: T.dim, marginTop: 3, fontWeight: 600 }}>
            {(e.method || "note").replace(/_/g," ").toUpperCase()} · {new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {e.type === "payment_request" && " · PAY REQUEST"}
          </div>
        </div>
      ))}
    </div>
  );
}

function LawnReportScreen({ T, isDark, lawnClients, setLawnClients, lawnJobs, setLawnJobs, lawnLeads, lawnWeeklyTarget, setLawnWeeklyTarget, clientComms, setTab }) {
  const report = lawnReport(lawnJobs, lawnClients, lawnLeads);
  const [editTarget, setEditTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(lawnWeeklyTarget));
  const targetPct = lawnWeeklyTarget > 0 ? clamp((report.weekRevenue / lawnWeeklyTarget) * 100) : 0;
  return (
    <div className="au">
      <HeaderArt T={T} title="Business Report" kicker="LAWN · PERFORMANCE" />
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 9 }}>
          {[["This Week", money(report.weekRevenue), "#10b981"], ["This Month", money(report.monthRevenue), "#3b82f6"], ["Last Week", money(report.prevWeekRevenue), T.muted], ["Projected/Mo", money(report.projectedMonthly), "#a855f7"]].map(([l, v, c]) => (
            <div key={l} style={{ padding: "13px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 9, padding: "15px 16px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div><div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted }}>WEEKLY TARGET</div><div className="serif" style={{ fontSize: 20 }}>{money(report.weekRevenue)} / {money(lawnWeeklyTarget)}</div></div>
            <Ring pct={targetPct} size={52} color="#10b981"><span style={{ fontSize: 10, fontWeight: 800, color: "#10b981" }}>{targetPct}%</span></Ring>
          </div>
          {editTarget ? (
            <div style={{ display: "flex", gap: 7 }}>
              <input value={targetDraft} onChange={e => setTargetDraft(e.target.value)} type="number" placeholder="Weekly target $" style={{ flex: 1, padding: "9px 11px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12 }} />
              <button onClick={() => { setLawnWeeklyTarget(Number(targetDraft) || 500); setEditTarget(false); }} style={{ padding: "0 14px", borderRadius: 12, background: T.accent, color: "#fff", fontWeight: 800 }}>Set</button>
            </div>
          ) : (
            <button onClick={() => { setTargetDraft(String(lawnWeeklyTarget)); setEditTarget(true); }} style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>Edit target</button>
          )}
        </div>
        <div style={{ marginBottom: 9, padding: "15px 16px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 11 }}>JOBS PERFORMANCE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 11 }}>
            {[["Completed", report.completedCount, "#10b981"], ["Skipped", report.skippedCount, "#ef4444"], ["Unpaid", report.unpaidJobs.length, "#f97316"]].map(([l, v, c]) => (
              <div key={l} style={{ padding: "10px 8px", borderRadius: 14, background: T.surface2, border: `1px solid ${T.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[["Completion", report.completionRate, "#10b981"], ["Paid rate", report.paidRate, "#3b82f6"]].map(([l, pct, c]) => (
              <div key={l} style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>{l}</div>
                <div style={{ height: 5, borderRadius: 9, background: isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)", overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: c }} /></div>
                <div style={{ fontSize: 10, color: c, marginTop: 3, fontWeight: 700 }}>{pct}%</div>
              </div>
            ))}
          </div>
        </div>
        {report.topClients.length > 0 && (
          <div style={{ marginBottom: 9, padding: "15px 16px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 11 }}>BEST CLIENTS</div>
            {report.topClients.map(({ client, rev }, i) => (
              <div key={client.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.borderSoft}` : "none" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{client.name}</div><div style={{ fontSize: 10, color: T.muted }}>{client.frequency} · {money(client.price)}/cut</div></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{money(rev)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginBottom: 9, padding: "15px 16px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 11 }}>LEAD PIPELINE</div>
          {report.closeRate === null ? (
            <div style={{ fontSize: 12, color: T.muted }}>No closed leads yet. Mark leads as won or lost to see your close rate.</div>
          ) : (
            <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: report.closeRateBySource.length ? 11 : 0 }}>
              <Ring pct={report.closeRate} size={52} color="#a855f7"><span style={{ fontSize: 10, fontWeight: 800, color: "#a855f7" }}>{report.closeRate}%</span></Ring>
              <div><div style={{ fontSize: 15, fontWeight: 800 }}>{report.wonLeads} won / {report.closedLeads} closed</div><div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Close rate</div></div>
            </div>
          )}
          {report.closeRateBySource.length > 0 && report.closeRateBySource.map(({ src, rate, won, total }) => (
            <div key={src} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "5px 0", borderTop: `1px solid ${T.borderSoft}` }}>
              <span style={{ color: T.muted }}>{src}</span><span style={{ fontWeight: 700 }}>{won}/{total} · {rate}%</span>
            </div>
          ))}
        </div>
        {report.unpaidJobs.length > 0 && (
          <div style={{ marginBottom: 9, padding: "15px 16px", borderRadius: 20, background: "rgba(249,115,22,.09)", border: "1px solid rgba(249,115,22,.22)" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.accent, marginBottom: 5 }}>UNPAID INVOICES</div>
            <div className="serif" style={{ fontSize: 24 }}>{money(report.unpaidTotal)}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{report.unpaidJobs.length} invoice{report.unpaidJobs.length > 1 ? "s" : ""} outstanding — collect before adding new jobs</div>
          </div>
        )}
        {report.insights.length > 0 && (
          <div style={{ padding: "15px 16px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 9 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 11 }}>INSIGHTS</div>
            {report.insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.borderSoft}` : "none" }}>
                <div style={{ width: 6, height: 6, borderRadius: 99, background: T.accent, marginTop: 5, flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{ins}</div>
              </div>
            ))}
          </div>
        )}
        {(() => {
          const ret = retentionSummary(lawnClients, lawnJobs, clientComms || []);
          const fc = lawnForecast(lawnJobs, lawnClients);
          const RISK_COLOR = { low: "#10b981", medium: "#f97316", high: "#ef4444" };
          const today = todayISO();
          const retInsights = [];
          if (fc.unpaidTotal > 0) retInsights.push(`${money(fc.unpaidTotal)} in unpaid work — collect before it ages.`);
          if (ret.atRiskRevenue > 0) retInsights.push(`${money(ret.atRiskRevenue)}/mo at risk from medium/high-risk clients.`);
          if (ret.missed > 0) retInsights.push(`${ret.missed} client${ret.missed > 1 ? "s" : ""} overdue for service. Schedule before they call someone else.`);
          const noNext = lawnClients.filter(c => c.status === "active" && c.frequency !== "one-time" && !lawnJobs.find(j => j.clientId === c.id && j.status === "scheduled" && j.date >= today));
          if (noNext.length) retInsights.push(`${noNext.length} active client${noNext.length > 1 ? "s" : ""} without a next cut scheduled.`);
          return (
            <div style={{ padding: "15px 16px", borderRadius: 20, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 12 }}>RETENTION INTELLIGENCE</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
                {[["Active clients", ret.activeCount, T.text], ["At-risk revenue", ret.atRiskRevenue > 0 ? money(ret.atRiskRevenue) + "/mo" : "—", ret.atRiskRevenue > 0 ? "#ef4444" : T.muted], ["Overdue cuts", ret.missed || "—", ret.missed > 0 ? "#f97316" : T.muted], ["No next cut", noNext.length || "—", noNext.length > 0 ? "#f97316" : T.muted]].map(([l, v, c]) => (
                  <div key={l} style={{ padding: "10px 12px", borderRadius: 14, background: T.surface2, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 9, color: T.muted, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
                {[["Low", ret.low, "#10b981"], ["Medium", ret.medium, "#f97316"], ["High", ret.high, "#ef4444"]].map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, padding: "9px 6px", borderRadius: 12, background: v > 0 ? `${c}14` : T.surface2, border: `1px solid ${v > 0 ? c + "44" : T.border}`, textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: T.muted, marginBottom: 3 }}>{l} risk</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: v > 0 ? c : T.dim }}>{v}</div>
                  </div>
                ))}
              </div>
              {ret.risks.filter(r => r.risk === "high" || r.risk === "medium").length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", color: T.dim, marginBottom: 7 }}>FLAGGED CLIENTS</div>
                  {ret.risks.filter(r => r.risk !== "low").sort((a, b) => (b.risk === "high" ? 1 : 0) - (a.risk === "high" ? 1 : 0)).map(({ client: c, risk, ltv }) => (
                    <div key={c.id} style={{ marginBottom: 7, padding: "11px 12px", borderRadius: 14, background: T.surface2, border: `1px solid ${RISK_COLOR[risk]}44` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{c.frequency} · {money(ltv.projMonthly)}/mo · {ltv.daysSinceLast !== null ? `${ltv.daysSinceLast}d since last cut` : "no service on record"}</div>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: RISK_COLOR[risk], padding: "3px 8px", borderRadius: 8, background: `${RISK_COLOR[risk]}18` }}>{risk.toUpperCase()}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => { if (setLawnJobs) setLawnJobs(prev => [{ id: Date.now(), clientId: c.id, clientName: c.name, date: today, price: c.price, status: "scheduled", paymentStatus: "pending", notes: "" }, ...prev]); }} style={{ fontSize: 10, padding: "5px 10px", borderRadius: 9, background: T.accentSoft, color: T.accent, fontWeight: 700 }}>Schedule Today</button>
                        {c.amountOwed > 0 && <div style={{ fontSize: 10, padding: "5px 10px", borderRadius: 9, background: "rgba(249,115,22,.1)", color: "#f97316", fontWeight: 700 }}>{money(c.amountOwed)} owed</div>}
                        <button onClick={() => setLawnClients && setLawnClients(prev => prev.map(x => x.id === c.id ? { ...x, status: "paused" } : x))} style={{ fontSize: 10, padding: "5px 10px", borderRadius: 9, background: T.surface, border: `1px solid ${T.border}`, color: T.dim }}>Mark Paused</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {retInsights.length > 0 && (
                <div style={{ padding: "11px 12px", borderRadius: 13, background: "rgba(249,115,22,.07)", border: "1px solid rgba(249,115,22,.18)" }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", color: T.accent, marginBottom: 7 }}>RETENTION ACTIONS</div>
                  {retInsights.map((ins, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", borderTop: i > 0 ? `1px solid rgba(249,115,22,.15)` : "none" }}>
                      <div style={{ width: 5, height: 5, borderRadius: 99, background: T.accent, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: T.text, lineHeight: 1.55 }}>{ins}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function BulkMessagingPanel({ T, lawnClients, lawnLeads, lawnJobs, bizProfile, addComm }) {
  const today = todayISO();
  const [filter, setFilter] = useState("unpaid");
  const [template, setTemplate] = useState("payment");
  const [generated, setGenerated] = useState([]);
  const [copied, setCopied] = useState({});
  const FILTERS = [["unpaid","Unpaid"],["route","Today's Route"],["all_clients","All Clients"],["active_leads","Active Leads"],["followup","Follow-ups Due"]];
  const TEMPLATES = [["payment","Payment Request"],["followup","Follow-Up"],["reminder","Service Reminder"]];
  const targets = useMemo(() => {
    const ids = new Set();
    const dedup = (arr) => arr.filter(x => x && !ids.has(x.id) && ids.add(x.id));
    if (filter === "unpaid") return dedup(lawnClients.filter(c => c.amountOwed > 0).map(c => ({ ...c, _type: "client" })));
    if (filter === "route") return dedup(lawnJobs.filter(j => j.date === today && j.status !== "skipped").map(j => { const c = lawnClients.find(x => x.id === j.clientId); return c ? { ...c, _type: "client" } : null; }));
    if (filter === "all_clients") return dedup(lawnClients.filter(c => c.status === "active").map(c => ({ ...c, _type: "client" })));
    if (filter === "active_leads") return dedup(lawnLeads.filter(l => l.status !== "won" && l.status !== "lost").map(l => ({ ...l, _type: "lead" })));
    if (filter === "followup") return dedup(lawnLeads.filter(l => l.followUpDate && l.followUpDate <= today && l.status !== "won" && l.status !== "lost").map(l => ({ ...l, _type: "lead" })));
    return [];
  }, [filter, lawnClients, lawnLeads, lawnJobs, today]);
  const buildMsg = (t) => {
    const owner = bizProfile?.ownerName || "Your lawn pro", biz = bizProfile?.businessName || "Lawn Service";
    if (template === "payment") return generatePaymentRequest(t, null, bizProfile);
    if (template === "followup") return `Hey ${t.name}, this is ${owner} with ${biz}. Just following up — still interested in lawn service? Let me know what works for you!`;
    return `Hey ${t.name}, this is ${owner} with ${biz}. Your next lawn service is coming up soon. Let me know if anything needs to change!`;
  };
  const generate = () => { setGenerated(targets.map(t => ({ id: t.id, name: t.name, text: buildMsg(t), _type: t._type }))); setCopied({}); };
  const copy = (item) => {
    navigator.clipboard?.writeText(item.text).catch(() => {});
    addComm(item.id, item._type, "bulk_message", item.text, "text", "sent");
    setCopied(p => ({ ...p, [item.id]: true }));
  };
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 9 }}>SELECT GROUP</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 13 }}>
        {FILTERS.map(([v, l]) => <button key={v} onClick={() => { setFilter(v); setGenerated([]); }} style={{ fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 99, background: filter === v ? T.accent : T.surface2, color: filter === v ? "#fff" : T.muted, border: `1px solid ${filter === v ? T.accent : T.border}` }}>{l}{filter === v ? ` (${targets.length})` : ""}</button>)}
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 9 }}>TEMPLATE</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {TEMPLATES.map(([v, l]) => <button key={v} onClick={() => { setTemplate(v); setGenerated([]); }} style={{ fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 99, background: template === v ? T.accent : T.surface2, color: template === v ? "#fff" : T.muted, border: `1px solid ${template === v ? T.accent : T.border}` }}>{l}</button>)}
      </div>
      <button onClick={generate} disabled={targets.length === 0} style={{ width: "100%", padding: "11px 0", borderRadius: 14, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 13, marginBottom: 14, opacity: targets.length === 0 ? 0.45 : 1 }}>
        Generate {targets.length} Message{targets.length !== 1 ? "s" : ""}
      </button>
      {generated.length > 0 && <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 9 }}>MESSAGES — copy each to send manually</div>}
      {generated.map(item => (
        <div key={item.id} style={{ marginBottom: 9, padding: "13px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{item.name}</div>
          <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 9 }}>{item.text}</div>
          <button onClick={() => copy(item)} style={{ width: "100%", padding: "9px 0", borderRadius: 11, background: copied[item.id] ? "rgba(16,185,129,.13)" : T.surface2, border: `1px solid ${copied[item.id] ? "#10b981" : T.border}`, color: copied[item.id] ? "#10b981" : T.muted, fontWeight: 700, fontSize: 12 }}>
            {copied[item.id] ? "✓ Copied + Logged" : "Copy + Log"}
          </button>
        </div>
      ))}
    </div>
  );
}

function LawnScreen({ T, isDark, lawnClients, setLawnClients, lawnJobs, setLawnJobs, lawnLeads, setLawnLeads, addTxn, clientComms, leadComms, addComm, bizProfile }) {
  const [sub, setSub] = useState("route");
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [clientDraft, setClientDraft] = useState({ name: "", phone: "", address: "", price: "", frequency: "biweekly", notes: "" });
  const [leadDraft, setLeadDraft] = useState({ name: "", phone: "", address: "", source: "", quoteAmount: "", notes: "" });
  const [expandedClient, setExpandedClient] = useState(null);
  const [expandedLead, setExpandedLead] = useState(null);
  const today = todayISO();

  const todayJobs = lawnJobs.filter(j => j.date === today && j.status !== "skipped");
  const unpaidJobs = lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed");
  const todayRevenue = todayJobs.reduce((s, j) => s + Number(j.price || 0), 0);
  const completedToday = todayJobs.filter(j => j.status === "completed").length;
  const unpaidTotal = unpaidJobs.reduce((s, j) => s + Number(j.price || 0), 0);

  const completeJob = (jobId) => {
    const job = lawnJobs.find(j => j.id === jobId);
    if (!job) return;
    setLawnJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "completed", paymentStatus: "unpaid" } : j));
    setLawnClients(prev => prev.map(c => {
      if (c.id !== job.clientId) return c;
      return { ...c, lastCutDate: today, nextCutDate: calcNextCutDate(today, c.frequency), paymentStatus: "unpaid", amountOwed: Number(c.amountOwed || 0) + Number(job.price || 0) };
    }));
  };

  const markJobPaid = (jobId, logFinance = true) => {
    const job = lawnJobs.find(j => j.id === jobId);
    if (!job) return;
    setLawnJobs(prev => prev.map(j => j.id === jobId ? { ...j, paymentStatus: "paid" } : j));
    setLawnClients(prev => prev.map(c => {
      if (c.id !== job.clientId) return c;
      const newOwed = Math.max(0, Number(c.amountOwed || 0) - Number(job.price || 0));
      return { ...c, amountOwed: newOwed, paymentStatus: newOwed > 0 ? "unpaid" : "paid" };
    }));
    if (logFinance) addTxn({ type: "in", amount: Number(job.price), label: `${job.clientName} — lawn`, category: "Income", date: "Today", created: new Date().toISOString() });
  };

  const skipJob = (jobId) => setLawnJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: "skipped" } : j));
  const rescheduleJob = (jobId) => setLawnJobs(prev => prev.map(j => j.id === jobId ? { ...j, date: _d(1) } : j));

  const scheduleClientToday = (client) => {
    setLawnJobs(prev => [{ id: Date.now(), clientId: client.id, clientName: client.name, date: today, price: client.price, status: "scheduled", paymentStatus: "pending", notes: "" }, ...prev]);
    setSub("route");
  };

  const addClient = () => {
    if (!clientDraft.name.trim()) return;
    const client = { id: Date.now(), ...clientDraft, price: Number(clientDraft.price) || 0, status: "active", lastCutDate: null, nextCutDate: today, paymentStatus: "paid", amountOwed: 0 };
    setLawnClients(prev => [client, ...prev]);
    setLawnJobs(prev => [{ id: Date.now() + 1, clientId: client.id, clientName: client.name, date: today, price: client.price, status: "scheduled", paymentStatus: "pending", notes: "" }, ...prev]);
    setClientDraft({ name: "", phone: "", address: "", price: "", frequency: "biweekly", notes: "" });
    setShowAddClient(false);
  };

  const addLead = () => {
    if (!leadDraft.name.trim()) return;
    const lead = { id: Date.now(), ...leadDraft, quoteAmount: Number(leadDraft.quoteAmount) || null, status: "new", quoteSentDate: null, followUpDate: null, createdDate: today, lastContactedDate: null };
    setLawnLeads(prev => [lead, ...prev]);
    setLeadDraft({ name: "", phone: "", address: "", source: "", quoteAmount: "", notes: "" });
    setShowAddLead(false);
  };

  const updateLeadStatus = (leadId, status, extra = {}) => {
    setLawnLeads(prev => prev.map(l => l.id === leadId ? { ...l, status, lastContactedDate: today, ...(status === "quote_sent" ? { quoteSentDate: today } : {}), ...extra } : l));
  };

  const convertToClient = (lead) => {
    const client = { id: Date.now(), name: lead.name, phone: lead.phone || "", address: lead.address || "", price: Number(lead.quoteAmount) || 0, frequency: "biweekly", status: "active", lastCutDate: null, nextCutDate: today, notes: lead.notes || "", paymentStatus: "paid", amountOwed: 0 };
    setLawnClients(prev => [client, ...prev]);
    setLawnLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "won" } : l));
    setSub("clients");
  };

  const JOB_COLOR = { scheduled: T.muted, completed: "#10b981", skipped: T.dim, unpaid: "#f97316" };
  const LEAD_COLOR = { new: "#6b7280", contacted: "#3b82f6", quote_sent: "#f97316", follow_up_needed: "#ef4444", won: "#10b981", lost: T.dim };
  const subTabs = [["route","Route"],["clients","Clients"],["leads","Leads"],["invoices",`Unpaid${unpaidJobs.length ? ` (${unpaidJobs.length})` : ""}`],["comms","Messages"]];
  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12, marginBottom: 7 };

  return (
    <div className="au" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <HeaderArt T={T} title="Lawn" kicker="BUSINESS DASHBOARD" />

      {sub === "route" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: "0 16px", margin: "-6px 0 10px" }}>
          {[["Cuts", todayJobs.length, T.text], ["Revenue", money(todayRevenue), "#10b981"], ["Done", completedToday, "#10b981"], ["Unpaid", money(unpaidTotal), unpaidTotal > 0 ? "#f97316" : T.muted]].map(([l, v, c]) => (
            <div key={l} style={{ padding: "9px 6px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.muted }}>{l}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: c, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" }} className="hs">
        {subTabs.map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)} style={{ fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 99, whiteSpace: "nowrap", background: sub === k ? T.accent : T.surface, color: sub === k ? "#fff" : T.muted, border: `1px solid ${sub === k ? T.accent : T.border}` }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 28px" }} className="hs">

        {sub === "route" && <div>
          {todayJobs.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>No cuts scheduled for today.</div>}
          {todayJobs.map(job => (
            <div key={job.id} style={{ marginBottom: 9, padding: "13px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{job.clientName}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{lawnClients.find(c => c.id === job.clientId)?.address || ""}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{money(job.price)}</div><div style={{ fontSize: 10, fontWeight: 700, color: JOB_COLOR[job.status] || T.muted, marginTop: 2 }}>{job.status.toUpperCase()}</div></div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {job.status === "scheduled" && <button onClick={() => completeJob(job.id)} style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 10, background: "rgba(16,185,129,.13)", color: "#10b981" }}>Mark Done</button>}
                {job.status === "completed" && job.paymentStatus !== "paid" && <button onClick={() => markJobPaid(job.id)} style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 10, background: "rgba(16,185,129,.13)", color: "#10b981" }}>Mark Paid</button>}
                {job.status === "completed" && job.paymentStatus === "paid" && <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>✓ Paid</span>}
                {job.status === "scheduled" && <button onClick={() => rescheduleJob(job.id)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted }}>Tomorrow</button>}
                {job.status === "scheduled" && <button onClick={() => skipJob(job.id)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted }}>Skip</button>}
              </div>
            </div>
          ))}
        </div>}

        {sub === "clients" && <div>
          <button onClick={() => setShowAddClient(!showAddClient)} style={{ width: "100%", padding: "11px 0", borderRadius: 14, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 13, marginBottom: 12 }}>{showAddClient ? "Cancel" : "+ Add Client"}</button>
          {showAddClient && <div style={{ marginBottom: 12, padding: 14, borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 10 }}>NEW CLIENT</div>
            {[["name","Name *"],["phone","Phone"],["address","Address"],["price","Price per cut ($)"],["notes","Notes"]].map(([k,ph]) => <input key={k} value={clientDraft[k]} onChange={e => setClientDraft(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={inputStyle} />)}
            <select value={clientDraft.frequency} onChange={e => setClientDraft(p => ({ ...p, frequency: e.target.value }))} style={{ ...inputStyle, marginBottom: 10 }}>
              <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="one-time">One-time</option>
            </select>
            <button onClick={addClient} style={{ width: "100%", padding: "11px 0", borderRadius: 13, background: T.accent, color: "#fff", fontWeight: 800 }}>Save Client</button>
          </div>}
          {lawnClients.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>No clients yet. Add your first client above.</div>}
          {lawnClients.filter(c => c.status !== "paused").map(c => (
            <div key={c.id} style={{ marginBottom: 9, borderRadius: 16, background: T.surface, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <button onClick={() => setExpandedClient(expandedClient === c.id ? null : c.id)} style={{ width: "100%", padding: "13px 14px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Next: {c.nextCutDate || "—"} · {c.frequency}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 800 }}>{money(c.price)}</div><div style={{ fontSize: 10, fontWeight: 700, color: c.paymentStatus === "unpaid" ? "#f97316" : "#10b981", marginTop: 2 }}>{(c.paymentStatus || "paid").toUpperCase()}</div></div>
              </button>
              {expandedClient === c.id && <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.borderSoft}` }}>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.8, marginTop: 9 }}>
                  {c.phone && <div>{c.phone}</div>}{c.address && <div>{c.address}</div>}
                  {c.lastContacted && <div style={{ color: T.dim }}>Last contact: {c.lastContacted}</div>}
                  {c.amountOwed > 0 && <div style={{ color: "#f97316" }}>{money(c.amountOwed)} owed</div>}
                  {c.notes && <div style={{ marginTop: 4, fontStyle: "italic" }}>{c.notes}</div>}
                </div>
                {(() => {
                  const ltv = clientLTV(c, lawnJobs);
                  const risk = calcChurnRisk(c, lawnJobs, clientComms || []);
                  const RISK_C = { low: "#10b981", medium: "#f97316", high: "#ef4444" };
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5, marginTop: 10 }}>
                      {[["Earned", money(ltv.totalRevenue), T.text], ["Proj/mo", money(ltv.projMonthly), "#3b82f6"], ["Jobs", ltv.jobCount, T.text], ["Risk", risk.toUpperCase(), RISK_C[risk] || T.muted]].map(([l, v, col]) => (
                        <div key={l} style={{ padding: "7px 4px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: 8, color: T.muted, marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: col }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  <button onClick={() => scheduleClientToday(c)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.accentSoft, color: T.accent, fontWeight: 700 }}>Schedule Today</button>
                  {c.amountOwed > 0 && <button onClick={() => { const msg = generatePaymentRequest(c, null, bizProfile); navigator.clipboard?.writeText(msg).catch(() => {}); addComm(c.id, "client", "payment_request", msg, "text", "sent"); }} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "rgba(249,115,22,.13)", color: "#f97316", fontWeight: 700 }}>Copy Pay Request</button>}
                  <button onClick={() => setLawnClients(prev => prev.map(x => x.id === c.id ? { ...x, status: "paused" } : x))} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.muted }}>Pause</button>
                  <button onClick={() => { if (window.confirm(`Delete ${c.name}? This cannot be undone.`)) { setLawnClients(prev => prev.filter(x => x.id !== c.id)); setExpandedClient(null); } }} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", color: "#ef4444", fontWeight: 700 }}>Delete</button>
                </div>
                <CommLog T={T} entries={(clientComms || []).filter(e => e.entityId === c.id)} onAdd={(type, text, method) => addComm(c.id, "client", type, text, method)} />
              </div>}
            </div>
          ))}
          {lawnClients.filter(c => c.status === "paused").length > 0 && <>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.dim, margin: "12px 0 8px 2px" }}>PAUSED</div>
            {lawnClients.filter(c => c.status === "paused").map(c => (
              <div key={c.id} style={{ marginBottom: 7, padding: "11px 14px", borderRadius: 14, background: T.surface, border: `1px solid ${T.borderSoft}`, opacity: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13 }}>{c.name}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => setLawnClients(prev => prev.map(x => x.id === c.id ? { ...x, status: "active" } : x))} style={{ fontSize: 11, color: T.accent, fontWeight: 700 }}>Reactivate</button>
                  <button onClick={() => { if (window.confirm(`Delete ${c.name}?`)) setLawnClients(prev => prev.filter(x => x.id !== c.id)); }} style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>Delete</button>
                </div>
              </div>
            ))}
          </>}
        </div>}

        {sub === "leads" && <div>
          <button onClick={() => setShowAddLead(!showAddLead)} style={{ width: "100%", padding: "11px 0", borderRadius: 14, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 13, marginBottom: 12 }}>{showAddLead ? "Cancel" : "+ Add Lead"}</button>
          {showAddLead && <div style={{ marginBottom: 12, padding: 14, borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 10 }}>NEW LEAD</div>
            {[["name","Name *"],["phone","Phone"],["address","Address"],["source","Source (referral, door knock…)"],["quoteAmount","Quote amount ($)"],["notes","Notes"]].map(([k,ph]) => <input key={k} value={leadDraft[k]} onChange={e => setLeadDraft(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={inputStyle} />)}
            <button onClick={addLead} style={{ width: "100%", padding: "11px 0", borderRadius: 13, background: T.accent, color: "#fff", fontWeight: 800 }}>Save Lead</button>
          </div>}
          {lawnLeads.filter(l => l.status !== "won" && l.status !== "lost").length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>No active leads.</div>}
          {lawnLeads.filter(l => l.status !== "won" && l.status !== "lost").map(l => (
            <div key={l.id} style={{ marginBottom: 9, borderRadius: 16, background: T.surface, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <button onClick={() => setExpandedLead(expandedLead === l.id ? null : l.id)} style={{ width: "100%", padding: "13px 14px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{l.name}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{l.address || "No address"} · {l.source || "—"}</div></div>
                <div style={{ textAlign: "right" }}>{l.quoteAmount && <div style={{ fontSize: 13, fontWeight: 800 }}>{money(l.quoteAmount)}</div>}<div style={{ fontSize: 10, fontWeight: 700, color: LEAD_COLOR[l.status] || T.muted, marginTop: 2 }}>{l.status.replace(/_/g," ").toUpperCase()}</div></div>
              </button>
              {expandedLead === l.id && <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.borderSoft}` }}>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.8, marginTop: 8 }}>
                  {l.phone && <div>{l.phone}</div>}
                  {l.lastContactedDate && <div style={{ color: T.dim }}>Last contact: {l.lastContactedDate}</div>}
                  {l.quoteSentDate && <div>Quote sent: {l.quoteSentDate}</div>}
                  {l.followUpDate && <div style={{ color: l.followUpDate <= today ? "#ef4444" : T.muted }}>Follow-up: {l.followUpDate}</div>}
                  {l.notes && <div style={{ marginTop: 4, fontStyle: "italic" }}>{l.notes}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                  {l.status === "new" && <button onClick={() => updateLeadStatus(l.id, "contacted")} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}>Contacted</button>}
                  {["new","contacted","follow_up_needed"].includes(l.status) && <button onClick={() => updateLeadStatus(l.id, "quote_sent")} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.accentSoft, color: T.accent, fontWeight: 700 }}>Quote Sent</button>}
                  {l.status === "quote_sent" && <button onClick={() => updateLeadStatus(l.id, "follow_up_needed", { followUpDate: today })} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "rgba(239,68,68,.1)", color: "#ef4444", fontWeight: 700 }}>Need Follow-up</button>}
                  <button onClick={() => convertToClient(l)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: "rgba(16,185,129,.13)", color: "#10b981", fontWeight: 700 }}>Won → Client</button>
                  <button onClick={() => updateLeadStatus(l.id, "lost")} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.dim }}>Lost</button>
                </div>
                <CommLog T={T} entries={(leadComms || []).filter(e => e.entityId === l.id)} onAdd={(type, text, method) => addComm(l.id, "lead", type, text, method)} />
              </div>}
            </div>
          ))}
          {lawnLeads.filter(l => l.status === "won" || l.status === "lost").length > 0 && <>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.dim, margin: "12px 0 8px 2px" }}>CLOSED</div>
            {lawnLeads.filter(l => l.status === "won" || l.status === "lost").map(l => (
              <div key={l.id} style={{ marginBottom: 7, padding: "11px 14px", borderRadius: 13, background: T.surface, border: `1px solid ${T.borderSoft}`, opacity: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12 }}>{l.name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: l.status === "won" ? "#10b981" : T.dim }}>{l.status.toUpperCase()}</div>
              </div>
            ))}
          </>}
        </div>}

        {sub === "invoices" && <div>
          {unpaidJobs.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>No unpaid invoices.</div>}
          {unpaidJobs.length > 0 && <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(249,115,22,.09)", border: "1px solid rgba(249,115,22,.2)" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.accent, marginBottom: 3 }}>TOTAL UNPAID</div>
            <div className="serif" style={{ fontSize: 26 }}>{money(unpaidTotal)}</div>
          </div>}
          {unpaidJobs.map(job => (
            <div key={job.id} style={{ marginBottom: 9, padding: "13px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div><div style={{ fontSize: 13, fontWeight: 700 }}>{job.clientName}</div><div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Service: {job.date}</div></div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f97316" }}>{money(job.price)}</div>
              </div>
              <button onClick={() => markJobPaid(job.id, true)} style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "rgba(16,185,129,.13)", color: "#10b981", fontWeight: 800, fontSize: 12 }}>Mark Paid + Log to Finance</button>
            </div>
          ))}
        </div>}

        {sub === "comms" && <BulkMessagingPanel T={T} lawnClients={lawnClients} lawnLeads={lawnLeads} lawnJobs={lawnJobs} bizProfile={bizProfile} addComm={addComm} clientComms={clientComms} leadComms={leadComms} />}

      </div>
    </div>
  );
}

export default function KingdomOS() {
  const [theme, setTheme] = usePersistedState("kingdom_theme", "dark");
  const T = getTheme(theme === "dark");
  const [tab, setTab] = useState("home");
  const [fabOpen, setFabOpen] = useState(false);

  const [cash, setCash] = usePersistedState("kingdom_cash_v3", 2850);
  const [txns, setTxns] = usePersistedState("kingdom_txns_v3", [
    { id: 1, type: "in", amount: 450, label: "Website design", category: "Income", date: "May 7" },
    { id: 2, type: "in", amount: 180, label: "Lawn care", category: "Income", date: "May 6" },
    { id: 3, type: "out", amount: 80, label: "Internet bill", category: "Bills", date: "May 5" },
  ]);
  const [debts, setDebts] = usePersistedState("kingdom_debts_v3", [
    { id: 1, name: "Chase Sapphire", original: 4000, balance: 1280, paid: 2720, apr: 28.99, color: "#ef4444" },
    { id: 2, name: "Car Loan", original: 12000, balance: 6240, paid: 5760, apr: 7.5, color: "#3b82f6" },
  ]);
  const [rituals, setRituals] = usePersistedState("kingdom_rituals_v3", RITUAL_PRESETS.slice(0, 4).map((r, i) => ({ ...r, id: i + 1, doneDate: i === 0 ? todayISO() : null })));
  const [tasks, setTasks] = usePersistedState("kingdom_tasks_v3", [
    { id: 1, title: "Clean car", due: todayISO(), done: false },
    { id: 2, title: "Review Chase Sapphire balance", due: "none", done: false },
  ]);
  const [goals, setGoals] = usePersistedState("kingdom_goals_v3", [
    { id: 1, title: "Make $1,000 this week", category: "Money", target: 1000, current: 630 },
    { id: 2, title: "Pay Chase below $1,000", category: "Debt", target: 1000, current: 1280 },
    { id: 3, title: "Train 4x this week", category: "Fitness", target: 4, current: 1 },
    { id: 4, title: "Pray every morning", category: "Spiritual", target: 7, current: 1 },
  ]);
  const [pillars, setPillars] = usePersistedState("kingdom_pillars_v3", ["Faith", "Work", "Body", "Mind", "Money", "Debt"].map((label, i) => ({ id: i + 1, label, custom: "", pct: [85, 60, 70, 90, 0, 0][i], color: ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ef4444"][i] })));
  const [journalHistory, setJournalHistory] = usePersistedState("kingdom_journal_v3", []);
  const [msgs, setMsgs] = useState([{ id: 1, from: "ai", text: "I’m not just here to chat. I can log money, add tasks, check goals, challenge decisions, and help you choose the next move. Try: ‘lost $1000 gambling’ or ‘remind me to clean car tomorrow.’" }]);
  const [lawnClients, setLawnClients] = usePersistedState("kingdom_lawn_clients_v1", DEFAULT_LAWN_CLIENTS);
  const [lawnJobs, setLawnJobs] = usePersistedState("kingdom_lawn_jobs_v1", DEFAULT_LAWN_JOBS);
  const [lawnLeads, setLawnLeads] = usePersistedState("kingdom_lawn_leads_v1", DEFAULT_LAWN_LEADS);
  const [lawnWeeklyTarget, setLawnWeeklyTarget] = usePersistedState("kingdom_lawn_target_v1", 500);
  const [clientComms, setClientComms] = usePersistedState("kingdom_client_comms_v1", []);
  const [leadComms, setLeadComms] = usePersistedState("kingdom_lead_comms_v1", []);
  const [bizJournal, setBizJournal] = usePersistedState("kingdom_biz_journal_v1", []);
  const [bizProfile, setBizProfile] = usePersistedState("kingdom_biz_profile_v1", { businessName: "", ownerName: "", cashApp: "", venmo: "" });
  const [dismissedBriefDate, setDismissedBriefDate] = usePersistedState("kb_brief_dismissed", "");
  const [dismissedSummaryWeek, setDismissedSummaryWeek] = usePersistedState("kb_summary_dismissed", "");
  const [dismissedReminders, setDismissedReminders] = usePersistedState("kb_dismissed_reminders", []);
  const [dismissedNudges, setDismissedNudges] = usePersistedState("kb_dismissed_nudges", []);
  const [notifPermission, setNotifPermission] = useState(() => checkNotifPermission());

  const totalDebt = debts.reduce((s, d) => s + Number(d.balance || 0), 0);
  const totalOriginal = debts.reduce((s, d) => s + Number(d.original || 0), 0) || 1;
  const debtPaid = debts.reduce((s, d) => s + Number(d.paid || 0), 0);
  const debtPct = clamp((debtPaid / totalOriginal) * 100);
  const income = txns.filter(t => t.type === "in").reduce((s, t) => s + Number(t.amount || 0), 0);
  const outflow = txns.filter(t => t.type === "out").reduce((s, t) => s + Number(t.amount || 0), 0);
  const weekProfit = income - outflow;
  const weekPct = clamp((weekProfit / 1000) * 100);
  const todaysRituals = rituals.map(r => ({ ...r, done: r.doneDate === todayISO() }));
  const ritualPct = rituals.length ? clamp((todaysRituals.filter(r => r.done).length / rituals.length) * 100) : 0;
  const todayTasks = tasks.filter(t => !t.done && (t.due === todayISO() || t.due === "today"));
  const upcomingTasks = tasks.filter(t => !t.done && t.due !== todayISO() && t.due !== "today" && t.due !== "none");
  const noDateTasks = tasks.filter(t => !t.done && t.due === "none");
  const todayJournal = journalHistory.find(j => j.date === todayISO());

  const todayBriefText = generateDailyBrief({ tasks, txns, weekProfit, lawnJobs });
  const showDailyBrief = dismissedBriefDate !== todayISO();
  const weeklySummaryData = generateWeeklySummary({ income, outflow, weekProfit, tasks, totalDebt });
  const showWeeklySummary = new Date().getDay() === 1 && dismissedSummaryWeek !== getWeekKey();
  const smartReminders = generateSmartReminders({ tasks, txns, weekProfit, totalDebt, lawnJobs, lawnLeads, lawnClients });
  const mentorNudges = generateMentorNudges({ weekProfit, tasks, totalDebt, lawnJobs, lawnLeads, lawnClients }).filter(n => !dismissedNudges.includes(n.id));
  const activeReminderCount = smartReminders.filter(r => !dismissedReminders.includes(r.id)).length;

  const requestNotif = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };
  const testNotif = () => sendLocalNotification("Kingdom Builder", "Notifications are working.");

  const resolvedPillars = pillars.map(p => {
    const label = p.label === "Custom" ? p.custom : p.label;
    const key = label.toLowerCase();
    let pct = p.pct;
    if (key.includes("money") || key.includes("wealth") || key.includes("business")) pct = weekPct;
    if (key.includes("debt")) pct = debtPct;
    const relatedRituals = todaysRituals.filter(r => r.tag.toLowerCase() === key.toLowerCase());
    if (relatedRituals.length) pct = clamp((relatedRituals.filter(r => r.done).length / relatedRituals.length) * 100);
    return { ...p, label, pct };
  });

  const addTxn = (txn) => {
    setTxns(prev => [{ ...txn, id: Date.now(), date: "Today" }, ...prev]);
    setCash(prev => txn.type === "in" ? Number(prev) + txn.amount : Number(prev) - txn.amount);
  };

  const addTask = (title, due = "none") => setTasks(prev => [{ id: Date.now(), title, due, done: false }, ...prev]);

  const addComm = (entityId, entityType, type, text, method = "other", direction = "note", opts = {}) => {
    const entry = { id: Date.now(), entityId, entityType, type, text, method, direction, timestamp: new Date().toISOString(), ...opts };
    if (entityType === "client") {
      setClientComms(prev => [entry, ...prev]);
      setLawnClients(prev => prev.map(c => c.id === entityId ? { ...c, lastContacted: todayISO() } : c));
    } else {
      setLeadComms(prev => [entry, ...prev]);
      setLawnLeads(prev => prev.map(l => l.id === entityId ? { ...l, lastContactedDate: todayISO() } : l));
    }
  };

  const mentorAction = (text) => {
    const lower = text.toLowerCase();
    const today = todayISO();

    // Communication: log contact
    const logContactMatch = lower.match(/(?:log.*(?:texted|called|talked to|contacted|messaged)|i texted|i called|i messaged)\s+(.+)/);
    if (logContactMatch) {
      const nameRaw = logContactMatch[1].replace(/\s+about.*/i, "").trim();
      const cl = lawnClients.find(c => c.name.toLowerCase().includes(nameRaw));
      const ld = !cl && lawnLeads.find(l => l.name.toLowerCase().includes(nameRaw));
      const entity = cl || ld;
      if (!entity) return `No client or lead found matching "${nameRaw}". Check the Lawn screen.`;
      const method = /texted|text|messaged/.test(lower) ? "text" : /called|call/.test(lower) ? "call" : "other";
      const aboutM = text.match(/about\s+(.+)$/i);
      addComm(entity.id, cl ? "client" : "lead", "contact", aboutM ? aboutM[1].trim() : "Contact logged", method, "sent");
      return `Logged contact with ${entity.name} via ${method}. Last contacted updated to today.`;
    }

    // Communication: mark last contacted
    const markContactMatch = lower.match(/mark\s+(.+?)\s+(?:last\s+)?contacted\s+today/);
    if (markContactMatch) {
      const nameRaw = markContactMatch[1].trim();
      const cl = lawnClients.find(c => c.name.toLowerCase().includes(nameRaw));
      const ld = !cl && lawnLeads.find(l => l.name.toLowerCase().includes(nameRaw));
      const entity = cl || ld;
      if (!entity) return `No client or lead found matching "${nameRaw}".`;
      if (cl) setLawnClients(prev => prev.map(c => c.id === entity.id ? { ...c, lastContacted: today } : c));
      else setLawnLeads(prev => prev.map(l => l.id === entity.id ? { ...l, lastContactedDate: today } : l));
      return `${entity.name} marked as last contacted today.`;
    }

    // Communication: who hasn’t been contacted
    if (/haven.?t contacted|not contacted recently|who.*haven.?t.*reached|clients.*no contact/.test(lower)) {
      const now2 = new Date();
      const stale = lawnClients.filter(c => { if (c.status !== "active") return false; const last = c.lastContacted || c.lastCutDate; if (!last) return true; return Math.floor((now2 - new Date(`${last}T12:00:00`)) / 86400000) >= 21; });
      if (!stale.length) return "All active clients contacted within the last 3 weeks. Stay proactive.";
      return `Clients not recently contacted:\n${stale.map(c => `• ${c.name} — last: ${c.lastContacted || c.lastCutDate || "never"}`).join("\n")}\n\nReach out before they drift.`;
    }

    // Communication: write payment request
    if (/payment.*request|write.*payment|send.*payment/.test(lower)) {
      const nameM = lower.match(/(?:for|to)\s+([a-z]+(?:\s+[a-z]+)?)\s*$/);
      const nameRaw = nameM ? nameM[1].trim() : "";
      const cl = nameRaw && lawnClients.find(c => c.name.toLowerCase().includes(nameRaw));
      if (!cl) return "Who should I write the payment request for? Try: \"write a payment request for Mike\"";
      const msg = generatePaymentRequest(cl, null, bizProfile);
      addComm(cl.id, "client", "payment_request", msg, "text", "sent");
      return `Payment request for ${cl.name} (logged to comms):\n\n"${msg}"`;
    }

    // Communication: log note for client/lead
    const noteLogM = text.match(/log.*note.*for\s+(.+?):\s*(.+)/i);
    if (noteLogM) {
      const nameRaw = noteLogM[1].trim();
      const noteText = noteLogM[2].trim();
      const cl = lawnClients.find(c => c.name.toLowerCase().includes(nameRaw.toLowerCase()));
      const ld = !cl && lawnLeads.find(l => l.name.toLowerCase().includes(nameRaw.toLowerCase()));
      const entity = cl || ld;
      if (!entity) return `No client or lead found matching "${nameRaw}".`;
      addComm(entity.id, cl ? "client" : "lead", "note", noteText, "other", "note");
      return `Note logged for ${entity.name}: "${noteText}"`;
    }

    // Business lesson
    if (/business lesson|what.*learn.*today|lesson.*today/.test(lower)) {
      const r = lawnReport(lawnJobs, lawnClients, lawnLeads);
      const lessons = [];
      if (r.skippedCount > 0) lessons.push("Skipped jobs = lost revenue. Build a same-day reschedule protocol.");
      if (r.unpaidTotal > 0) lessons.push(`${money(r.unpaidTotal)} unpaid — tighten your collection process. Collect same-day when possible.`);
      if (r.closeRate !== null && r.closeRate < 50) lessons.push("Close rate below 50%. Follow up within 24 hours of every quote — that’s where deals die.");
      if (!lessons.length) lessons.push("Today looked clean. The lesson: identify what’s working and do it more intentionally.");
      return `Today’s business lesson:\n\n${lessons.join("\n\n")}\n\nOpen the Business Journal to write this down and build a system from it.`;
    }

    // Lawn: today’s route
    if (/who.*(cut|mow|route).*today|today.*(cut|mow|route)|route today|my schedule/.test(lower)) {
      const todayJobs = lawnJobs.filter(j => j.date === today && j.status !== "skipped");
      if (!todayJobs.length) return "Nothing scheduled for today. Add jobs from the Lawn screen.";
      const rev = todayJobs.reduce((s, j) => s + Number(j.price || 0), 0);
      return `Today’s cuts:\n${todayJobs.map(j => `• ${j.clientName} — ${money(j.price)}`).join("\n")}\n\nExpected: ${money(rev)}. Execute before checking your phone.`;
    }

    // Lawn: week revenue
    if (/lawn.*(revenue|income|made|money).*week|week.*lawn.*(revenue|income)|how much.*lawn/.test(lower)) {
      const d = new Date(), ws = _d(-(d.getDay() === 0 ? 6 : d.getDay() - 1));
      const weekRev = lawnJobs.filter(j => j.status === "completed" && j.date >= ws && j.date <= today).reduce((s, j) => s + Number(j.price || 0), 0);
      const unpaidAmt = lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed").reduce((s, j) => s + Number(j.price || 0), 0);
      return `Lawn revenue this week: ${money(weekRev)}.\n${unpaidAmt > 0 ? `${money(unpaidAmt)} is still unpaid — collect before it ages.` : "All collected. Clean slate."}`;
    }

    // Lawn: unpaid clients
    if (/unpaid|who owes|owe.*money/.test(lower) && /lawn|client|cut|mow/.test(lower)) {
      const unpaid = lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed");
      if (!unpaid.length) return "No unpaid lawn invoices. You’re fully collected — well done.";
      const total = unpaid.reduce((s, j) => s + Number(j.price || 0), 0);
      return `Unpaid invoices:\n${unpaid.map(j => `• ${j.clientName}: ${money(j.price)} (${j.date})`).join("\n")}\n\nTotal: ${money(total)}\n\nCollect these before you chase new work.`;
    }

    // Lawn: leads needing follow-up
    if (/leads?.*follow.?up|follow.?up.*leads?|what leads/.test(lower)) {
      const followUp = lawnLeads.filter(l => l.followUpDate && l.followUpDate <= today && l.status !== "won" && l.status !== "lost");
      const cold = lawnLeads.filter(l => l.status === "quote_sent" && l.quoteSentDate && (new Date() - new Date(`${l.quoteSentDate}T12:00:00`)) / 86400000 >= 5);
      const ids = new Set([...followUp, ...cold].map(l => l.id));
      const all = [...ids].map(id => lawnLeads.find(l => l.id === id)).filter(Boolean);
      if (!all.length) return "No leads need immediate follow-up. Stay ahead by following up within 48 hours of every quote.";
      return `Leads needing follow-up:\n${all.map(l => `• ${l.name} — ${l.status.replace(/_/g, " ")} (${l.source || "—"})`).join("\n")}\n\nPick up the phone. Every day you wait cuts your close rate.`;
    }

    // Lawn: schedule [name] for today/tomorrow
    const schedMatch = lower.match(/schedule\s+(.+?)\s+(?:for\s+)?(today|tomorrow)/);
    if (schedMatch) {
      const nameQuery = schedMatch[1].trim();
      const dateStr = /tomorrow/.test(schedMatch[2]) ? _d(1) : today;
      const client = lawnClients.find(c => c.name.toLowerCase().includes(nameQuery));
      if (!client) return `No client found matching "${nameQuery}". Check the Clients tab in Lawn.`;
      setLawnJobs(prev => [...prev, { id: Date.now(), clientId: client.id, clientName: client.name, date: dateStr, price: client.price, status: "scheduled", paymentStatus: "pending", notes: "" }]);
      return `Scheduled ${client.name} for ${dateStr === today ? "today" : "tomorrow"} — ${money(client.price)}. Check the Route tab.`;
    }

    // Lawn: mark [name] paid
    const paidMatch = lower.match(/mark\s+(.+?)\s+paid/);
    if (paidMatch) {
      const nameQuery = paidMatch[1].trim();
      const job = lawnJobs.find(j => j.paymentStatus === "unpaid" && j.status === "completed" && j.clientName.toLowerCase().includes(nameQuery));
      if (!job) return `No unpaid completed job found for "${nameQuery}". Check the Invoices tab.`;
      setLawnJobs(prev => prev.map(j => j.id === job.id ? { ...j, paymentStatus: "paid" } : j));
      setLawnClients(prev => prev.map(c => { if (c.id !== job.clientId) return c; const owed = Math.max(0, Number(c.amountOwed || 0) - Number(job.price || 0)); return { ...c, amountOwed: owed, paymentStatus: owed > 0 ? "unpaid" : "paid" }; }));
      addTxn({ type: "in", amount: Number(job.price), label: `${job.clientName} — lawn`, category: "Income", date: "Today", created: new Date().toISOString() });
      return `Marked ${job.clientName} paid — ${money(job.price)} logged to finance. Good. Now collect the rest.`;
    }

    // Lawn: mark [name] done/complete
    const doneMatch = lower.match(/mark\s+(.+?)\s+(?:cut\s+)?(?:done|complete|finished)/);
    if (doneMatch) {
      const nameQuery = doneMatch[1].trim();
      const job = lawnJobs.find(j => j.status === "scheduled" && j.date === today && j.clientName.toLowerCase().includes(nameQuery));
      if (!job) return `No scheduled job today for "${nameQuery}".`;
      setLawnJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "completed", paymentStatus: "unpaid" } : j));
      setLawnClients(prev => prev.map(c => { if (c.id !== job.clientId) return c; return { ...c, lastCutDate: today, nextCutDate: calcNextCutDate(today, c.frequency), paymentStatus: "unpaid", amountOwed: Number(c.amountOwed || 0) + Number(job.price || 0) }; }));
      return `${job.clientName} marked cut complete. ${money(job.price)} is now unpaid — follow up on payment today.`;
    }

    // Lawn: add lead [name] from [source] quoted $[amount]
    const leadMatch = lower.match(/add lead\s+(.+?)(?:\s+from\s+(.+?))?(?:\s+quoted?\s+\$?(\d+(?:\.\d{1,2})?))?$/);
    if (leadMatch) {
      const name = leadMatch[1]?.trim() || "New Lead";
      const source = leadMatch[2]?.trim() || "";
      const quoteAmount = leadMatch[3] ? Number(leadMatch[3]) : null;
      setLawnLeads(prev => [{ id: Date.now(), name, phone: "", address: "", source, quoteAmount, status: "new", quoteSentDate: null, followUpDate: null, createdDate: today, lastContactedDate: null, notes: "" }, ...prev]);
      return `Added lead: ${name}${source ? ` from ${source}` : ""}${quoteAmount ? ` · ${money(quoteAmount)}` : ""}.\n\nSend a quote within 24 hours or your close rate drops.`;
    }

    // Lawn: set [name] follow-up for today/tomorrow
    const fuMatch = lower.match(/set\s+(.+?)\s+follow.?up\s+for\s+(today|tomorrow)/);
    if (fuMatch) {
      const nameQuery = fuMatch[1].trim();
      const fuDate = /tomorrow/.test(fuMatch[2]) ? _d(1) : today;
      const lead = lawnLeads.find(l => l.name.toLowerCase().includes(nameQuery) && l.status !== "won" && l.status !== "lost");
      if (!lead) return `No active lead found matching "${nameQuery}".`;
      setLawnLeads(prev => prev.map(l => l.id === lead.id ? { ...l, followUpDate: fuDate } : l));
      return `Follow-up set for ${lead.name} on ${fuDate}. Now go close it.`;
    }

    // Lawn: convert [name] to client
    const convertMatch = lower.match(/convert\s+(.+?)\s+to\s+client/);
    if (convertMatch) {
      const nameQuery = convertMatch[1].trim();
      const lead = lawnLeads.find(l => l.name.toLowerCase().includes(nameQuery) && l.status !== "won" && l.status !== "lost");
      if (!lead) return `No active lead found matching "${nameQuery}".`;
      setLawnClients(prev => [{ id: Date.now(), name: lead.name, phone: lead.phone || "", address: lead.address || "", price: Number(lead.quoteAmount) || 0, frequency: "biweekly", status: "active", lastCutDate: null, nextCutDate: today, notes: lead.notes || "", paymentStatus: "paid", amountOwed: 0 }, ...prev]);
      setLawnLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: "won" } : l));
      return `${lead.name} is now a client at ${money(lead.quoteAmount || 0)}/cut. Schedule their first job from the Lawn screen.`;
    }

    // Retention: churn risk
    if (/churn|who.*risk|at.?risk.*client|losing.*client/.test(lower)) {
      const risks = lawnClients.filter(c => c.status === "active").map(c => ({ name: c.name, risk: calcChurnRisk(c, lawnJobs) }));
      const high = risks.filter(r => r.risk === "high"), medium = risks.filter(r => r.risk === "medium");
      if (!risks.length) return "No active clients yet.";
      let resp = "Churn risk summary:";
      if (high.length) resp += `\n\nHigh risk (${high.length}):\n${high.map(r => `• ${r.name}`).join("\n")}`;
      if (medium.length) resp += `\n\nMedium risk (${medium.length}):\n${medium.map(r => `• ${r.name}`).join("\n")}`;
      if (!high.length && !medium.length) resp += "\n\nAll active clients are low risk. Stay consistent.";
      return resp + `\n\nOpen Lawn Report → Retention for full details and actions.`;
    }

    // Retention: overdue clients / missed cuts
    if (/overdue.*client|client.*overdue|missed.*cut|cut.*missed|who.*overdue/.test(lower)) {
      const missed = detectMissedCuts(lawnClients, lawnJobs);
      if (!missed.length) return "No overdue clients detected. All active clients are within their expected service window.";
      return `Overdue service alerts:\n${missed.map(a => {
        if (a.type === "overdue") return `• ${a.clientName} — ${a.daysSinceLast}d since last cut (${a.frequency})`;
        if (a.type === "no_record") return `• ${a.clientName} — no service on record, no next cut scheduled`;
        return `• ${a.clientName} — scheduled cut from ${a.scheduledDate} overdue`;
      }).join("\n")}\n\nSchedule these now or you risk losing the relationship.`;
    }

    // Retention: who hasn't been cut recently
    if (/not.*cut.*recently|last.*cut|recent.*service|haven.?t been cut/.test(lower)) {
      const now2 = new Date();
      const sorted = lawnClients.filter(c => c.status === "active").map(c => {
        const d = c.lastCutDate ? Math.floor((now2 - new Date(`${c.lastCutDate}T12:00:00`)) / 86400000) : null;
        return { name: c.name, days: d };
      }).sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
      if (!sorted.length) return "No active clients.";
      return `Days since last cut:\n${sorted.map(c => `• ${c.name} — ${c.days !== null ? `${c.days}d ago` : "no record"}`).join("\n")}`;
    }

    // Retention: projected revenue this month
    if (/projected.*(?:month|revenue)|forecast.*month|how much.*(?:month|expect)|revenue.*forecast/.test(lower)) {
      const fc = lawnForecast(lawnJobs, lawnClients);
      return `Revenue forecast:\n• Projected month: ${money(fc.projMonthly)}\n• Collected this month: ${money(fc.monthCollected)}\n• Collected this week: ${money(fc.weekCollected)}\n• Unpaid (collected when paid): ${money(fc.unpaidTotal)}\n• Scheduled upcoming: ${money(fc.scheduledTotal)}\n\nProjected is based on active clients × expected cuts. Collect unpaid first — that's already-earned money sitting idle.`;
    }

    // Retention: most valuable clients / LTV
    if (/most.*valuable|top.*client|best.*client|client.*value|lifetime.*value|ltv/.test(lower)) {
      const ranked = lawnClients.filter(c => c.status === "active").map(c => ({ c, ltv: clientLTV(c, lawnJobs) })).sort((a, b) => b.ltv.totalRevenue - a.ltv.totalRevenue);
      if (!ranked.length) return "No active clients yet.";
      return `Most valuable clients by lifetime revenue:\n${ranked.slice(0, 5).map((r, i) => `${i + 1}. ${r.c.name} — ${money(r.ltv.totalRevenue)} earned · ${r.ltv.jobCount} cut${r.ltv.jobCount !== 1 ? "s" : ""} · ${money(r.ltv.projMonthly)}/mo projected`).join("\n")}\n\nThese clients are your core revenue. Protect them before chasing new leads.`;
    }

    // Retention: clients with no next cut scheduled
    if (/no.*next.*cut|next.*cut.*schedule|without.*next|missing.*next/.test(lower)) {
      const td = todayISO();
      const noNext = lawnClients.filter(c => c.status === "active" && c.frequency !== "one-time" && !lawnJobs.find(j => j.clientId === c.id && j.status === "scheduled" && j.date >= td));
      if (!noNext.length) return "All active clients have a next cut scheduled. Good.";
      return `Clients with no next cut scheduled:\n${noNext.map(c => `• ${c.name} (${c.frequency} · ${money(c.price)}/cut)`).join("\n")}\n\nSchedule their next job from the Lawn screen or say "schedule [name] for today."`;
    }

    // Retention: show retention alerts / at-risk revenue
    if (/retention.*alert|show.*retention|at.?risk.*revenue|revenue.*at.?risk|how much.*risk/.test(lower)) {
      const ret = retentionSummary(lawnClients, lawnJobs);
      const fc = lawnForecast(lawnJobs, lawnClients);
      if (ret.high === 0 && ret.medium === 0 && ret.missed === 0) return `Retention looks clean.\n• ${ret.activeCount} active clients\n• All low risk\n• No missed cuts detected\n\nStay consistent. Book next cuts before clients have to ask.`;
      return `Retention summary:\n• ${ret.high} high risk, ${ret.medium} medium risk, ${ret.low} low risk\n• ${ret.missed} overdue/missed cut${ret.missed !== 1 ? "s" : ""}\n• ${money(ret.atRiskRevenue)}/mo at risk\n• ${money(fc.unpaidTotal)} in unpaid invoices\n\nOpen Lawn Report → Retention to take action on each.`;
    }

    // Retention: generate follow-up text for overdue clients
    if (/follow.?up.*overdue|message.*overdue|text.*overdue|outreach.*overdue/.test(lower)) {
      const missed = detectMissedCuts(lawnClients, lawnJobs);
      if (!missed.length) return "No overdue clients to follow up with right now.";
      const owner = bizProfile?.ownerName || "Your lawn pro", biz = bizProfile?.businessName || "Lawn Service";
      return `Follow-up texts for overdue clients:\n\n${missed.map(a => `${a.clientName}:\n"Hey ${a.clientName.split(" ")[0]}, this is ${owner} with ${biz}. Wanted to check in — are you still needing lawn service? Let me know what works for you!"`).join("\n\n")}\n\nCopy and send these manually. Log the response in the Clients tab.`;
    }

    // Finance log
    const parsed = parseFinanceText(text);
    if (parsed) {
      addTxn(parsed);
      return parsed.type === "out"
        ? `I logged ${money(parsed.amount)} as ${parsed.label}. Cash and week profit both went down. Why did you make this purchase? Was it emotional or intentional?`
        : `I logged ${money(parsed.amount)} as ${parsed.label}. Cash and week profit both went up. Good. What should this money be assigned to: debt, savings, or reinvestment?`;
    }
    const taskMatch = lower.match(/(?:remind me to|i need to|add task|task:|don.?t forget|add to.*list|note to self|need to remember|put.*on.*list|add.*reminder)\s+(.+)/i);
    if (taskMatch) {
      let title = taskMatch[1].replace(/\b(today|tomorrow|next week)\b/gi, "").trim();
      const due = /today/.test(lower) ? todayISO() : /tomorrow/.test(lower) ? new Date(Date.now() + 86400000).toISOString().slice(0, 10) : "none";
      addTask(title || "New task", due);
      return `Added: "${title || "New task"}". It’s on your list. Now execute the one you already have before adding more.`;
    }
    if (/\bgoals?\b/.test(lower)) {
      const top = goals.slice(0, 3).map(g => `• ${g.title}`).join("\n");
      return `Your current goals:\n${top}\n\nPick one. What single action moves it forward today?`;
    }
    if (/how am i doing|status update|give me a summary|how.?s everything|check in|overview/.test(lower)) {
      const unpaidLawn = lawnJobs.filter(j => j.paymentStatus === "unpaid" && j.status === "completed").reduce((s, j) => s + Number(j.price || 0), 0);
      const overdueCount = tasks.filter(t => !t.done && t.due && t.due !== "none" && t.due !== "today" && t.due < todayISO()).length;
      return `Here’s where you stand:\n• Cash: ${money(cash)}\n• Week profit: ${money(weekProfit)}\n• Total debt: ${money(totalDebt)}\n• Tasks overdue: ${overdueCount}\n• Lawn unpaid: ${money(unpaidLawn)}\n\n${weekProfit < 0 ? "Profit is negative — income is the priority." : overdueCount > 0 ? `${overdueCount} overdue tasks. Finish before you plan more.` : unpaidLawn > 0 ? `Collect ${money(unpaidLawn)} in unpaid lawn work.` : "Clean slate. Execute today’s list."}`;
    }
    if (/how.?s my money|finance.*summary|money.*situation|my finances/.test(lower)) {
      return `Financial snapshot:\n• Cash: ${money(cash)}\n• This week: ${money(weekProfit >= 0 ? weekProfit : 0)} in, ${money(outflow)} out\n• Net: ${money(weekProfit)}\n• Total debt: ${money(totalDebt)}\n\n${weekProfit < 0 ? "You’re spending more than you’re making. What’s one income move you can make today?" : "You’re profitable this week. Stack it toward debt or hold as cash."}`
    }
    if (/plan|what should i do|next step|what.*do today|where.*start/.test(lower)) {
      const topTask = todayTasks.find(t => !t.done);
      return `Here’s the move:\n1. ${topTask ? `Finish "${topTask.title}"` : "Add one clear task to your day"}\n2. Log any income or expense that happened\n3. Do one thing that moves your money up\n\nProfit: ${money(weekProfit)} · Cash: ${money(cash)} · Debt: ${money(totalDebt)}\n\nDon’t let the day stay vague.`;
    }
    return "Say what happened — money, a task, a lawn job, or just what’s on your mind. I’ll turn it into something useful.";
  };

  const context = { T, isDark: theme === "dark", theme, setTheme, cash, setCash, txns, setTxns, addTxn, debts, setDebts, totalDebt, debtPct, income, outflow, weekProfit, weekPct, rituals, setRituals, tasks, setTasks, addTask, todayTasks, upcomingTasks, noDateTasks, goals, setGoals, pillars, setPillars, resolvedPillars, ritualPct, journalHistory, setJournalHistory, todayJournal, mentorAction, showDailyBrief, dailyBriefText: todayBriefText, onDismissBrief: () => setDismissedBriefDate(todayISO()), showWeeklySummary, weeklySummaryData, onDismissSummary: () => setDismissedSummaryWeek(getWeekKey()), smartReminders, dismissedReminders, onDismissReminder: (id) => setDismissedReminders(p => [...p, id]), onClearDismissedReminders: () => setDismissedReminders([]), mentorNudges, dismissedNudges, onDismissNudge: (id) => setDismissedNudges(p => [...p, id]), activeReminderCount, notifPermission, onRequestNotif: requestNotif, onTestNotif: testNotif, lawnClients, setLawnClients, lawnJobs, setLawnJobs, lawnLeads, setLawnLeads, lawnWeeklyTarget, setLawnWeeklyTarget, clientComms, setClientComms, leadComms, setLeadComms, bizJournal, setBizJournal, bizProfile, setBizProfile, addComm, setTab };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: T.bg, color: T.text, colorScheme: theme === "dark" ? "dark" : "light", position: "absolute", inset: 0, maxWidth: 480, margin: "0 auto", overflow: "hidden" }}>
      <style>{FONTS}</style>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}.serif{font-family:'Instrument Serif',serif}.hs::-webkit-scrollbar{display:none}.hs{scrollbar-width:none}button,input,textarea,select{font-family:inherit}button{cursor:pointer;border:none;background:none;color:inherit;transition:transform .14s cubic-bezier(.34,1.56,.64,1),opacity .12s ease}button:active{transform:scale(0.93)!important;opacity:.8}input,textarea,select{outline:none;transition:border-color .18s ease}::selection{background:rgba(249,115,22,.22);color:inherit}@keyframes up{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes pulse{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-4px);opacity:1}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes glow{0%,100%{opacity:.7}50%{opacity:1}}.au{animation:up .38s cubic-bezier(.16,1,.3,1) both}`}</style>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ position: "absolute", top: "max(14px, env(safe-area-inset-top, 14px))", right: 16, zIndex: 30, width: 30, height: 30, borderRadius: 99, background: T.surface, border: `1px solid ${T.border}` }}>{theme === "dark" ? "☀" : "☾"}</button>
        <main style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflowY: "auto", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "calc(82px + env(safe-area-inset-bottom, 0px))" }} className="hs">
          {tab === "home" && <HomeScreen {...context} setTab={setTab} />}
          {tab === "mentor" && <MentorScreen {...context} msgs={msgs} setMsgs={setMsgs} />}
          {tab === "journal" && <JournalScreen {...context} />}
          {tab === "clarity" && <ClarityScreen {...context} />}
          {tab === "finance" && <FinanceScreen {...context} />}
          {tab === "notifications" && <NotificationsScreen {...context} />}
          {tab === "settings" && <SettingsScreen {...context} />}
          {tab === "lawn" && <LawnScreen {...context} />}
          {tab === "lawnreport" && <LawnReportScreen {...context} />}
        </main>
        {fabOpen && (
          <div onClick={() => setFabOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,.78)", backdropFilter: "blur(22px)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 90 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: "92%", maxWidth: 360 }}>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".2em", color: "rgba(255,255,255,.38)" }}>QUICK NAVIGATE</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[
                  { icon: "🏠", label: "Home", tab: "home", bg: "rgba(255,255,255,.07)" },
                  { icon: "✦", label: "Mentor", tab: "mentor", bg: "linear-gradient(135deg,rgba(249,115,22,.22),rgba(249,115,22,.08))", border: "rgba(249,115,22,.3)" },
                  { icon: "📓", label: "Journal", tab: "journal", bg: "rgba(255,255,255,.07)" },
                  { icon: "✂️", label: "Lawn", tab: "lawn", bg: "linear-gradient(135deg,rgba(16,185,129,.18),rgba(16,185,129,.06))", border: "rgba(16,185,129,.25)" },
                  { icon: "📊", label: "Lawn Report", tab: "lawnreport", bg: "rgba(255,255,255,.07)" },
                  { icon: "💰", label: "Money", tab: "finance", bg: "linear-gradient(135deg,rgba(59,130,246,.18),rgba(59,130,246,.06))", border: "rgba(59,130,246,.25)" },
                  { icon: "🎯", label: "Clarity", tab: "clarity", bg: "rgba(255,255,255,.07)" },
                  { icon: "🔔", label: activeReminderCount > 0 ? `Alerts (${activeReminderCount})` : "Reminders", tab: "notifications", bg: activeReminderCount > 0 ? "linear-gradient(135deg,rgba(239,68,68,.22),rgba(239,68,68,.08))" : "rgba(255,255,255,.07)", border: activeReminderCount > 0 ? "rgba(239,68,68,.3)" : undefined },
                  { icon: "⚙️", label: "Settings", tab: "settings", bg: "rgba(255,255,255,.07)" },
                ].map(({ icon, label, tab: t, bg, border }) => (
                  <button key={t} onClick={() => { setTab(t); setFabOpen(false); }} style={{ padding: "16px 10px 14px", borderRadius: 20, background: bg, border: `1px solid ${border || "rgba(255,255,255,.1)"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 26 }}>{icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.78)", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setFabOpen(false)} style={{ width: "100%", padding: "14px 0", borderRadius: 18, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.55)", fontWeight: 700, fontSize: 13 }}>Close</button>
            </div>
          </div>
        )}
        <BottomNav T={T} isDark={theme === "dark"} tab={tab} setTab={setTab} setFabOpen={setFabOpen} reminderCount={activeReminderCount} />
    </div>
  );
}

function HomeScreen({ T, isDark, cash, totalDebt, weekProfit, weekPct, todayTasks, setTab, tasks, setTasks, noDateTasks, showDailyBrief, dailyBriefText, onDismissBrief }) {
  const [newTask, setNewTask] = useState("");
  const add = () => { if (!newTask.trim()) return; setTasks(p => [{ id: Date.now(), title: newTask.trim(), due: todayISO(), done: false }, ...p]); setNewTask(""); };
  const toggleTask = (id) => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const doneCount = todayTasks.filter(t => t.done).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <div className="au">
      <div style={{ padding: "30px 22px 16px", background: `linear-gradient(160deg, rgba(249,115,22,.1) 0%, transparent 65%)` }}>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 3 }}>{greeting} 👋</div>
        <div className="serif" style={{ fontSize: 30, color: T.text, lineHeight: 1.15 }}>Your Kingdom</div>
      </div>
      {showDailyBrief && <div style={{ padding: "0 16px 10px" }}><DailyBriefBanner T={T} text={dailyBriefText} onDismiss={onDismissBrief} /></div>}
      <div style={{ padding: "0 16px 32px" }}>

        {/* Cash Hero Card */}
        <div style={{ borderRadius: 28, overflow: "hidden", marginBottom: 10, position: "relative", background: "repeating-linear-gradient(135deg, rgba(255,255,255,.018) 0px, rgba(255,255,255,.018) 1px, transparent 1px, transparent 24px), linear-gradient(145deg, #053d2f 0%, #065f46 52%, #0b7a62 100%)", padding: "22px 22px 20px", boxShadow: "0 22px 60px rgba(16,185,129,.28), 0 6px 20px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.15)" }}>
          <div style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 99, background: "rgba(255,255,255,.05)", filter: "blur(2px)" }} />
          <div style={{ position: "absolute", right: 18, bottom: -32, width: 100, height: 100, borderRadius: 99, background: "rgba(255,255,255,.035)" }} />
          <div style={{ position: "absolute", left: -20, bottom: -20, width: 80, height: 80, borderRadius: 99, background: "rgba(16,185,129,.18)", filter: "blur(20px)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 600, letterSpacing: ".06em" }}>💰 Cash on hand</div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: ".22em", color: "rgba(255,255,255,.22)" }}>KINGDOM</div>
          </div>
          <div className="serif" style={{ fontSize: 52, color: "#fff", lineHeight: 1, marginBottom: 14, letterSpacing: "-.02em", textShadow: "0 2px 16px rgba(0,0,0,.3)" }}>{money(cash)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.32)", letterSpacing: ".1em", fontWeight: 700 }}>AVAILABLE BALANCE</div>
            <div style={{ width: 34, height: 26, borderRadius: 5, background: "linear-gradient(135deg, #c8a84b, #f0d080, #c8a84b)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)", display: "grid", placeItems: "center" }}>
              <div style={{ width: 20, height: 14, borderRadius: 2, border: "1px solid rgba(180,140,30,.6)", background: "linear-gradient(135deg, rgba(255,210,80,.3), rgba(200,160,50,.2))" }} />
            </div>
          </div>
        </div>

        {/* Debt + week row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 9, marginBottom: 10 }}>
          <button onClick={() => setTab("finance")} style={{ padding: "17px 15px", borderRadius: 22, background: isDark ? "rgba(239,68,68,.11)" : "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.26)", textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 7 }}>💳 Total Debt</div>
            <div className="serif" style={{ fontSize: 28, color: "#ef4444", lineHeight: 1 }}>{money(totalDebt)}</div>
            <div style={{ fontSize: 10, color: "rgba(239,68,68,.5)", marginTop: 5 }}>Tap to manage →</div>
          </button>
          <div style={{ padding: "17px 14px", borderRadius: 22, background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 7, color: weekProfit >= 0 ? "#10b981" : "#ef4444" }}>{weekProfit >= 0 ? "📈" : "📉"} This Week</div>
            <div className="serif" style={{ fontSize: 28, color: weekProfit >= 0 ? "#10b981" : "#ef4444", lineHeight: 1 }}>{money(weekProfit)}</div>
            <div style={{ marginTop: 9, height: 4, borderRadius: 99, background: isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${weekPct}%`, background: weekProfit >= 0 ? "#10b981" : "#ef4444", borderRadius: 99, transition: "width .5s ease" }} />
            </div>
          </div>
        </div>

        {/* Tasks card */}
        <div style={{ marginBottom: 10, borderRadius: 24, background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: "hidden" }}>
          <div style={{ padding: "15px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 13, background: "rgba(249,115,22,.13)", display: "grid", placeItems: "center", fontSize: 19, flexShrink: 0 }}>✅</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Today's Tasks</div>
                <div style={{ fontSize: 11, color: T.muted }}>{doneCount} of {todayTasks.length} completed</div>
              </div>
            </div>
            <button onClick={() => setTab("clarity")} style={{ fontSize: 11, fontWeight: 800, color: T.accent, padding: "6px 12px", borderRadius: 10, background: T.accentSoft }}>All →</button>
          </div>
          <div style={{ padding: "0 13px 10px", display: "flex", gap: 7 }}>
            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Add a task..." style={{ flex: 1, padding: "10px 13px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12 }} />
            <button onClick={add} style={{ width: 40, height: 40, borderRadius: 14, background: T.accent, color: "#fff", fontWeight: 900, fontSize: 20, display: "grid", placeItems: "center" }}>+</button>
          </div>
          {todayTasks.length === 0 && <div style={{ padding: "6px 16px 16px", fontSize: 12, color: T.muted }}>Nothing due today. Add something above.</div>}
          {todayTasks.map((t, i) => (
            <button key={t.id} onClick={() => toggleTask(t.id)} style={{ width: "100%", display: "flex", gap: 12, alignItems: "center", padding: "13px 16px", textAlign: "left", background: t.done ? (isDark ? "rgba(16,185,129,.06)" : "rgba(16,185,129,.04)") : "transparent", borderTop: `1px solid ${T.borderSoft}`, transition: "background .2s" }}>
              <div style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${t.done ? "#10b981" : T.border}`, background: t.done ? "#10b981" : "transparent", display: "grid", placeItems: "center", flexShrink: 0, transition: "all .22s ease" }}>
                {t.done && <span style={{ color: "#fff", fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, color: t.done ? T.muted : T.text, textDecoration: t.done ? "line-through" : "none", flex: 1, transition: "all .2s" }}>{t.title}</span>
            </button>
          ))}
        </div>

        {/* Quick action tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {[
            { icon: "💵", label: "Log Money", sub: "Income or expense", t: "finance", bg: "linear-gradient(140deg, #064e3b, #065f46)", glow: "rgba(16,185,129,.28)" },
            { icon: "✂️", label: "Lawn Route", sub: "Today's cuts", t: "lawn", bg: "linear-gradient(140deg, #7c2d12, #9a3412)", glow: "rgba(249,115,22,.28)" },
          ].map(({ icon, label, sub, t, bg, glow }) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "20px 15px", borderRadius: 22, background: bg, boxShadow: `0 8px 24px ${glow}`, textAlign: "left" }}>
              <div style={{ fontSize: 28, marginBottom: 9 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.45)" }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MentorScreen({ T, isDark, msgs, setMsgs, mentorAction, cash, weekProfit, totalDebt, goals, mentorNudges, onDismissNudge }) {
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [msgs, typing]);
  const send = (text) => {
    if (!text.trim()) return;
    setMsgs(p => [...p, { id: Date.now(), from: "user", text: text.trim() }]);
    setInput("");
    setTyping(true);
    setTimeout(() => { const reply = mentorAction(text); setTyping(false); setMsgs(p => [...p, { id: Date.now() + 1, from: "ai", text: reply }]); }, 450);
  };
  const chips = ["Who is at churn risk?", "Who do I cut today?", "Projected revenue this month", "What revenue is at risk?", "Most valuable clients", "What leads need follow-up?"];
  const stats = [["💰", "Cash", money(cash), "#10b981"], ["📈", "Profit", money(weekProfit), weekProfit >= 0 ? "#10b981" : "#ef4444"], ["💳", "Debt", money(totalDebt), "#ef4444"]];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 14px", background: `linear-gradient(180deg, rgba(249,115,22,.14) 0%, ${T.bg} 100%)`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 16, background: "linear-gradient(135deg, #f97316, #c2410c)", display: "grid", placeItems: "center", fontSize: 22, boxShadow: "0 6px 18px rgba(249,115,22,.38)", flexShrink: 0 }}>✦</div>
          <div>
            <div className="serif" style={{ fontSize: 26, lineHeight: 1.1 }}>AI Mentor</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>Contextual · Accountable · Direct</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
          {stats.map(([icon, label, val, color]) => (
            <div key={label} style={{ padding: "10px 10px 9px", borderRadius: 16, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 9, color: T.muted, marginBottom: 2, fontWeight: 700, letterSpacing: ".05em" }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
        </div>
        {mentorNudges && mentorNudges.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {mentorNudges.map(n => (
              <div key={n.id} style={{ padding: "10px 12px", borderRadius: 13, background: "rgba(249,115,22,.09)", border: "1px solid rgba(249,115,22,.2)", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
                <div style={{ flex: 1, fontSize: 12, color: T.text, lineHeight: 1.55 }}>{n.message}</div>
                <button onClick={() => onDismissNudge(n.id)} style={{ fontSize: 16, color: T.muted, flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Messages */}
      <div ref={ref} className="hs" style={{ flex: 1, overflowY: "auto", padding: "12px 17px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map(m => (
          <div key={m.id} style={{ alignSelf: m.from === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
            {m.from === "ai" && <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 700 }}>✦ MENTOR</div>}
            <div style={{ padding: "12px 14px", borderRadius: m.from === "user" ? "18px 18px 5px 18px" : "5px 18px 18px 18px", background: m.from === "user" ? `linear-gradient(135deg, ${T.accent}22, ${T.accent}11)` : T.surface, border: `1px solid ${m.from === "user" ? T.accent + "55" : T.border}`, whiteSpace: "pre-line", fontSize: 13, lineHeight: 1.65, color: T.text }}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>✦ MENTOR</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: 99, background: T.accent, opacity: 0.6, animation: `pulse ${0.9 + i * 0.15}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}
      </div>
      {/* Quick chips */}
      <div style={{ padding: "0 17px 8px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }} className="hs">
        {chips.map(c => (
          <button key={c} onClick={() => send(c)} style={{ fontSize: 10, padding: "7px 12px", borderRadius: 99, whiteSpace: "nowrap", background: T.surface, border: `1px solid ${T.border}`, color: T.muted, fontWeight: 600 }}>{c}</button>
        ))}
      </div>
      {/* Input */}
      <div style={{ padding: "6px 17px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, padding: "6px 6px 6px 16px", borderRadius: 28, background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 2px 8px rgba(0,0,0,.12)" }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Tell the mentor what happened..." rows={1} style={{ flex: 1, resize: "none", background: "transparent", border: "none", color: T.text, fontSize: 13, padding: "7px 0", lineHeight: 1.4 }} />
          <button onClick={() => send(input)} style={{ width: 36, height: 36, borderRadius: 99, background: `linear-gradient(135deg, ${T.accent}, #c2410c)`, color: "#fff", fontWeight: 900, display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(249,115,22,.35)", flexShrink: 0 }}>➤</button>
        </div>
      </div>
    </div>
  );
}

function JournalScreen({ T, isDark, journalHistory, setJournalHistory, todayJournal, bizJournal, setBizJournal, lawnJobs, lawnClients, lawnLeads }) {
  const [mode, setMode] = useState("personal");
  const promptSet = useMemo(() => JOURNAL_PROMPTS.slice(0).sort((a, b) => a.localeCompare(b)).slice(0, 5), []);
  const [answers, setAnswers] = useState(Array(5).fill(""));
  const saveEntry = () => { const entry = { id: Date.now(), date: todayISO(), month: monthKey(todayISO()), prompts: promptSet, answers, summary: summarizeJournal(answers) }; setJournalHistory(prev => [entry, ...prev.filter(j => j.date !== todayISO())]); };
  const grouped = journalHistory.reduce((acc, j) => { acc[j.month] = acc[j.month] || []; acc[j.month].push(j); return acc; }, {});
  const BIZ_TYPES = [["daily_recap","Daily Recap"],["win","Win"],["lesson","Lesson"],["mistake","Mistake"],["client_note","Client Note"],["system","System Fix"]];
  const [bizType, setBizType] = useState("daily_recap");
  const [bizAnswers, setBizAnswers] = useState(["", "", ""]);
  const bizPrompts = useMemo(() => generateBizPrompts({ lawnJobs: lawnJobs || [], lawnClients: lawnClients || [], lawnLeads: lawnLeads || [] }), [lawnJobs, lawnClients, lawnLeads]);
  const todayBizEntry = (bizJournal || []).find(j => j.date === todayISO());
  const saveBizEntry = () => { const entry = { id: Date.now(), date: todayISO(), month: monthKey(todayISO()), entryType: bizType, prompts: bizPrompts.slice(0, 3), answers: bizAnswers, summary: summarizeJournal(bizAnswers) }; setBizJournal(prev => [entry, ...(prev || []).filter(j => j.date !== todayISO())]); };
  const bizGrouped = (bizJournal || []).reduce((acc, j) => { acc[j.month] = acc[j.month] || []; acc[j.month].push(j); return acc; }, {});
  return (
    <div className="au">
      <HeaderArt T={T} title="Journal" kicker="REFLECTION" />
      <div style={{ display: "flex", gap: 6, padding: "0 16px 12px" }}>
        {[["personal", "Personal"], ["business", "Business"]].map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: "7px 18px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: mode === m ? T.accent : T.surface, color: mode === m ? "#fff" : T.muted, border: `1px solid ${mode === m ? T.accent : T.border}` }}>{l}</button>
        ))}
      </div>
      <div style={{ padding: "0 16px 28px" }}>
        {mode === "personal" && (<>
          {todayJournal ? <Card T={T} style={{padding:18,marginBottom:10,textAlign:"center"}}><div style={{fontSize:28,marginBottom:6}}>✓</div><div className="serif" style={{fontSize:23}}>Today Complete</div><div style={{fontSize:12,color:T.muted,marginTop:6}}>Your journal is saved permanently. Tomorrow, the prompt box returns.</div><div style={{marginTop:12,fontSize:12,lineHeight:1.6,color:T.muted,textAlign:"left"}}>{todayJournal.summary}</div></Card> : <Card T={T} style={{padding:17,marginBottom:10}}><div style={{fontSize:9,fontWeight:800,letterSpacing:".14em",color:T.accent,marginBottom:10}}>TODAY'S QUESTIONS</div>{promptSet.map((q,i)=><div key={q} style={{marginBottom:12}}><div className="serif" style={{fontSize:18,marginBottom:6}}>{i+1}. {q}</div><textarea value={answers[i]} onChange={e=>setAnswers(a=>a.map((x,idx)=>idx===i?e.target.value:x))} rows={3} placeholder="Write freely..." style={{width:"100%",resize:"none",padding:11,borderRadius:13,border:`1px solid ${T.border}`,background:T.surface2,color:T.text,fontSize:13,lineHeight:1.5}}/></div>)}<button onClick={saveEntry} style={{width:"100%",padding:13,borderRadius:15,background:T.accent,color:"#fff",fontWeight:800}}>Save Today's Entry</button></Card>}
          <div style={{fontSize:9,fontWeight:800,letterSpacing:".14em",color:T.muted,margin:"12px 0 9px 2px"}}>ARCHIVE</div>
          {Object.keys(grouped).length ? Object.entries(grouped).map(([m,entries]) => <Card key={m} T={T} style={{padding:15,marginBottom:9}}><div className="serif" style={{fontSize:20,marginBottom:9}}>{m}</div>{entries.map(e=><div key={e.id} style={{padding:"9px 0",borderTop:`1px solid ${T.borderSoft}`}}><div style={{fontSize:12,fontWeight:800}}>{niceDate(new Date(`${e.date}T12:00:00`))}</div><div style={{fontSize:11,color:T.muted,lineHeight:1.5}}>{e.summary}</div></div>)}</Card>) : <div style={{fontSize:12,color:T.muted}}>No saved entries yet.</div>}
        </>)}
        {mode === "business" && (<>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }} className="hs">
            {BIZ_TYPES.map(([v, l]) => <button key={v} onClick={() => setBizType(v)} style={{ fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 99, whiteSpace: "nowrap", background: bizType === v ? T.accent : T.surface, color: bizType === v ? "#fff" : T.muted, border: `1px solid ${bizType === v ? T.accent : T.border}` }}>{l}</button>)}
          </div>
          {todayBizEntry ? (
            <Card T={T} style={{ padding: 18, marginBottom: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
              <div className="serif" style={{ fontSize: 22 }}>Business Entry Saved</div>
              <div style={{ fontSize: 11, color: T.accent, marginTop: 4 }}>{BIZ_TYPES.find(([v]) => v === todayBizEntry.entryType)?.[1] || "Entry"}</div>
              <div style={{ marginTop: 11, fontSize: 12, lineHeight: 1.6, color: T.muted, textAlign: "left" }}>{todayBizEntry.summary}</div>
              <button onClick={() => setBizJournal(prev => (prev || []).filter(j => j.date !== todayISO()))} style={{ marginTop: 11, fontSize: 11, color: T.accent, fontWeight: 700 }}>Edit today's entry</button>
            </Card>
          ) : (
            <Card T={T} style={{ padding: 17, marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.accent, marginBottom: 10 }}>BUSINESS REFLECTION</div>
              {bizPrompts.slice(0, 3).map((q, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div className="serif" style={{ fontSize: 17, marginBottom: 6 }}>{i + 1}. {q}</div>
                  <textarea value={bizAnswers[i]} onChange={e => setBizAnswers(a => a.map((x, idx) => idx === i ? e.target.value : x))} rows={3} placeholder="Write honestly..." style={{ width: "100%", resize: "none", padding: 11, borderRadius: 13, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 13, lineHeight: 1.5 }} />
                </div>
              ))}
              <button onClick={saveBizEntry} style={{ width: "100%", padding: 13, borderRadius: 15, background: T.accent, color: "#fff", fontWeight: 800 }}>Save Business Entry</button>
            </Card>
          )}
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, margin: "12px 0 9px 2px" }}>BUSINESS ARCHIVE</div>
          {Object.keys(bizGrouped).length ? Object.entries(bizGrouped).map(([m, entries]) => (
            <Card key={m} T={T} style={{ padding: 15, marginBottom: 9 }}>
              <div className="serif" style={{ fontSize: 20, marginBottom: 9 }}>{m}</div>
              {entries.map(e => (
                <div key={e.id} style={{ padding: "9px 0", borderTop: `1px solid ${T.borderSoft}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, marginBottom: 3 }}>
                    <span>{niceDate(new Date(`${e.date}T12:00:00`))}</span>
                    <span style={{ fontSize: 10, color: T.accent }}>{BIZ_TYPES.find(([v]) => v === e.entryType)?.[1] || "Entry"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{e.summary}</div>
                </div>
              ))}
            </Card>
          )) : <div style={{ fontSize: 12, color: T.muted }}>No business entries yet. Start reflecting on today's work.</div>}
        </>)}
      </div>
    </div>
  );
}

function ClarityScreen({ T, isDark, rituals, setRituals, tasks, setTasks, goals, setGoals, ritualPct, weekPct, debtPct }) {
  const [ritualDraft, setRitualDraft] = useState(RITUAL_PRESETS[0].name);
  const [customRitual, setCustomRitual] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [taskDue, setTaskDue] = useState("today");
  const addRitual = () => { const preset = RITUAL_PRESETS.find(r=>r.name===ritualDraft); const base = ritualDraft === "Custom" ? { name: customRitual || "Custom ritual", tag:"Custom", time:"Anytime" } : preset; if(!base) return; setRituals(p=>[{...base,id:Date.now(),doneDate:null},...p]); setCustomRitual(""); };
  const toggleRitual = (id) => setRituals(p=>p.map(r=>r.id===id?{...r,doneDate:r.doneDate===todayISO()?null:todayISO()}:r));
  const addTask = () => { if(!taskDraft.trim()) return; const due = taskDue === "today" ? todayISO() : taskDue === "tomorrow" ? new Date(Date.now()+86400000).toISOString().slice(0,10) : "none"; setTasks(p=>[{id:Date.now(),title:taskDraft.trim(),due,done:false},...p]); setTaskDraft(""); };
  const toggleTask = (id) => setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t));
  return <div className="au"><HeaderArt T={T} title="Clarity" kicker="SYSTEMS"/><div style={{padding:"0 16px 28px"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:9}}>{[["Rituals",ritualPct,"#f97316"],["Profit",weekPct,"#10b981"],["Debt",debtPct,"#a855f7"]].map(x=><Card key={x[0]} T={T} style={{padding:12,textAlign:"center"}}><Ring pct={x[1]} color={x[2]}><span style={{fontSize:11,fontWeight:800}}>{x[1]}%</span></Ring><div style={{fontSize:10,color:T.muted,marginTop:5}}>{x[0]}</div></Card>)}</div><Card T={T} style={{padding:15,marginBottom:9}}><div style={{fontSize:9,fontWeight:800,letterSpacing:".14em",color:T.muted,marginBottom:10}}>RITUALS</div><div style={{fontSize:11,color:T.muted,marginBottom:9}}>These are generated from presets by default. Edit/remove them here.</div><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:7,marginBottom:9}}><select value={ritualDraft} onChange={e=>setRitualDraft(e.target.value)} style={{padding:10,borderRadius:12,border:`1px solid ${T.border}`,background:T.surface2,color:T.text}}>{RITUAL_PRESETS.map(r=><option key={r.name}>{r.name}</option>)}<option>Custom</option></select><button onClick={addRitual} style={{padding:"0 12px",borderRadius:12,background:T.accent,color:"#fff",fontWeight:800}}>Add</button></div>{ritualDraft==="Custom"&&<input value={customRitual} onChange={e=>setCustomRitual(e.target.value)} placeholder="Custom ritual" style={{width:"100%",padding:10,borderRadius:12,border:`1px solid ${T.border}`,background:T.surface2,color:T.text,marginBottom:9}}/>}{rituals.map(r=><div key={r.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:9,alignItems:"center",padding:"8px 0",borderTop:`1px solid ${T.borderSoft}`}}><button onClick={()=>toggleRitual(r.id)} style={{width:22,height:22,borderRadius:99,border:`1px solid ${T.border}`,background:r.doneDate===todayISO()?T.accent:"transparent"}}>{r.doneDate===todayISO()?"✓":""}</button><div><input value={r.name} onChange={e=>setRituals(p=>p.map(x=>x.id===r.id?{...x,name:e.target.value}:x))} style={{width:"100%",background:"transparent",border:"none",color:T.text,fontSize:13}}/><div style={{fontSize:10,color:T.muted}}>{r.tag} · {r.time}</div></div><button onClick={()=>setRituals(p=>p.filter(x=>x.id!==r.id))} style={{fontSize:11,color:"#ef4444"}}>Remove</button></div>)}</Card><Card T={T} style={{padding:15,marginBottom:9}}><div style={{fontSize:9,fontWeight:800,letterSpacing:".14em",color:T.muted,marginBottom:10}}>TASKS / REMINDERS</div><div style={{display:"grid",gridTemplateColumns:"1fr 90px auto",gap:7,marginBottom:10}}><input value={taskDraft} onChange={e=>setTaskDraft(e.target.value)} placeholder="Clean car" style={{padding:10,borderRadius:12,border:`1px solid ${T.border}`,background:T.surface2,color:T.text}}/><select value={taskDue} onChange={e=>setTaskDue(e.target.value)} style={{padding:10,borderRadius:12,border:`1px solid ${T.border}`,background:T.surface2,color:T.text}}><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="none">No date</option></select><button onClick={addTask} style={{padding:"0 12px",borderRadius:12,background:T.accent,color:"#fff",fontWeight:800}}>Add</button></div>{tasks.map(t=><div key={t.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:9,alignItems:"center",padding:"8px 0",borderTop:`1px solid ${T.borderSoft}`}}><button onClick={()=>toggleTask(t.id)} style={{width:22,height:22,borderRadius:99,border:`1px solid ${T.border}`,background:t.done?T.accent:"transparent"}}>{t.done?"✓":""}</button><div style={{fontSize:13,textDecoration:t.done?"line-through":"none"}}>{t.title}<div style={{fontSize:10,color:T.muted}}>{t.due==="none"?"No due date":t.due}</div></div><button onClick={()=>setTasks(p=>p.filter(x=>x.id!==t.id))} style={{fontSize:11,color:"#ef4444"}}>Remove</button></div>)}</Card><Card T={T} style={{padding:15}}><div style={{fontSize:9,fontWeight:800,letterSpacing:".14em",color:T.muted,marginBottom:10}}>GOALS</div>{goals.map(g=><div key={g.id} style={{padding:"9px 0",borderTop:`1px solid ${T.borderSoft}`}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700}}><span>{g.title}</span><span style={{color:T.accent}}>{g.category}</span></div><div style={{height:4,background:isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)",borderRadius:9,overflow:"hidden",marginTop:6}}><div style={{height:"100%",width:`${clamp((g.current/g.target)*100)}%`,background:T.accent}}/></div></div>)}</Card></div></div>;
}

function FinanceScreen({ T, isDark, cash, txns, setTxns, addTxn, debts, setDebts, totalDebt, debtPct, income, outflow, weekProfit, weekPct }) {
  const [quick, setQuick] = useState("");
  const [drafts, setDrafts] = useState({});
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [debtDraft, setDebtDraft] = useState({ name: "", balance: "", original: "", apr: "" });

  const log = () => { const parsed = parseFinanceText(quick); if (!parsed) return; addTxn(parsed); setQuick(""); };

  const updateDebt = (id, action) => {
    const amount = Number(drafts[id] || 0);
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    if (action !== "interest" && amount <= 0) return;
    setDebts(p => p.map(d => {
      if (d.id !== id) return d;
      if (action === "pay") return { ...d, balance: Math.max(0, d.balance - amount), paid: d.paid + amount };
      if (action === "charge") return { ...d, balance: d.balance + amount, original: d.original + amount };
      const interest = Math.round(d.balance * (d.apr / 100 / 12) * 100) / 100;
      return { ...d, balance: d.balance + interest, original: d.original + interest };
    }));
    if (action === "pay") addTxn({ type: "out", amount, label: `${debt.name} payment`, category: "Debt", date: "Today" });
    if (action === "interest") addTxn({ type: "out", amount: Math.round(debt.balance * (debt.apr / 100 / 12) * 100) / 100, label: `${debt.name} interest`, category: "Debt", date: "Today" });
    setDrafts({ ...drafts, [id]: "" });
  };

  const addDebt = () => {
    if (!debtDraft.name.trim() || !debtDraft.balance) return;
    const balance = Number(debtDraft.balance) || 0;
    const original = Number(debtDraft.original) || balance;
    const apr = Number(debtDraft.apr) || 0;
    const COLORS = ["#ef4444", "#3b82f6", "#a855f7", "#f97316", "#eab308", "#10b981"];
    setDebts(p => [...p, { id: Date.now(), name: debtDraft.name.trim(), original, balance, paid: Math.max(0, original - balance), apr, color: COLORS[p.length % COLORS.length] }]);
    setDebtDraft({ name: "", balance: "", original: "", apr: "" });
    setShowAddDebt(false);
  };

  const iStyle = { width: "100%", padding: "10px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12, marginBottom: 7 };

  return (
    <div className="au">
      <HeaderArt T={T} title="Money" kicker="FINANCIAL CLARITY" />
      <div style={{ padding: "0 16px 28px" }}>
        <Card T={T} style={{ padding: 15, marginBottom: 9 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 9 }}>QUICK LOG</div>
          <div style={{ display: "flex", gap: 7 }}>
            <input value={quick} onChange={e => setQuick(e.target.value)} onPaste={e => setTimeout(() => { const v = e.target.value; const p = parseFinanceText(v); if (p) { addTxn(p); setQuick(""); } }, 0)} onKeyDown={e => e.key === "Enter" && log()} placeholder='"Made $800 mowing" or "Spent $60 gas"' style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12 }} />
            <button onClick={log} style={{ width: 38, borderRadius: 12, background: T.accent, color: "#fff", fontWeight: 900 }}>+</button>
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>Type naturally — "made $200", "paid $80 internet", "lost $500 gambling".</div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 9 }}>
          <Card T={T} style={{ padding: 14 }}><div style={{ fontSize: 10, color: T.muted }}>Week profit</div><div className="serif" style={{ fontSize: 24, color: weekProfit >= 0 ? "#10b981" : "#ef4444" }}>{money(weekProfit)}</div></Card>
          <Card T={T} style={{ padding: 14 }}><div style={{ fontSize: 10, color: T.muted }}>Cash on hand</div><div className="serif" style={{ fontSize: 24, color: "#10b981" }}>{money(cash)}</div></Card>
        </div>
        <Card T={T} style={{ padding: 16, marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, marginBottom: 3 }}>TOTAL DEBT</div>
              <div className="serif" style={{ fontSize: 26, color: "#ef4444" }}>{money(totalDebt)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setShowAddDebt(!showAddDebt)} style={{ fontSize: 12, fontWeight: 800, color: T.accent, padding: "6px 12px", borderRadius: 10, background: T.accentSoft, border: `1px solid rgba(249,115,22,.25)` }}>+ Add debt</button>
              <Ring pct={debtPct} color="#ef4444"><span style={{ fontSize: 11, fontWeight: 800 }}>{debtPct}%</span></Ring>
            </div>
          </div>
          {showAddDebt && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 16, background: T.surface2, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".13em", color: T.muted, marginBottom: 11 }}>NEW DEBT</div>
              <input value={debtDraft.name} onChange={e => setDebtDraft(p => ({ ...p, name: e.target.value }))} placeholder="Name — e.g. Chase Sapphire, Car Loan" style={iStyle} />
              <input value={debtDraft.balance} onChange={e => setDebtDraft(p => ({ ...p, balance: e.target.value }))} type="number" placeholder="Current balance ($)" style={iStyle} />
              <input value={debtDraft.original} onChange={e => setDebtDraft(p => ({ ...p, original: e.target.value }))} type="number" placeholder="Original balance ($ — for payoff %, optional)" style={iStyle} />
              <input value={debtDraft.apr} onChange={e => setDebtDraft(p => ({ ...p, apr: e.target.value }))} type="number" placeholder="APR % — e.g. 24.99" style={{ ...iStyle, marginBottom: 11 }} />
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={addDebt} style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: T.accent, color: "#fff", fontWeight: 800 }}>Save</button>
                <button onClick={() => setShowAddDebt(false)} style={{ padding: "11px 14px", borderRadius: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.muted, fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          )}
          {debts.length === 0 && !showAddDebt && (
            <div style={{ fontSize: 12, color: T.muted, paddingBottom: 4 }}>No debts added. Tap "Add debt" to start tracking what you owe.</div>
          )}
          {debts.map(d => (
            <div key={d.id} style={{ padding: "13px 0", borderTop: `1px solid ${T.borderSoft}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#ef4444" }}>{money(d.balance)}</span>
                  <button onClick={() => setDebts(p => p.filter(x => x.id !== d.id))} style={{ fontSize: 13, color: T.dim, padding: "0 2px" }}>✕</button>
                </div>
              </div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 9 }}>APR {d.apr}% · ~{money(d.balance * (d.apr / 100 / 12))}/mo interest</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6 }}>
                <input value={drafts[d.id] || ""} onChange={e => setDrafts({ ...drafts, [d.id]: e.target.value })} type="number" placeholder="Amount" style={{ padding: 9, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface2, color: T.text }} />
                <button onClick={() => updateDebt(d.id, "pay")} style={{ padding: "0 11px", borderRadius: 10, background: "rgba(16,185,129,.13)", color: "#10b981", fontWeight: 800 }}>Pay</button>
                <button onClick={() => updateDebt(d.id, "charge")} style={{ padding: "0 11px", borderRadius: 10, background: "rgba(239,68,68,.13)", color: "#ef4444", fontWeight: 800 }}>Charge</button>
              </div>
              <button onClick={() => updateDebt(d.id, "interest")} style={{ width: "100%", marginTop: 7, padding: 8, borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>Apply monthly interest</button>
            </div>
          ))}
        </Card>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", color: T.muted, margin: "0 0 9px 2px" }}>RECENT TRANSACTIONS</div>
        <Card T={T} style={{ padding: "0 15px" }}>
          {txns.length === 0 && <div style={{ fontSize: 12, color: T.muted, padding: "14px 0" }}>No transactions yet.</div>}
          {txns.slice(0, 10).map((t, i) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: i < Math.min(txns.length, 10) - 1 ? `1px solid ${T.borderSoft}` : "none" }}>
              <div><div style={{ fontSize: 13 }}>{t.label}</div><div style={{ fontSize: 10, color: T.muted }}>{t.category || (t.type === "in" ? "Income" : "Expense")} · {t.date}</div></div>
              <div style={{ fontSize: 13, fontWeight: 800, color: t.type === "in" ? "#10b981" : "#ef4444" }}>{t.type === "in" ? "+" : "−"}{money(t.amount)}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function BottomNav({ T, isDark, tab, setTab, setFabOpen, reminderCount }) {
  const items = [["home","🏠","Home"],["mentor","✦","Mentor"],null,["lawn","✂️","Lawn"],["finance","💰","Money"]];
  return (
    <div style={{ position: "absolute", left: 12, right: 12, bottom: "max(12px, env(safe-area-inset-bottom, 12px))", height: 62, borderRadius: 26, background: isDark ? "rgba(6,9,16,.88)" : "rgba(235,231,224,.92)", border: `1px solid ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.07)"}`, display: "flex", alignItems: "center", justifyContent: "space-around", backdropFilter: "blur(28px) saturate(1.8)", WebkitBackdropFilter: "blur(28px) saturate(1.8)", boxShadow: isDark ? "0 8px 32px rgba(0,0,0,.48), 0 1px 0 rgba(255,255,255,.06) inset" : "0 8px 24px rgba(0,0,0,.1), 0 1px 0 rgba(255,255,255,.9) inset" }}>
      {items.map((it, idx) => it === null ? (
        <button key="fab" onClick={() => setFabOpen(true)} style={{ position: "relative", width: 54, height: 54, borderRadius: 99, background: `linear-gradient(135deg, ${T.accent}, #c2410c)`, color: "#fff", fontSize: 26, fontWeight: 900, boxShadow: "0 6px 22px rgba(249,115,22,.48), 0 2px 8px rgba(0,0,0,.3)", display: "grid", placeItems: "center", marginTop: -14, flexShrink: 0 }}>
          {reminderCount > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 10, height: 10, borderRadius: 99, background: "#ef4444", border: `2px solid ${T.bg}` }} />}
          +
        </button>
      ) : (
        <button key={it[0]} onClick={() => setTab(it[0])} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: 60, paddingTop: 6, position: "relative" }}>
          <span style={{ fontSize: it[0] === "mentor" ? 15 : 20, filter: tab === it[0] ? "none" : "grayscale(1) opacity(0.45)" }}>{it[1]}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: tab === it[0] ? T.accent : T.muted }}>{it[2]}</span>
          {tab === it[0] && <span style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 18, height: 2.5, borderRadius: 99, background: T.accent }} />}
        </button>
      ))}
    </div>
  );
}
