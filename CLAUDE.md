# Kingdom Builder — Claude Instructions

## What This App Is

A simple manual balance tracker. The user enters an amount and an optional note, then taps Add or Subtract. The app records every transaction to Supabase and displays the running balance plus a full entry log.

That's it. Nothing else.

---

## Stack

- React 18 + Vite
- Supabase (`money_entries` table) — anon key is hardcoded in `App.jsx`
- vite-plugin-pwa

---

## Design

- Dark luxury aesthetic — `#0f0f0f` background, `#1a1a1a` surfaces
- Mobile-first, max-width 480px centered card
- Inter / Segoe UI font
- Green `#6bffb8` for positive amounts, red `#ff6b6b` for negative
- No clutter, no gradients, no neon

---

## Editing Rules

- Do NOT add screens, tabs, navigation, or new features unless explicitly asked
- Make focused edits only
- Preserve Supabase persistence (do not change table name or column names)
- Preserve the visual style
- Read `App.jsx` before editing to verify exact anchor text
