# Kingdom Builder — Session Resume

## What This App Is
A personal operating system for discipline, finance, lawn business management, AI mentorship, and self-improvement. Single-file React app (`src/App.jsx`). Vite + React 18. No routing library. All persistence via localStorage. Mobile-first dark luxury aesthetic.

---

## Completed Phases

### Phase 11 — Notifications + Smart Reminders
- `DailyBriefBanner` — dismissable banner on home screen with today's context
- `WeeklySummaryCard` — shows Monday morning weekly review card
- `NotificationsScreen` — filterable reminder center (tasks, money, lawn, leads)
- `SettingsScreen` — theme toggle + browser notification opt-in
- `generateSmartReminders()` — creates reminder items from live data
- `generateMentorNudges()` — proactive mentor messages based on state
- `generateDailyBrief()` — builds today's brief text

### Phase 12 — Lawn Business Data Layer
- `LawnScreen` with sub-tabs: Route, Clients, Leads, Invoices
- Client CRUD: add, schedule, pause, reactivate
- Job actions: complete, mark paid (auto-logs to Finance), skip, reschedule
- Lead pipeline: new → contacted → quote_sent → follow_up_needed → won/lost
- `convertToClient()` — promotes lead to active client
- Sample data: `DEFAULT_LAWN_CLIENTS`, `DEFAULT_LAWN_JOBS`, `DEFAULT_LAWN_LEADS`
- `calcNextCutDate()` helper for biweekly/weekly scheduling
- Lawn data wired into reminder engine and daily brief

### Phase 13 — Reporting + Business Dashboard + Mentor Lawn Commands
- `lawnReport()` — pure function computing week/month revenue, completion rate, paid rate, top clients, projected monthly, lead close rate, business insights
- `LawnReportScreen` — revenue tiles, weekly target + ring, jobs performance, best clients, lead pipeline close rate by source, unpaid invoice banner, insights list
- `lawnWeeklyTarget` — persisted, editable inline target
- `mentorAction` expanded with lawn commands: schedule, mark paid, mark done, add lead, set follow-up, convert to client, show unpaid, what's my revenue, who do I cut today, what leads need follow-up
- Lawn Report accessible from FAB menu

### Phase 14 — Communication History + Business Journal
- `CommLog` component — inline per-client and per-lead communication log with add form (method: text/call/in-person/email/note)
- `addComm(entityId, entityType, type, text, method, direction)` — adds comm entry, auto-updates `lastContacted` / `lastContactedDate`
- `generatePaymentRequest(client, job, profile)` — generates copy-ready payment text using business profile
- "Copy Pay Request" button on client cards with amount owed — copies + logs comm + updates lastContacted
- `BulkMessagingPanel` — "Messages" sub-tab in LawnScreen; select group (Unpaid/Route/All Clients/Active Leads/Follow-ups Due) + template (Payment Request/Follow-Up/Service Reminder); generates personalized copy per person; each copy logs comm + updates lastContacted
- Business Journal mode — toggle in JournalScreen (Personal/Business); business mode uses `generateBizPrompts()` for data-driven prompts, entry type selector (Daily Recap/Win/Lesson/Mistake/Client Note/System Fix), saved to `kingdom_biz_journal_v1`
- `generateBizPrompts()` — generates contextual prompts based on unpaid clients, lost/won leads, skipped jobs
- Contact frequency alerts added to `generateSmartReminders()`: 30+ day no-contact client alerts, 3+ day lead no-contact alerts
- Business Profile section added to SettingsScreen (businessName, ownerName, cashApp, venmo)
- Mentor communication commands: log contact, mark last contacted, show clients not contacted recently, write payment request, log note for client/lead, business lesson analysis

---

## Current Architecture

### File Structure
```
src/App.jsx          — entire app (~1,100 lines)
src/main.jsx         — React 18 entry point
index.html           — root HTML
vite.config.js       — Vite config
package.json         — React + Vite deps
```

### Key Patterns
- `usePersistedState(key, fallback)` — wraps useState + useEffect for localStorage sync
- `safeLoad(key, fallback)` / `save(key, value)` — localStorage helpers
- `getTheme(isDark)` → token object `T` with bg, surface, surface2, border, borderSoft, text, muted, dim, accent, accentSoft, shadow
- `Card`, `Ring`, `HeaderArt` — reusable components
- Bottom nav: Home / Mentor / [FAB+] / Lawn / Money — idx===2 is the FAB center button
- FAB menu: Ask mentor, Lawn, Lawn Report, Journal, Money, Clarity, Home, Reminders, Settings
- `context` object spread into all screens via `{...context}`

### localStorage Keys (complete list)
```
kingdom_theme
kingdom_cash_v3
kingdom_txns_v3
kingdom_debts_v3
kingdom_rituals_v3
kingdom_tasks_v3
kingdom_goals_v3
kingdom_pillars_v3
kingdom_journal_v3
kb_brief_dismissed
kb_summary_dismissed
kb_dismissed_reminders
kb_dismissed_nudges
kingdom_lawn_clients_v1
kingdom_lawn_jobs_v1
kingdom_lawn_leads_v1
kingdom_lawn_target_v1
kingdom_client_comms_v1
kingdom_lead_comms_v1
kingdom_biz_journal_v1
kingdom_biz_profile_v1
```

### Screens (tab names)
- `home` → HomeScreen
- `mentor` → MentorScreen
- `journal` → JournalScreen (Personal/Business toggle)
- `clarity` → ClarityScreen
- `finance` → FinanceScreen
- `notifications` → NotificationsScreen
- `settings` → SettingsScreen
- `lawn` → LawnScreen (Route/Clients/Leads/Invoices/Messages tabs)
- `lawnreport` → LawnReportScreen

### Context Object (all keys)
T, isDark, theme, setTheme, cash, setCash, txns, setTxns, addTxn, debts, setDebts, totalDebt, debtPct, income, outflow, weekProfit, weekPct, rituals, setRituals, tasks, setTasks, addTask, todayTasks, upcomingTasks, noDateTasks, goals, setGoals, pillars, setPillars, resolvedPillars, ritualPct, journalHistory, setJournalHistory, todayJournal, mentorAction, showDailyBrief, dailyBriefText, onDismissBrief, showWeeklySummary, weeklySummaryData, onDismissSummary, smartReminders, dismissedReminders, onDismissReminder, onClearDismissedReminders, mentorNudges, dismissedNudges, onDismissNudge, activeReminderCount, notifPermission, onRequestNotif, onTestNotif, lawnClients, setLawnClients, lawnJobs, setLawnJobs, lawnLeads, setLawnLeads, lawnWeeklyTarget, setLawnWeeklyTarget, clientComms, setClientComms, leadComms, setLeadComms, bizJournal, setBizJournal, bizProfile, setBizProfile, addComm, setTab

---

## Key Helper Functions (module-level)
- `generateDailyBrief({ tasks, txns, weekProfit, lawnJobs })`
- `generateSmartReminders({ tasks, txns, weekProfit, totalDebt, lawnJobs, lawnLeads, lawnClients })`
- `generateMentorNudges({ weekProfit, tasks, totalDebt, lawnJobs, lawnLeads })`
- `generateWeeklySummary({ income, outflow, weekProfit, tasks, totalDebt })`
- `lawnReport(jobs, clients, leads)` — returns full business report object
- `generateBizPrompts({ lawnJobs, lawnClients, lawnLeads })` — data-driven biz journal prompts
- `generatePaymentRequest(client, job, profile)` — copy-ready payment text
- `calcNextCutDate(fromDate, frequency)`
- `parseFinanceText(text)` — NLP finance parser for mentor
- `_d(offset)` — relative ISO date helper

---

## Important Rules
- Do NOT rewrite the entire app unless explicitly asked
- Make focused edits only — use Edit tool with exact string anchors
- Preserve localStorage persistence (never change existing key names)
- Preserve dark luxury zen aesthetic
- Preserve mobile-first design (393×852 phone frame)
- All screens receive props via `{...context}` spread
- `mentorAction` is a closure inside `KingdomOS` — it has access to all state vars
- Read App.jsx before any major edit to verify current anchor text

---

## Phase 15 Recommendation
Revenue Forecasting + Client Retention Intelligence:
- Detect clients whose cut frequency is slipping
- Revenue trend visualization on Home screen
- Client lifetime value calculation
- Churn risk scoring
- "Retention Alert" when a client hasn't booked in longer than their usual frequency
