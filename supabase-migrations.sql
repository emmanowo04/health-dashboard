-- ============================================
-- Health Dashboard - Supabase Schema Migrations
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Weight Tracking
CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_lbs NUMERIC(5,1) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Body Measurements
CREATE TABLE IF NOT EXISTS measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  chest_in NUMERIC(5,1),
  waist_in NUMERIC(5,1),
  hips_in NUMERIC(5,1),
  bicep_left_in NUMERIC(5,1),
  bicep_right_in NUMERIC(5,1),
  thigh_left_in NUMERIC(5,1),
  thigh_right_in NUMERIC(5,1),
  neck_in NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workout Performance Log
CREATE TABLE IF NOT EXISTS workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  workout_type TEXT NOT NULL,        -- e.g. 'Strength', 'Cardio', 'HIIT', 'Yoga'
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight_lbs NUMERIC(6,1),
  duration_min INTEGER,
  distance_mi NUMERIC(5,2),
  calories_burned INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Daily Food Logs
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL,           -- 'Breakfast', 'Lunch', 'Dinner', 'Snack'
  food_name TEXT NOT NULL,
  calories INTEGER,
  protein_g NUMERIC(5,1),
  carbs_g NUMERIC(5,1),
  fat_g NUMERIC(5,1),
  fiber_g NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Progress Photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url TEXT NOT NULL,
  pose_type TEXT,                    -- 'Front', 'Side', 'Back'
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Enable Row Level Security (open for anon for now)
-- Adjust these policies for production use
-- ============================================
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (for personal dashboard use)
CREATE POLICY "Allow all for anon" ON weight_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON measurements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON workouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON food_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON progress_photos FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Create a storage bucket for progress photos
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on the bucket
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'progress-photos');

-- Allow anon upload to the bucket
CREATE POLICY "Anon upload access" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'progress-photos');
