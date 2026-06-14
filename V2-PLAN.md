# Brand HQ — v2 plan

**Theme:** stop being a generic file locker; become a clothing-brand HQ.
**Scope:** three brand-specific modules + the navigation/structure changes to hold them.
**Constraints carried over:** strictly free (no AI in v2), responsive (phone + laptop), Supabase backend.

---

## Module 1 — Drop / Collection Planner ⭐ (centerpiece)
The spine of the whole brand. Plan collections and the garments inside them.

- **Collections list** — each collection has: name, season/theme, launch date (with countdown),
  status (Planning / In production / Launched), cover image.
- **Collection detail** — progress bar, launch countdown, and a grid/board of its garments.
- **Garments (pieces)** — each has: name, category (tee, hoodie, pants…), status pipeline
  **Idea → Sketch → Sample → Approved → Production → Done**, a sketch/photo, notes,
  optional target price.
- **Pipeline view** — see all garments in a collection by stage (kanban-style).
- Every change logs to the activity feed; garments support comments.

*Deferred to v3:* linking tasks/files directly to a garment, per-garment cost/margin.

## Module 2 — Logo Arena
Decide branding visually, together.

- **Arenas** — create a board (e.g. "Logo", "Packaging", "Label"). Each holds candidates.
- **Candidates** — upload an image + label + short rationale.
- **Voting** — you each vote (reuses the reactions system); counts shown live.
- **Lock a winner** — mark the chosen candidate; it gets a trophy and rises to the top.
- Comments per candidate (reuses the discussion component).

## Module 3 — Brand Bible
The single source of brand truth — structured, not a freeform note.

- **Manifesto / mission** — the finalized statement (plain multiline for v2).
- **Voice & tone** — do's and don'ts lists.
- **Color palette** — named swatches with hex (+ optional fabric/Pantone code).
- **Typography** — font names + usage notes.
- **Tagline bank** — candidate taglines.
- Optional: pull the winning logo from the Logo Arena.
- Autosaves; edits log to the feed.

---

## Structural changes needed to hold v2
Adding 3 modules means 8 areas total — the current flat nav won't fit, especially on mobile.

- **Desktop sidebar** — grouped into sections:
  - **Build:** Feed · Drops · Tasks · Files · Notes
  - **Brand:** Brand Bible · Logo Arena · Mood
- **Mobile** — bottom bar keeps 4 primary (Feed · Drops · Tasks · Brand) + a **"More"** sheet
  for the rest.

## New data (high level — not built yet)
`collections`, `garments`, `arenas`, `arena_candidates`, `brand_bible` (sections),
`palette_colors`. All under the same simple "any logged-in founder can read/write" rules,
all realtime, reusing the existing comments/reactions/activity tables.

---

## Explicitly NOT in v2 (→ v3 candidates)
- Budget & cost/margin calculator
- Notifications, @mentions, presence, Home dashboard ("feeling alive" pillar)
- Rich-text + real-time co-editing of notes
- In-app PDF/image preview, file folders/tags
- Supplier directory + sample tracker
- AI brand assistant
