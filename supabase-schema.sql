-- ========================================================
-- UniSchedule: Supabase Database Schema & Initial Data
-- Run this script in your Supabase SQL Editor (1-Click Run)
-- ========================================================

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2. Create Time Slots Table
CREATE TABLE IF NOT EXISTS public.time_slots (
  id TEXT PRIMARY KEY,
  period INT NOT NULL,
  label TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

-- 3. Create Reschedules Table
CREATE TABLE IF NOT EXISTS public.reschedules (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT,
  batch TEXT NOT NULL,
  passcode TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS) & Allow Anonymous Read/Write
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedules ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY IF NOT EXISTS "Allow public read on rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public read on time_slots" ON public.time_slots FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public read on reschedules" ON public.reschedules FOR SELECT USING (true);

-- Allow public write & delete on reschedules (conflict checking & passcode protection are handled by our API)
CREATE POLICY IF NOT EXISTS "Allow public insert on reschedules" ON public.reschedules FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update on reschedules" ON public.reschedules FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Allow public delete on reschedules" ON public.reschedules FOR DELETE USING (true);

-- 5. Insert the 8 Classrooms & Labs
INSERT INTO public.rooms (id, name) VALUES
  ('room-301', 'Room 301'),
  ('room-302', 'Room 302'),
  ('room-401', 'Room 401'),
  ('room-303', 'Room 303'),
  ('room-304', 'Room 304'),
  ('lab-306', 'Lab 306'),
  ('lab-307', 'Lab 307'),
  ('lab-308', 'Lab 308')
ON CONFLICT (id) DO NOTHING;

-- 6. Insert the 5 Lecture Periods
INSERT INTO public.time_slots (id, period, label, start_time, end_time) VALUES
  ('slot-1', 1, '08:30 AM - 09:50 AM', '08:30', '09:50'),
  ('slot-2', 2, '09:50 AM - 11:10 AM', '09:50', '11:10'),
  ('slot-3', 3, '11:10 AM - 12:30 PM', '11:10', '12:30'),
  ('slot-4', 4, '01:50 PM - 03:10 PM', '13:50', '15:10'),
  ('slot-5', 5, '03:10 PM - 04:30 PM', '15:10', '16:30')
ON CONFLICT (id) DO NOTHING;
