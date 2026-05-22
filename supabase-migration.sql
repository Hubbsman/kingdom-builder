-- ─────────────────────────────────────────────────────────────────────────────
-- Categories Feature — run this first
-- ─────────────────────────────────────────────────────────────────────────────

alter table money_entries add column if not exists category text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Mentor Feature — Supabase Migration
-- Run this in your Supabase project: SQL Editor → New query → paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Chat messages
create table if not exists mentor_messages (
  id          uuid primary key default gen_random_uuid(),
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  created_at  timestamptz default now()
);

-- 2. Long-term memory
create table if not exists mentor_memory (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in (
    'profile', 'current_goal', 'habit_pattern', 'reminder', 'task',
    'preference', 'struggle', 'win', 'schedule', 'long_term_plan'
  )),
  content      text not null,
  importance   int not null default 3 check (importance between 1 and 5),
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  last_used_at timestamptz default now()
);

-- 3. Daily state tracking
create table if not exists daily_state (
  id                  uuid primary key default gen_random_uuid(),
  date                date not null unique,
  mood                int check (mood between 1 and 10),
  energy              int check (energy between 1 and 10),
  prayer_completed    boolean default false,
  workout_completed   boolean default false,
  smoked_today        boolean default false,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- 4. Conversation summaries
create table if not exists mentor_summaries (
  id         uuid primary key default gen_random_uuid(),
  summary    text not null,
  created_at timestamptz default now()
);

-- ─── Seed Austin's base profile into memory ──────────────────────────────────
-- Run this once after creating the tables.
-- Feel free to edit/extend.

insert into mentor_memory (category, content, importance) values
  ('profile',        'Austin. Works Sun/Mon/Tue ~3-4 PM, off Wed/Thu, works Fri/Sat.', 5),
  ('schedule',       'Church Wednesday 7:30 PM. Jiu-jitsu Thursday 6:30 PM.', 5),
  ('profile',        'Likes rock climbing — 1hr drive + 1hr climb. Likes working out.', 4),
  ('profile',        'Usually goes to bed late, around 1–2 AM.', 3),
  ('struggle',       'Smokes sometimes even when he doesn''t want to.', 4),
  ('habit_pattern',  'Needs to pray more consistently. Should be asked daily.', 5),
  ('preference',     'Likes colognes, thrifting, Burlington, Goodwill, saving money, self-improvement, fitness, building apps, new experiences.', 3),
  ('current_goal',   'Build and improve his app (Kingdom Builder).', 5),
  ('current_goal',   'Save money and pay down debts.', 5),
  ('long_term_plan', 'Possibly move to Florida by September for new environment, independence, sunlight, outdoor life, personal reinvention.', 5),
  ('profile',        'Values adventure, unique days, not repeating the same comfort loops.', 4);
