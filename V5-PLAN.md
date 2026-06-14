# Brand HQ — v5 plan

**Theme:** stop being basic. Match best-in-class tools and make building the brand frictionless.
**Constraints:** free; AI image gen via Pollinations.ai (no key); responsive; Supabase backend.

---

## 1. 🎨 AI Design Studio (Pollinations.ai — free, no key)
A "Studio" page: prompt + type (logo / print / pattern / mood) + style → generates several images
(seed-varied). Each result can be: **sent to a Logo Arena**, **saved to a mood board**, or downloaded.
Generated images are copied into our storage for permanence.

## 2. ✅ Tasks → best-in-class
- **Calendar (month) view** alongside Board & List (the folded-in calendar).
- **Group by** drop / assignee / priority / label.
- **Dependencies** ("blocked by") with a visual marker.
- **Natural-language quick-add** ("design tee friday !high @aman") → parses date/priority/assignee.

## 3. 🖼️ Mood board → best-in-class
- **Multiple named boards** (one per concept/drop).
- **Freeform canvas** — drag images anywhere, resize; falls back to grid.
- **Color extraction** from any image → push swatches to the Brand Bible palette.
- **Paste-from-clipboard & drag-from-desktop** upload, **tags + filter**, **fullscreen lightbox**.

## 4. 🏭 Suppliers + Sample tracker (new module)
- **Suppliers**: name, kind (fabric/manufacturer/printer/trims), contact, location, MOQ, lead time,
  rating, link, notes.
- **Sample rounds**: per garment/supplier — status (requested → received → approved/rejected),
  round #, fit notes, photo.

## New data
- `boards`; moodboard_items += board_id, x, y, w, tags
- `suppliers`, `samples`
- tasks += depends_on (jsonb)

## Deferred (v6)
- Brand Playbooks (one-click templates), unified cross-app calendar + .ics,
  tech packs, content/launch planner, AI text Copilot.
