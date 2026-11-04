# Project History & Changelog

## 📌 Project Overview
**University Class Reschedule & Room Allocation Portal**
A web application designed for university class captains and department coordinators to post, manage, and coordinate class reschedule requests without running into room allocation conflicts or double-booking.

---

## 🎯 Key Objectives & Core Problems Solved
1. **Room Conflict Prevention**: Automatic detection of overlapping bookings for the same room and time slot.
2. **Centralized Reschedule Feed**: A clear, unified dashboard where class captains and students can see rescheduled sessions in real time.
3. **Room Availability Discovery**: Quick lookup of free classrooms/labs by date, time slot, building, and capacity.
4. **Coordination & Approval Flow**: Streamlined submission for class captains with validation against existing regular schedules and other rescheduled classes.

---

## 📋 Suggested Feature Roadmap
- [ ] **Room & Timeslot Management**: Setup room numbers, buildings, capacities, equipment (projector, lab PCs), and standard lecture slots.
- [ ] **Routine / Regular Timetable Integration**: Base schedule to know when rooms are occupied normally.
- [ ] **Reschedule Request System**: Form for captains to pick course, section, date, target time, and request/reserve an available room.
- [ ] **Conflict Detection Engine**: Real-time validation preventing double-booking of rooms or batch overlap.
- [ ] **Interactive Schedule View**: Daily/weekly timetable grid and filterable reschedule notices.
- [ ] **Role-Based Access / Authentication**:
  - Class Captains (create & manage their section's reschedules)
  - Admin / Department Officers (manage rooms, approve or override)
  - Students (view-only public schedule and announcements)

---

## 🛠️ Selected Tech Stack & Architecture
- **Framework**: Next.js (React) + Tailwind CSS + Lucide Icons
- **Backend / Database**: Next.js Fullstack API Routes + SQLite (zero-config, high performance, file-based persistence)
- **Authentication**: Section / Captain Passcode & Admin PIN (instant access without tedious email verification)
- **Top Priority UI/UX**: Interactive Timetable & Daily Grid View showing occupied vs. vacant rooms in real-time, coupled with an active Conflict Detection Engine.

---

## 📝 Activity & Work Log

### [2026-10-06 / 2026-10-07] - Full Implementation & Verification Complete
- **Environment & Runtime Setup**:
  - Installed Node.js LTS (v24.19.0) and npm (v11.17.0).
  - Configured Next.js 15, React 19, TypeScript, Tailwind CSS, and Lucide Icons.
- **Database & Data Store**:
  - Implemented persistent atomic JSON database store (`data/database.json`) with pre-seeded university lecture halls, computer labs, seminar halls, time slots, and recurring routine timetable.
- **Conflict Prevention Engine** ([`lib/db.ts`](file:///d:/Project/Class%20schedule/lib/db.ts)):
  - Layer 1: Regular university routine conflict detection.
  - Layer 2: Rescheduled booking clash detection.
  - Layer 3: Batch/Section double-booking protection (students cannot be in two classes at once).
  - Alternative suggestions: Automatically discovers and proposes free classrooms when a chosen slot is occupied.
- **Interactive Timetable & UI** ([`app/page.tsx`](file:///d:/Project/Class%20schedule/app/page.tsx)):
  - **Daily Room Grid View**: Visual matrix with room equipment/capacity on Y-axis and university periods on X-axis. Click any vacant cell to book immediately.
  - **Live Conflict Shield**: Real-time conflict status banner during booking with auto-switching to alternative free rooms.
  - **Instant Vacant Room Finder**: One-click lookup for all rooms available at any target date and time slot.
  - **Reschedule Notice Feed**: Filterable notices with instant **Copy WhatsApp Notice** for class group chats.
  - **Captain Passcode Protection**: 4-digit PIN for class captains to safely delete/manage bookings, plus master admin override (`admin123`).
### [2026-10-07] - Simplified Interface: Direct "Add Class" & Day-Wise Rows
- **User Feedback**: Requested a clean, straightforward interface without unnecessary clutter — simply an **"Add Class"** button and classes displayed in **day-wise rows**.
- **Refactored Architecture**:
  - Replaced multi-tab matrix view with a clean, responsive **Day-wise row list** (Sunday through Saturday).
  - Prominent **"+ Add Class"** button at the top opening a streamlined modal form.
  - Kept essential **Room Allocation Conflict Prevention**: automatically blocks duplicate room bookings on the same day & time with a clear, friendly warning.
- **Build & Server Verification**:
  - Successfully executed `npm run build` (optimized production build with zero errors).
  - Started high-performance production server on `http://localhost:3000`.

### [2026-10-07] - CR Personal Authentication Key & Dynamic Date-Wise Rows
- **Fixed Button & Server**: Resolved `.next` build lock error by compiling an optimized production build and launching `next start` on `http://localhost:3000`. The **"Add Class"** button functions smoothly.
- **CR Personal Authentication Key**:
  - Added personal CR key requirement (`crKey`) to the Add Class modal.
  - Pre-registered university CR keys (e.g. `CR-CSE-22`, `CR-CSE-23`, `CR-EEE-22`, `CR-SWE-22`, or any `CR-*` key) with quick-select buttons in the modal.
  - Required for canceling/deleting bookings.
### [2026-10-07] - User Custom Database Integration (`database.json`)
- **Adopted Custom Schema**:
  - Re-anchored the application to directly read and write `data/database.json`.
  - Configured exact classrooms and labs: **Room 301**, **Room 302**, **Room 401**, **Room 303**, **Room 304**, **Lab 306**, **Lab 307**, **Lab 308**.
  - Configured exact 5 lecture periods: **08:30–09:50**, **09:50–11:10**, **11:10–12:30**, **01:50–03:10**, **03:10–04:30**.
  - Fixed syntax trailing commas inside the JSON so `JSON.parse` reads the data cleanly without parse exceptions.
- **Dynamic Date-Wise Rows from User Database**:
  - Date rows on the home screen are now derived dynamically from `reschedules` inside `database.json`.
  - The pre-existing booking (`2026-10-06`, `CSE 3101`, `Room 302`, `11:10 AM - 12:30 PM`) renders directly as a date row on the home screen.
  - Adding new classes via the modal directly appends to `data/database.json` and creates new date rows as needed.
### [2026-10-07] - 9-Batch Authentication Refactoring (No Name / Phone)
- **Batch-Only Authentication**:
  - Removed CR personal name and phone number fields completely from the UI, API, and database.
  - Authentication is now strictly **Batch + Secret Key**.
  - Configured the exact 9 batches of the department:
    - **15**
    - **16**
    - **17**
    - **18**
    - **19**
    - **20**
    - **21**
    - **22-A**
    - **22-B**
- **Streamlined Workflow**:
  - Adding a class only requires selecting one of the 9 batches and typing its secret key.
  - Cards on the home screen highlight the batch badge clearly (e.g. `Batch 22-A`, `Batch 17`).
  - Cancellation requires the batch's secret key.
  - Preserved room conflict detection and dynamic date-wise row appearance.
- **Build & Server**: Rebuilt and restarted production server on `http://localhost:3000`.

### [2026-10-07] - Production Cleanup & Cloud Deployment Preparation
- **Test Data Reset**:
  - Cleared all dummy and test reschedule entries from [`data/database.json`](file:///d:/Project/Class%20schedule/data/database.json).
  - Rooms and 5 time slots preserved cleanly in pristine state for actual university use.
- **Git & Deployment Configuration**:
  - Created [`.gitignore`](file:///d:/Project/Class%20schedule/.gitignore) to exclude `node_modules`, `.next`, cache, and temporary files.
  - Successfully pushed all code to GitHub repository: **[`sakibRayhan21/class-schedule`](https://github.com/sakibRayhan21/class-schedule)**.
  - Ready for 1-click 24/7 cloud deployment on Vercel or Render.

### [2026-10-28] - Supabase Cloud Database Integration for Vercel
- **Diagnosed Issue**: Vercel's serverless environment has a read-only, ephemeral filesystem, which prevented changes to local `data/database.json` from persisting after deploy.
- **Implemented Supabase Cloud Integration**:
  - Installed `@supabase/supabase-js`.
  - Created [`lib/supabase.ts`](file:///d:/Project/Class%20schedule/lib/supabase.ts) and updated [`lib/db.ts`](file:///d:/Project/Class%20schedule/lib/db.ts) to read and write directly to Supabase cloud PostgreSQL when environment variables are set.
  - Created [`supabase-schema.sql`](file:///d:/Project/Class%20schedule/supabase-schema.sql) with one-click table creation and pre-population for all 8 rooms and 5 time slots.
  - Maintained complete local fallback to `data/database.json` when offline.
  - Verified Next.js build compilation with 0 errors.

### [2026-10-30] - Edit Class Capability & Auto Storage Saver (Past Data Purge)
- **Edit Class Feature**:
  - Added an **Edit** button (pencil icon) directly on each rescheduled class card.
  - Implemented an **Edit Rescheduled Class** modal with prefilled data (date, slot, room, course code, title, batch, and reason).
  - Implemented `PUT /api/schedule` endpoint in [`app/api/schedule/route.ts`](file:///d:/Project/Class%20schedule/app/api/schedule/route.ts) with batch secret key verification and conflict detection (ignoring self).
  - Supports updating records in both Supabase cloud database and local fallback.
- **Database Storage Optimization (Yesterday's Data Cleanup)**:
  - Addressed database storage shortage question: Confirmed that purging past/yesterday's data is **highly feasible and recommended** for class rescheduling systems.
  - Implemented `cleanupPastReschedules()` in [`lib/db.ts`](file:///d:/Project/Class%20schedule/lib/db.ts): Automatically deletes classes where `date < today`.
  - Added a **"Clean Past Records"** button in the header for on-demand manual cleanup (`DELETE /api/schedule?action=cleanup`).
  - Added a storage indicator banner informing users that auto-storage optimization is active.


### [2026-11-04] - Role-Based Authentication: Batch CR Self-Management & Admin Global Authority
- **Role-Based Access Control (RBAC)**:
  - **Batch CRs**:
    - Each of the 9 batches (`15`, `16`, `17`, `18`, `19`, `20`, `21`, `22-A`, `22-B`) has its own dedicated CR account.
    - Usernames: `cr-15`, `cr-16`, ..., `cr-22a`, `cr-22b` (flexible alias matching for `15`, `22-A`, etc.).
    - Default initial password: `cr123` (or legacy batch key `key-15`, `key-22a`).
    - CRs authenticate via the **Sign In** modal and can change their password at any time.
    - **CR Capabilities**: Can **Add Class** strictly for their own batch (batch selector locked), and **Edit Class** for their own batch. Cannot modify or tamper with other batches' classes.
  - **Department Admin**:
    - Username: `admin` (default password: `admin123`).
    - **Admin Capabilities**: Global override authority — can **Edit** or **Remove** anyone's class, schedule classes for any batch, and trigger storage cleanups.
  - **Students / Public**:
    - Retains view-only access to the public reschedule board without requiring sign in.
- **Security & Session Implementation**:
  - Encrypted, tamper-proof session tokens signed using HMAC-SHA256 (`unischedule_session`).
  - Scrypt password hashing with cryptographic salt and timing-safe equality comparison.
  - Dual-tier credential persistence: Supabase `admin_credentials` and `cr_credentials` tables with local fallback in `data/*-credentials.json` (gitignored).
- **Backend API Protection** ([`app/api/schedule/route.ts`](file:///d:/Project/Class%20schedule/app/api/schedule/route.ts)):
  - `POST`: Enforces that CRs can only create classes where `body.batch === session.batch`.
  - `PUT`: Enforces that CRs can only edit existing classes matching their batch.
  - `DELETE`: Admin has authority to remove any class; CRs are prevented from removing unauthorized classes.

### [2026-11-04] - Compact Schedule Table Display Style
- **Compact Schedule Table Layout**:
  - Transformed the scheduled class display into a clean, space-efficient table with dedicated columns:
    - **Time Slot**: Period indicator badge (P1, P2, etc.) and time label (`08:30 AM - 09:50 AM`).
    - **Room**: Location pill badge (`Room 301`, `Lab 306`).
    - **Course & Topic**: Course code, title, and optional reschedule reason/note.
    - **Batch**: Distinct batch badge (`Batch 22-A`), with special emerald highlight for the logged-in CR's batch.
    - **Actions**: One-click WhatsApp Notice copy button, Edit button (for batch CR / Admin), and Remove button (for Admin).
- **Post-Creation Immediate Visual Feedback**:
  - Automatically activates the Compact Table display upon class creation.
  - Highlights newly added classes with a visual badge (`✨ Just Added`) and emerald glow for 6 seconds.
- **Chronological Period Sorting**:
  - Classes within each date row are automatically ordered chronologically by lecture period (Period 1 to Period 5).
- **WhatsApp Share Integration**:
  - Added individual class WhatsApp Notice generator and a full-day schedule copy button in the date header.
- **View Mode Switcher**:
  - Added an interactive switcher between **Compact Table** (default) and **Cards** view.

### [2026-11-04] - Dismantled Common CR Login & Implemented Direct Per-Batch CR Key Authentication
- **Problem Solved**:
  - Addressed user feedback regarding the prior session-based authentication system having a shared/common password (`cr123`) for every CR account and forcing tedious login modals before scheduling.
- **Architectural Refactoring**:
  - **Dismantled CR Login Barrier**: Removed the sign-in modal, session checking, and cookie gatekeeping from the scheduling flow.
  - **Direct Batch CR Key Requirement**: CRs provide their dedicated batch secret key (`key-15`, `key-16`, ..., `key-22a`, `key-22b`) directly within the "+ Add Class" modal before posting a class.
  - **Strict Key Validation**:
    - Backend rejects shared common passwords (`cr123`) and cross-batch keys (e.g. Batch 22-A trying to use `key-15`).
    - Only the authorized CR key for that specific batch (or `admin123` master override) is permitted to post, edit, or delete classes for that batch.
  - **Seamless Modals**: Both "Edit Class" and "Remove Class" prompt for the respective batch's CR secret key, preserving batch autonomy without complex session logins.
  - **Dual-Tier Resilient Fallback**: Supabase cloud PostgreSQL connection automatically falls back to local persistence (`database.json`) when offline, preventing network errors.

### [2026-11-04] - Centralized Admin Authentication System Restored
- **User Requirement**: Restored the Department Admin authentication system to maintain schedule integrity and centralized administrative control.
- **Implementation**:
  - **Admin Sign In & Session Management**: Dedicated Admin Sign In button in the navigation bar with encrypted HMAC-SHA256 cookie session (`unischedule_session`).
  - **Centralized Control & Global Authority**:
    - Admin has override authority across all 9 batches.
    - Admin can create, edit, or remove any class without needing individual batch keys.
    - Password management: Admin can update their credentials at any time via the **Password** modal.
    - Storage management: Admin exclusively controls manual purging of past records (**Clean Past**).
  - **Hybrid Security Architecture**:
    - **Admins**: Authenticate via dedicated Admin credentials with full centralized control.
    - **CRs**: Post classes instantly by providing their batch's dedicated key before posting (no accounts, no shared passwords).
