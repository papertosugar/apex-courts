# Apex Courts — Supabase + Vercel Setup Guide

---

## Step 1 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name: `apex-courts`
3. Region: pick closest to your users (e.g. Southeast Asia)
4. Generate a strong DB password → save it

---

## Step 2 — Run SQL (in order)

In **Supabase Dashboard → SQL Editor → New Query**, run each file:

```
1. supabase/schema.sql    ← tables, views, triggers
2. supabase/rls.sql       ← Row Level Security policies
3. supabase/seed.sql      ← courts + sample data
```

---

## Step 3 — Create Auth Users (Staff Accounts)

In **Supabase Dashboard → Authentication → Users → Add User**:

| Email           | Password   | Role      |
|-----------------|------------|-----------|
| admin@apex.com  | admin123   | admin     |
| pos@apex.com    | pos123     | pos_staff |

After creating, update their roles:
```sql
UPDATE public.profiles SET role = 'admin'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@apex.com');

UPDATE public.profiles SET role = 'pos_staff'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'pos@apex.com');
```

---

## Step 4 — Get API Keys

**Supabase Dashboard → Settings → API**

Copy:
- `Project URL` → e.g. `https://abcdefgh.supabase.co`
- `anon public key` → long JWT string starting with `eyJ...`

---

## Step 5 — Supabase Storage Bucket

**Supabase Dashboard → Storage → New Bucket**

- Name: `community`
- Public: ✅ (so post photos are publicly readable)

---

## Step 6 — Deploy to Vercel

### Option A: Vercel CLI (recommended)
```bash
npm i -g vercel
cd /path/to/apex-courts
vercel login
vercel --prod
```

When prompted for environment variables, add:
```
SUPABASE_URL       = https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY  = eyJhbGci...
```

### Option B: Vercel Dashboard
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import repo
3. Framework: **Other**
4. Root Directory: `/` (or wherever `index.html` lives)
5. Environment Variables → add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
6. Deploy

---

## Step 7 — Add Supabase Client to HTML Pages

Add these two lines to the `<head>` of **every HTML page** that needs the database:

```html
<!-- Supabase JS client (CDN) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- Env vars injected by Vercel (create this file or use Edge Config) -->
<script>
  window.__ENV__ = {
    SUPABASE_URL:      "https://YOUR_PROJECT.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGci..."
  };
</script>

<!-- Apex Courts Supabase client -->
<script src="/js/supabase-client.js"></script>
```

> **Security note:** The `anon` key is safe to expose in the browser.
> Supabase RLS policies protect your data, not the key.

---

## Step 8 — Wire Up Pages

Each page needs its `localStorage` calls replaced with `ApexCourts.*` functions:

### index.html — Availability Grid
```js
// Old (localStorage)
function getDaySlots(sport) { ... reads apexBookings ... }

// New (Supabase)
async function renderAvailability(sport) {
  const date = new Date().toISOString().split('T')[0];
  const bookings = await ApexCourts.getAvailability(sport, date);
  // ...render grid using bookings array
}

// Real-time updates
ApexCourts.subscribeAvailability('pickleball', today, () => renderAvailability('pickleball'));
```

### book.html — Create Booking
```js
// Old
saveBooking({ court, date, time, ... });

// New
await ApexCourts.createBooking({
  courtId: selectedCourtId,
  date:    selectedDate,
  startTime: selectedTime,
  endTime:   computedEndTime,
  durationMins: 60,
});
```

### openplay.html — Sessions
```js
// Old
const sessions = JSON.parse(localStorage.getItem('apexOpenPlay'));

// New
const sessions = await ApexCourts.getOpenPlaySessions();
```

### login.html — Auth
```js
// Old
const accounts = JSON.parse(localStorage.getItem('apexAccounts'));
const match = accounts.find(a => a.contact === email && a.password === password);

// New
await ApexCourts.signIn(email, password);
const user = await ApexCourts.getCurrentUser();
```

---

## Database Schema Overview

```
profiles              ← extends auth.users (name, phone, role)
courts                ← 9 courts (4 PB + 4 BD + 1 DZ)
bookings              ← all court reservations → drives availability grid
open_play_sessions    ← weekend open play events
open_play_registrations ← who signed up for each session
news                  ← admin-published announcements
community_posts       ← member reviews + photos
post_likes            ← per-user likes (denormalized counter)
activity_log          ← POS audit trail
```

### Key Views
| View | Used by |
|------|---------|
| `v_court_availability` | Availability grid (index.html) |
| `v_open_play` | Open play sessions with count |
| `v_community_posts` | Posts with author names |

---

## Scheduled Jobs (Supabase Edge Functions)

Create a scheduled Edge Function to run daily:
```sql
-- closes past sessions + purges 30-day-old closed sessions
SELECT public.close_past_sessions();
SELECT public.purge_old_sessions();
```

In **Supabase Dashboard → Edge Functions → Schedule**:
- Cron: `0 3 * * *`  (3 AM daily)
- Function body: calls the two SQL functions above

---

## Local Development

For local testing without Vercel:
1. Edit `js/supabase-client.js` lines 16-17 with your real URL + key
2. Open `index.html` directly in browser
3. The Supabase client works directly from `file://` or any local server
