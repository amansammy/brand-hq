# Brand HQ — v4 plan

**Theme:** close the obvious gaps (notifications, money) and add delightful free-API touches.
**Constraints:** free; responsive; Supabase backend; no public/data-leaving pages this round.

---

## Pillar 1 — The Alive layer
- **Notifications**: a `notifications` table + a **bell** (sidebar + mobile header) with unread badge,
  realtime, mark-read, click-to-navigate.
- **@mentions**: mention autocomplete in the feed composer + comments; mentioning someone
  notifies them; mentions render highlighted.
- **Event notifications**: task assigned to you, someone comments on your item, a winner is picked.
- **Browser notifications**: when the recipient has the app open, fire a native Notification (free,
  no server). *True closed-app push needs a Supabase Edge Function — offered as a follow-up.*
- **Global search**: one overlay (search icon + Cmd/Ctrl-K) across tasks, notes, files, drops, arenas.
- **Profile settings**: finally set your display name + avatar.

## Pillar 2 — Money
- **Budget**: expenses (amount, category, who-paid, date, note), category **allocations**
  (budgeted vs spent), and a **balance** ("A owes B ₹X" from the 50/50 split).
- **Cost & pricing calculator**: fabric + labour + trims + shipping → unit cost → margin% → retail;
  optionally write the result back to a garment's price.

## Pillar 3 — Smart free-API touches
- **Unsplash search** in the Mood board (free demo tier; needs a free access key in env — gated).
- **Google Fonts picker** in the Brand Bible (curated list, live preview, no key needed to load fonts).
- **Rich link previews**: pasted mood-board links become cards with title + image (microlink.io free tier).

---

## New data
- `notifications` (user_id, actor, type, body, link, entity_type/id, read)
- `expenses` (title, amount, category, paid_by, spent_on, note)
- `budget_allocations` (category, amount)
- `moodboard_items.title`, `moodboard_items.preview_image` (for link previews)
- avatars reuse the public `brand` bucket

## Notes / caveats
- iOS background push only works for an installed PWA (iOS 16.4+); in-app bell works everywhere.
- Unsplash needs a free Access Key (`VITE_UNSPLASH_KEY`); the feature hides itself if absent.
