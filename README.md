# Health Dashboard

Personal health tracking dashboard built with React, Recharts, and Supabase.

## Features
- **Weight Tracking** — Log weight with trend graphs and stats
- **Body Measurements** — Track 8 body measurements with 3/6/12 month comparisons
- **Workout Performance** — Log exercises with volume charts and type breakdowns
- **Nutrition** — Daily food logs with macro summaries and calorie trends
- **Progress Photos** — Upload and browse progress pictures in a timeline
- **Date Range Filters** — Compare any time periods with preset shortcuts

## Setup

### 1. Create Supabase tables
Run the SQL in `supabase-migrations.sql` in your Supabase SQL Editor.

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
