# 🎓 UniSchedule: University Class Reschedule Portal

A modern, responsive web portal for university department coordinators and Class Representatives (CRs) to schedule, reschedule, and manage room allocations without room clashing or double-booking.

---

## ✨ Features
- **Department CR Self-Management**: Each of the 9 batches (`15`, `16`, `17`, `18`, `19`, `20`, `21`, `22-A`, `22-B`) has its own CR account (`cr-15`, `cr-22a`, etc.) to schedule and edit their batch's classes.
- **Admin Global Control**: Department Admins have override authority to edit or remove any class and trigger storage cleanups.
- **Room Conflict Shield**: Real-time validation preventing overlapping bookings for the same room and time slot.
- **Batch Overlap Protection**: Prevents scheduling multiple classes for the same batch at identical periods.
- **Automatic Storage Optimization**: Past classes (`date < today`) are automatically cleaned up to keep database storage lightweight and fast.
- **Dual-Tier Database**: Connects directly to Supabase PostgreSQL in cloud production with seamless local JSON fallback for offline development.

---

## 🚀 Quick Deployment Guide (Vercel)

### Step 1: Execute Database Schema on Supabase
1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> **New Query**.
3. Copy the entire contents of [`supabase-schema.sql`](./supabase-schema.sql) and click **Run**.
   *(This creates all 5 tables: `rooms`, `time_slots`, `reschedules`, `admin_credentials`, `cr_credentials`, seeds the 8 rooms and 5 daily lecture periods, and sets up RLS policies).*

### Step 2: Configure Environment Variables on Vercel
In your Vercel Project Settings -> **Environment Variables**, add:

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhbGci...` |
| `ADMIN_PASSWORD` | Master password for Admin | `your-secure-admin-password` |
| `ADMIN_SESSION_SECRET` | Secret key for signing session cookies | `a-random-32-char-secret-string` |

### Step 3: Deploy
Push your code to GitHub to trigger Vercel's automatic 1-click deployment:
```bash
git add .
git commit -m "feat: complete class reschedule portal with role-based auth"
git push origin main
```

---

## 🔑 Default Credentials (Out of the Box)
- **Admin**:
  - Username: `admin`
  - Default Password: `admin123` (or whatever set in `ADMIN_PASSWORD`)
- **Class Representatives (CRs)**:
  - Usernames: `cr-15`, `cr-16`, `cr-17`, `cr-18`, `cr-19`, `cr-20`, `cr-21`, `cr-22a`, `cr-22b` (also accepts `15`, `22-A`, etc.)
  - Default Password: `cr123` (or `key-15`, `key-22a`)
- **Password Changes**:
  - Any logged-in CR or Admin can change their password at any time via the **Password** button in the top navigation.

---

## 💻 Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Build for production locally
npm run build
```
Open [http://localhost:3000](http://localhost:3000) with your browser.
