# Shared Workflow — Brand HQ

A custom, free, collaborative workspace for two founders building a clothing brand.
One shared "HQ" to plan, decide, store files, and keep momentum — async-friendly,
works on phone and laptop.

## Goals
- Make collaborating easier and faster (stop losing momentum / things in scattered chats).
- Single source of truth for the brand: tasks, files, notes, decisions.
- Custom-built and owned by us (not an off-the-shelf tool).
- **Zero cost** — free hosting and services only.

## Users
- 2 founders. Simple login (email magic link). Both have full access.

## Platforms
- Responsive web app, built as a **PWA** (installable on phone home screen).
- Must work well on both phone and laptop.

## Tech stack (all free tiers)
- **Frontend:** React + Vite, PWA.
- **Backend / DB / Auth / Storage / Realtime:** Supabase (free tier).
- **Hosting:** Cloudflare Pages / Vercel / Netlify (deploy from GitHub).
- **Keep-alive:** free GitHub Actions cron pings Supabase weekly so the project never pauses.
- **Oversized files:** store a Google Drive link instead of uploading raw (1GB storage cap).

### Known free-tier constraints (accepted)
- Supabase pauses after ~7 days total inactivity → mitigated by weekly cron ping.
- 1GB file storage → mitigated by Drive links for large design files.

## v1 scope (LOCKED — build first)
1. **Activity feed (live)** — central home screen; every action flows here in realtime.
2. **Tasks & timeline** — board (To-do / Doing / Done), assignees, due dates, milestones toward a launch date.
3. **File vault with versions** — upload PDFs/images, keep version history, "mark as final" (covers the manifesto workflow).
4. **Notes / brand bible** — living docs incl. the manifesto text.
5. **Mood board** — inspiration images + links.
6. **Comments + voting on any item** — gives the feed substance; foundation for the logo arena.

## Next waves (priority order)
- **Wave 2:** Logo arena (upload iterations, vote, approve a winner).
- **Wave 3:** Supplier directory (contacts, MOQ, lead time, rating).
- **Wave 4:** Drop planner (collection/drop with pieces, theme, launch date).
- **Later / backlog:** Budget tracker, cost & pricing calculator, garment pipeline,
  fabric & trims library, tech packs / size charts, sample tracker, lookbook &
  photoshoot planner, content calendar, launch checklist, name lab.

## Out of scope (for now)
- In-app PDF editing (we upload/version PDFs, not edit them in-app).
- More than 2 users / roles & permissions.
- Anything that costs money.
