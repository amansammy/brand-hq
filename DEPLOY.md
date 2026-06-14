# Deploying Brand HQ (free) so both founders can use it

Your Supabase backend is already in the cloud. You only need to host the frontend once.
Recommended: **GitHub + Vercel** (free, auto-deploys every time we improve the app).

## 1. Put the code on GitHub
1. Go to [github.com/new](https://github.com/new), create a **private** repo named `brand-hq`.
   - Do **not** add a README/.gitignore (we already have them).
2. Copy the repo URL it shows you, then in this project folder run (in your terminal):
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/brand-hq.git
   git branch -M main
   git push -u origin main
   ```
   (A GitHub login window may pop up the first time — approve it.)

## 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → sign up **with GitHub** (free Hobby plan).
2. **Add New… → Project → Import** your `brand-hq` repo.
3. Vercel auto-detects Vite. Before clicking Deploy, open **Environment Variables** and add the two
   from your local `.env`:
   - `VITE_SUPABASE_URL` = `https://otejgtifkbspdqsmvbrr.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (your anon public key)
4. Click **Deploy**. In ~1 min you get a URL like `https://brand-hq.vercel.app`.

## 3. Tell Supabase about the new URL (so login works there)
In the Supabase dashboard → **Authentication → URL Configuration**:
- Set **Site URL** to your Vercel URL (e.g. `https://brand-hq.vercel.app`).
- Add the Vercel URL to **Redirect URLs** as well.

## 4. Your friend joins
- Send them the Vercel URL.
- They open it → enter their email → click the magic link → they're in the same space.
- (Both of you now share one live workspace.)

## Updating the app later
Whenever we change the code, just:
```bash
git add -A && git commit -m "what changed" && git push
```
Vercel rebuilds and redeploys automatically in ~1 minute.
