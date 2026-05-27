# Loyalty Program App

A mobile-first loyalty stamp app: clients collect stamps across 5 categories, earn a free item when they fill a category, and only that category resets.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth, Postgres, RLS, Realtime) · Framer Motion · QR generation (`qrcode.react`) · QR scanning (`@zxing/browser`).

---

## 1. Folder structure

```
loyalty-app/
├─ package.json
├─ next.config.js
├─ tailwind.config.ts
├─ postcss.config.js
├─ tsconfig.json
├─ .env.local.example
├─ .gitignore
├─ supabase/
│  └─ schema.sql                  ← run this in Supabase SQL editor
└─ src/
   ├─ middleware.ts               ← refreshes Supabase session
   ├─ types/
   │  └─ index.ts
   ├─ lib/
   │  ├─ auth.ts                  ← getCurrentProfile, requireRole, homeForRole
   │  └─ supabase/
   │     ├─ client.ts             ← browser client
   │     └─ server.ts             ← server + admin clients
   ├─ components/
   │  ├─ AppShell.tsx
   │  ├─ StampRow.tsx             ← animated stamp dots
   │  ├─ RewardCelebration.tsx    ← confetti + modal
   │  ├─ Toast.tsx
   │  └─ QrScanner.tsx
   └─ app/
      ├─ globals.css
      ├─ layout.tsx
      ├─ page.tsx                 ← redirects by role
      ├─ login/{page.tsx, LoginForm.tsx}
      ├─ register/{page.tsx, RegisterForm.tsx}
      ├─ dashboard/{page.tsx, ClientDashboard.tsx}   ← client view
      ├─ staff/{page.tsx, StaffConsole.tsx}          ← staff view
      ├─ admin/{page.tsx, AdminDashboard.tsx}        ← master admin view
      └─ api/
         ├─ stamp/add/route.ts
         ├─ reward/redeem/route.ts
         └─ client/search/route.ts
```

---

## 2. Set up Supabase

1. Go to https://supabase.com and create a new project. Pick a strong DB password.
2. Once provisioned, open **Project Settings → API**. Copy:
   - `Project URL`     → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)
3. Open the **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and run it. This creates:
   - All five tables (`profiles`, `loyalty_categories`, `client_stamps`, `rewards`, `stamp_transactions`)
   - Seed loyalty categories (Sandwiches, Main Course, Desserts, Coffee, Desserts 2)
   - Trigger that auto-creates a profile + 5 stamp rows whenever a user signs up
   - `add_stamp(...)`, `redeem_reward(...)`, `search_clients(...)` SQL functions (atomic + role-checked)
   - All RLS policies
4. **Realtime:** Go to **Database → Replication**, find the `public` publication, and ensure these tables are enabled: `client_stamps`, `rewards`. (They power the live updates on the client dashboard.)
5. **Email confirmation (optional):** for fast local testing, go to **Authentication → Providers → Email** and turn **"Confirm email"** OFF. You can re-enable it before going live.

---

## 3. Local setup

```bash
# 1. Install
npm install

# 2. Environment variables
cp .env.local.example .env.local
# Then edit .env.local with the values from step 2 above.

# 3. Run
npm run dev
# Visit http://localhost:3000
```

You should land on `/login`. Click **"Create an account"** to register your first user as a client.

### Promote your first admin

Right after creating your first account, you need to mark it as `master_admin` so you can access `/admin`. In the **Supabase SQL Editor**, run:

```sql
update public.profiles set role = 'master_admin' where email = 'YOUR_EMAIL_HERE';
```

Then sign out and sign back in. You will be redirected to `/admin`. From there you can promote other users to `staff` via the Users tab.

---

## 4. Test the loyalty flow

1. Sign up a second account (a "client") in an incognito window. Note their member ID on the dashboard (e.g. `CLT-7F3K9A`).
2. In the original window (admin), promote a third account to `staff`. Or just use the admin account itself — `master_admin` can do everything staff can.
3. Sign in as staff and open `/staff`. Search the client by name/phone/member ID, or use the **Scan QR** button to scan the client's QR code from the other phone.
4. Pick a category and tap **Add stamp** four times. Each tap streams a stamp animation + toast to the client's open dashboard via Supabase Realtime.
5. The 5th tap triggers `add_stamp` → reward creation → category reset. The client sees the **confetti celebration** instantly.
6. Tap **Redeem** on the staff console to mark the reward as redeemed (and log the transaction).
7. Check `/admin` for live counts and the activity log.

---

## 5. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Loyalty Program App MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/loyalty-app.git
git push -u origin main
```

---

## 6. Deploy to Vercel

1. Go to https://vercel.com → **New Project** → import your GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. **Environment Variables** — add all three from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**.
5. After the first deploy, copy the production URL (e.g. `https://loyalty-app.vercel.app`) and add it to Supabase:
   - **Authentication → URL Configuration → Site URL** → set to your Vercel URL.
   - **Redirect URLs** → add the Vercel URL.

---

## 7. How the loyalty rule is enforced

All stamp logic runs inside the `add_stamp` Postgres function (security definer):

- Row locked with `FOR UPDATE` so concurrent staff requests can't double-stamp.
- If `stamp_count + 1 < 5`: increment + log `add_stamp` transaction.
- If `stamp_count + 1 == 5`: log `add_stamp` → create `rewards` row (`status='available'`) → log `reward_earned` → reset `stamp_count` to 0. **Only that one category resets.** Returns `{ reward_earned: true, reward: {...} }`.

Same atomic guarantee for `redeem_reward`: status flipped from `available` → `redeemed`, with `redeemed_at` + `redeemed_by` recorded, and a `reward_redeemed` transaction logged.

The client receives all updates over Supabase Realtime, with:
- A stamp pop animation when `client_stamps` is updated
- A confetti celebration when a new `rewards` row is inserted

---

## 8. Roles & permissions (RLS summary)

| Action | Client | Staff | Master Admin |
|---|---|---|---|
| Read own profile / stamps / rewards | ✅ | ✅ | ✅ |
| Read other clients | ❌ | ✅ | ✅ |
| Add a stamp | ❌ | ✅ (via RPC) | ✅ (via RPC) |
| Redeem a reward | ❌ | ✅ (via RPC) | ✅ (via RPC) |
| Change roles | ❌ | ❌ | ✅ |
| Manage categories | ❌ | ❌ | ✅ |

Self-update on `profiles` is allowed but blocks role escalation (the policy `with check` clause pins the role to its current value).

---

## 9. Useful commands

```bash
npm run dev          # local development
npm run type-check   # tsc --noEmit
npm run lint
npm run build        # production build
npm run start        # serve the production build locally
```
