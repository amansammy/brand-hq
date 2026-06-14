# Brand HQ — v3 plan

**Theme:** stop being disconnected storage ("SharePoint"). Become a *connected, thinking* workspace.
**Principle:** storage → tool = **connection + workflow + synthesis**.
**Constraints:** strictly free (no AI), responsive, Supabase backend.

---

## Pillar 1 — Universal linking 🔗 (the spine)
Make everything relate to everything.

- New `links` table (polymorphic many-to-many): `from_type/from_id ↔ to_type/to_id`.
- **Tasks** get a "Link to…" picker → attach to a drop, garment, arena, file, note, or the
  Brand Bible (or leave standalone).
- **Reverse view everywhere:** each module detail shows its linked items
  (e.g. Logo Arena → "3 linked tasks · 1 open"; a drop → its tasks/files/mood refs).
- Linked items render as clickable chips on task cards and in the feed.
- Reusable `LinkPicker` component + a `links` helper.

## Pillar 2 — Logo Arena → a decision engine ⭐ (flagship module upgrade)
The first module to stop being a folder.

- **Compare mode** — select candidates, view them side-by-side, larger.
- **Vote transparency** — show *who* voted for each option (avatars), not just counts.
- **Lock winner → it propagates:**
  - the winning logo auto-appears in the **Brand Bible** (new `brand_bible.logo_url`),
  - a "Logo decided ✓" event posts to the feed,
  - the arena shows the resolved decision at the top.
- Linked tasks section (from Pillar 1).

## Pillar 3 — Home cockpit 🧭 (synthesis)
A new landing page that thinks for you (Feed moves to its own tab).

- Nearest **drop countdown** + progress.
- **"Needs you"** — your tasks that are overdue / due soon, with counts.
- **Open decisions** — arenas with no winner yet.
- **Brand Bible completeness** — nudges for what's missing (no palette, no tagline…).
- **Recent activity** — a compact feed peek.

---

## New data (high level)
- `links` (from_type, from_id, to_type, to_id, created_by)
- `brand_bible.logo_url`, `brand_bible.logo_path`
- No other new tables; Home is pure synthesis over existing data.

## Deferred to v4
- Notifications + phone push + @mentions (the "alive" layer)
- Deeper **Drops** cockpit (tech-pack, cost→margin, stage-driven checklists)
- Deeper **Brand Bible** (reusable palette tagging, export brand sheet)
- **Mood board** as a tool (boards, tags, color extraction)
- AI assistant
