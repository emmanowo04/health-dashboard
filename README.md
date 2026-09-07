# Health Dashboard

Personal health tracking dashboard built with React, Recharts, and Supabase.

## Features
- **Weekly Planner** — Plan your week in 30-min blocks with click-and-drag painting, frequency-ranked activity chips, and a "copy last week" shortcut
- **Weight Tracking** — Log weight with trend graphs and stats
- **Body Measurements** — Track 8 body measurements with 3/6/12 month comparisons
- **Workout Performance** — Log exercises with volume charts and type breakdowns
- **Nutrition** — Daily food logs with macro summaries and calorie trends
- **Progress Photos** — Upload and browse progress pictures in a timeline
- **Date Range Filters** — Compare any time periods with preset shortcuts

## Setup

### 1. Create Supabase tables
Run the SQL in `supabase-migrations.sql` in your Supabase SQL Editor. If you're updating an existing database, just run the new `planner_blocks` section (section 6) plus its RLS policy — the rest already exists.

### 2. Install & run
```bash
npm install
npm start
```

### 3. Deploy to GitHub Pages
Update `homepage` in `package.json` to your repo URL:
```json
"homepage": "https://YOUR_USERNAME.github.io/health-dashboard"
```
Then:
```bash
npm run deploy
```

## Tech Stack
React 18 · Recharts · Supabase · date-fns · GitHub Pages
