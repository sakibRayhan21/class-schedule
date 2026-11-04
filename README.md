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

## 🔑 Centralized Admin Control & Batch CR Access

### 🛡️ 1. Department Admin Authentication System (Centralized Control)
- **Centralized Control & System Integrity**:
  - Click **"Admin Sign In"** in the top navigation bar.
  - Default Credentials: Username: `admin`, Password: `admin123` (or custom `ADMIN_PASSWORD` in `.env.local` / Vercel).
  - **Full Override Authority**: Once signed in as Admin:
    - Global edit & remove authority over all batches without needing individual batch keys.
    - Centralized scheduling for any batch.
    - Password management: Click **"Password"** in the navigation bar to update the master Admin password.
    - Database Storage Cleanup: Trigger **"Clean Past"** records to purge yesterday's expired entries.

### 🎓 2. Batch CR Keys (Direct Action Authentication — No Shared Passwords)
- **Instant Scheduling (No Sign-In Account Barrier)**:
  - CRs do **not** need an account login or shared common password.
  - Simply click **"+ Add Class"**, pick your batch, and enter your batch's dedicated CR secret key before posting:
    - `Batch 15`: `key-15`
    - `Batch 16`: `key-16`
    - `Batch 17`: `key-17`
    - `Batch 18`: `key-18`
    - `Batch 19`: `key-19`
    - `Batch 20`: `key-20`
    - `Batch 21`: `key-21`
    - `Batch 22-A`: `key-22a`
    - `Batch 22-B`: `key-22b`

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
