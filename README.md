# Brand HQ

A free, custom, collaborative workspace for two founders building a clothing brand.
Live activity feed · tasks & timeline · file vault with versions · notes/brand bible · mood board · comments & voting.

Built with **React + Vite (PWA)** and **Supabase** (database, auth, file storage, realtime). Everything runs on free tiers.

---

## One-time setup (≈10 minutes)

### 1. Create a free Supabase project
1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Name it (e.g. `brand-hq`), set a database password, pick the nearest region. Free plan is fine.
3. Wait ~2 min for it to provision.

### 2. Create the database
1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   - This creates all tables, security rules, realtime, and the `files` + `moodboard` storage buckets.

### 3. Get your API keys
1. **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key.
3. In this project folder, copy `.env.example` to `.env` and paste them in:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhb....
   ```

### 4. Add the two founder logins
The app uses passwordless **magic-link** email login.
- **Authentication → Providers → Email**: make sure Email is enabled.
- For just the two of you, the simplest path: **Authentication → Users → Add user → "Send invitation"** for each of your emails. (Or just log in from the app — the magic link creates the account.)
- Under **Authentication → URL Configuration**, add your dev and prod URLs to **Redirect URLs**:
  - `http://localhost:5173`
  - (later) your deployed URL, e.g. `https://brand-hq.pages.dev`

### 5. Run it
```bash
npm install
npm run dev
```
Open http://localhost:5173, enter your email, click the magic link, you're in.

---

## Deploy for free (so you both can use it anywhere)
Push this folder to a GitHub repo, then connect it to **Cloudflare Pages**, **Vercel**, or **Netlify**:
- Build command: `npm run build`
- Output directory: `dist`
- Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the host's dashboard.
- Add the deployed URL to Supabase **Redirect URLs** (step 4).

### Keep Supabase from pausing
Free Supabase projects pause after ~7 days of inactivity. You'll likely stay active, but to be safe you can add a free scheduled ping (GitHub Actions cron) that hits the project weekly. Ask and I'll set it up.

---

## What's inside (v1)
| Area | What it does |
|------|--------------|
| **Feed** | Live activity stream + post async updates; react & comment |
| **Tasks** | Kanban board (To-do/Doing/Done) + milestones toward launch |
| **Files** | Upload PDFs/images, keep every version, "mark as final" |
| **Notes** | Living docs — manifesto, brand voice, ideas |
| **Mood board** | Inspiration images + links |

Next waves (planned): logo arena · supplier directory · drop planner. See [`REQUIREMENTS.md`](REQUIREMENTS.md).
