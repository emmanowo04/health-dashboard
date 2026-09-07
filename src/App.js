import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { supabase } from './supabaseClient';
import { format, subMonths, subDays, addDays, parseISO, startOfDay } from 'date-fns';
import './App.css';

// ─── Helpers ────────────────────────────────────────────
const fmt = (d) => format(parseISO(d), 'MMM d, yyyy');
const fmtShort = (d) => format(parseISO(d), 'MMM d');
const today = format(new Date(), 'yyyy-MM-dd');
const ago = (months) => format(subMonths(new Date(), months), 'yyyy-MM-dd');
const daysAgo = (n) => format(subDays(new Date(), n), 'yyyy-MM-dd');

const TABS = ['Planner', 'Weight', 'Measurements', 'Workouts', 'Nutrition', 'Photos'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const WORKOUT_TYPES = ['Strength', 'Cardio', 'HIIT', 'Yoga', 'Stretching', 'Other'];
const POSE_TYPES = ['Front', 'Side', 'Back'];
const MACRO_COLORS = { protein: '#4f6ef7', carbs: '#f59e0b', fat: '#ef4444', fiber: '#22c55e' };
const PIE_COLORS = ['#4f6ef7', '#f59e0b', '#ef4444', '#22c55e'];

const MEASUREMENT_FIELDS = [
  { key: 'chest_in', label: 'Chest' },
  { key: 'waist_in', label: 'Waist' },
  { key: 'hips_in', label: 'Hips' },
  { key: 'bicep_left_in', label: 'L Bicep' },
  { key: 'bicep_right_in', label: 'R Bicep' },
  { key: 'thigh_left_in', label: 'L Thigh' },
  { key: 'thigh_right_in', label: 'R Thigh' },
  { key: 'neck_in', label: 'Neck' },
];

// ─── Planner helpers ────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_PLANNER_ACTIVITIES = ['Gym', 'Padel', 'Football', 'Work', 'Church', 'Sleep', 'Commute', 'Meal Prep', 'Rest'];
const ACTIVITY_PALETTE = ['#4f6ef7', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#eab308'];

function activityColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACTIVITY_PALETTE[Math.abs(hash) % ACTIVITY_PALETTE.length];
}

function slotLabel(idx) {
  const h = Math.floor(idx / 2);
  const m = idx % 2 === 0 ? '00' : '30';
  const period = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${period}`;
}

function mondayOf(dateStr) {
  const d = parseISO(dateStr);
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return format(monday, 'yyyy-MM-dd');
}

// ─── Main App ───────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('Weight');
  const [dateFrom, setDateFrom] = useState(ago(3));
  const [dateTo, setDateTo] = useState(today);
  const [preset, setPreset] = useState('3m');
  const [modal, setModal] = useState(null);

  // Data state
  const [weights, setWeights] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [foodLogs, setFoodLogs] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── Date presets ──────────────────────────────────────
  const applyPreset = (p) => {
    setPreset(p);
    setDateTo(today);
    const map = { '7d': daysAgo(7), '1m': ago(1), '3m': ago(3), '6m': ago(6), '1y': ago(12), 'all': '2020-01-01' };
    setDateFrom(map[p] || ago(3));
  };

  // ─── Fetch data ────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = { from: dateFrom, to: dateTo };
      const [w, m, wo, f, p] = await Promise.all([
        supabase.from('weight_logs').select('*').gte('logged_at', range.from).lte('logged_at', range.to).order('logged_at'),
        supabase.from('measurements').select('*').gte('logged_at', range.from).lte('logged_at', range.to).order('logged_at'),
        supabase.from('workouts').select('*').gte('logged_at', range.from).lte('logged_at', range.to).order('logged_at', { ascending: false }),
        supabase.from('food_logs').select('*').gte('logged_at', range.from).lte('logged_at', range.to).order('logged_at', { ascending: false }),
        supabase.from('progress_photos').select('*').gte('logged_at', range.from).lte('logged_at', range.to).order('logged_at', { ascending: false }),
      ]);
      if (w.error) throw w.error;
      setWeights(w.data || []);
      setMeasurements(m.data || []);
      setWorkouts(wo.data || []);
      setFoodLogs(f.data || []);
      setPhotos(p.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { if (tab !== 'Planner') fetchAll(); }, [fetchAll, tab]);

  // ─── CRUD helpers ──────────────────────────────────────
  const insert = async (table, data) => {
    const { error } = await supabase.from(table).insert(data);
    if (error) { setError(error.message); return false; }
    fetchAll();
    return true;
  };

  const remove = async (table, id) => {
    if (!window.confirm('Delete this entry?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) setError(error.message);
    else fetchAll();
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="app">
      <header className="header">
        <h1>🏋️ <span>Health</span> Dashboard</h1>
      </header>

      {/* Tabs */}
      <nav className="tabs">
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {/* Date filter (not relevant to the forward-looking Planner) */}
      {tab !== 'Planner' && (
        <div className="date-filter">
          <label>From</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset(''); }} />
          <label>To</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreset(''); }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['7d', '1m', '3m', '6m', '1y', 'all'].map(p => (
              <button key={p} className={`preset-btn ${preset === p ? 'active' : ''}`} onClick={() => applyPreset(p)}>{p}</button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-banner">⚠️ {error} <button className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={() => setError(null)}>Dismiss</button></div>}
      {loading && tab !== 'Planner' && <div className="loading">Loading data…</div>}

      {/* Tab content */}
      {tab === 'Planner' && <PlannerSection />}
      {!loading && tab === 'Weight' && <WeightSection data={weights} onAdd={() => setModal('weight')} onDelete={(id) => remove('weight_logs', id)} />}
      {!loading && tab === 'Measurements' && <MeasurementsSection data={measurements} onAdd={() => setModal('measurement')} onDelete={(id) => remove('measurements', id)} />}
      {!loading && tab === 'Workouts' && <WorkoutsSection data={workouts} onAdd={() => setModal('workout')} onDelete={(id) => remove('workouts', id)} />}
      {!loading && tab === 'Nutrition' && <NutritionSection data={foodLogs} onAdd={() => setModal('food')} onDelete={(id) => remove('food_logs', id)} />}
      {!loading && tab === 'Photos' && <PhotosSection data={photos} onAdd={() => setModal('photo')} onDelete={(id) => remove('progress_photos', id)} />}

      {/* Modals */}
      {modal === 'weight' && <WeightModal onClose={() => setModal(null)} onSave={(d) => insert('weight_logs', d).then(ok => ok && setModal(null))} />}
      {modal === 'measurement' && <MeasurementModal onClose={() => setModal(null)} onSave={(d) => insert('measurements', d).then(ok => ok && setModal(null))} />}
      {modal === 'workout' && <WorkoutModal onClose={() => setModal(null)} onSave={(d) => insert('workouts', d).then(ok => ok && setModal(null))} />}
      {modal === 'food' && <FoodModal onClose={() => setModal(null)} onSave={(d) => insert('food_logs', d).then(ok => ok && setModal(null))} />}
      {modal === 'photo' && <PhotoModal onClose={() => setModal(null)} onSave={(d) => insert('progress_photos', d).then(ok => ok && setModal(null))} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// SECTION: Weekly Planner
// ═════════════════════════════════════════════════════════
function PlannerSection() {
  const [weekStart, setWeekStart] = useState(mondayOf(today));
  const [blocks, setBlocks] = useState([]); // [{block_date, slot_index, activity, task_id}]
  const [allActivity, setAllActivity] = useState([]); // all-time activity strings, for frequency ranking
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // brush: null | {kind:'activity', name} | {kind:'task', id, title} | {kind:'erase'}
  const [brush, setBrush] = useState(null);
  const [newActivity, setNewActivity] = useState('');
  const [showEarly, setShowEarly] = useState(false);
  const draggingRef = useRef(false);

  // ─── Task list state ───────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [tasksByCategory, setTasksByCategory] = useState({});
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState({});
  const [showCompleted, setShowCompleted] = useState(false);

  const weekDates = useMemo(() => {
    const start = parseISO(weekStart);
    return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  }, [weekStart]);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from('planner_blocks').select('*')
      .gte('block_date', weekDates[0]).lte('block_date', weekDates[6]);
    if (error) setError(error.message);
    else setBlocks(data || []);
    setLoading(false);
  }, [weekDates]);

  const fetchFrequency = useCallback(async () => {
    const { data } = await supabase.from('planner_blocks').select('activity').limit(3000);
    if (data) setAllActivity(data.map(d => d.activity));
  }, []);

  const fetchTasks = useCallback(async () => {
    const [{ data: cats, error: catErr }, { data: allTasks, error: taskErr }] = await Promise.all([
      supabase.from('task_categories').select('*').order('position').order('created_at'),
      supabase.from('tasks').select('*').order('position').order('created_at'),
    ]);
    if (catErr) setError(catErr.message);
    if (taskErr) setError(taskErr.message);
    setCategories(cats || []);
    const grouped = {};
    (allTasks || []).forEach(t => {
      if (!grouped[t.category_id]) grouped[t.category_id] = [];
      grouped[t.category_id].push(t);
    });
    setTasksByCategory(grouped);
  }, []);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);
  useEffect(() => { fetchFrequency(); }, [fetchFrequency]);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const stop = () => { draggingRef.current = false; };
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => { window.removeEventListener('mouseup', stop); window.removeEventListener('touchend', stop); };
  }, []);

  const blockMap = useMemo(() => {
    const m = {};
    blocks.forEach(b => { m[`${b.block_date}_${b.slot_index}`] = b; });
    return m;
  }, [blocks]);

  // Minutes scheduled this week per task, for the little time badge in the panel
  const taskMinutesThisWeek = useMemo(() => {
    const m = {};
    blocks.forEach(b => { if (b.task_id) m[b.task_id] = (m[b.task_id] || 0) + 30; });
    return m;
  }, [blocks]);

  const taskCompleteMap = useMemo(() => {
    const m = {};
    Object.values(tasksByCategory).flat().forEach(t => { m[t.id] = t.is_complete; });
    return m;
  }, [tasksByCategory]);

  const formatMinutes = (mins) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };

  const topActivities = useMemo(() => {
    const counts = {};
    allActivity.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    DEFAULT_PLANNER_ACTIVITIES.forEach(a => { if (!(a in counts)) counts[a] = 0; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name);
  }, [allActivity]);

  const writeSlot = async (date, idx, payload) => {
    // payload: null to clear, or { activity, task_id }
    setBlocks(prev => {
      const filtered = prev.filter(b => !(b.block_date === date && b.slot_index === idx));
      return payload
        ? [...filtered, { block_date: date, slot_index: idx, activity: payload.activity, task_id: payload.task_id || null }]
        : filtered;
    });
    try {
      if (payload) {
        const { error } = await supabase.from('planner_blocks')
          .upsert(
            { block_date: date, slot_index: idx, activity: payload.activity, task_id: payload.task_id || null },
            { onConflict: 'block_date,slot_index' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('planner_blocks').delete().eq('block_date', date).eq('slot_index', idx);
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message);
      fetchWeek();
    }
  };

  const paintCell = (date, idx) => {
    const filled = blockMap[`${date}_${idx}`];
    if (!brush) {
      // No brush selected: clicking a filled cell clears it (quick single-cell undo)
      if (filled) writeSlot(date, idx, null);
      return;
    }
    if (brush.kind === 'erase') { writeSlot(date, idx, null); return; }
    if (brush.kind === 'activity') { writeSlot(date, idx, { activity: brush.name, task_id: null }); return; }
    if (brush.kind === 'task') { writeSlot(date, idx, { activity: brush.title, task_id: brush.id }); return; }
  };

  // ─── Task CRUD ─────────────────────────────────────────
  const addCategory = async () => {
    const title = newCategoryTitle.trim();
    if (!title) return;
    const position = categories.length;
    const { data, error } = await supabase.from('task_categories').insert({ title, position }).select().single();
    if (error) { setError(error.message); return; }
    setCategories(prev => [...prev, data]);
    setNewCategoryTitle('');
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete this category and all its tasks?')) return;
    const { error } = await supabase.from('task_categories').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setCategories(prev => prev.filter(c => c.id !== id));
    setTasksByCategory(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (brush?.kind === 'task' && tasksByCategory[id]?.some(t => t.id === brush.id)) setBrush(null);
  };

  const addTask = async (categoryId) => {
    const title = (newTaskTitle[categoryId] || '').trim();
    if (!title) return;
    const position = (tasksByCategory[categoryId] || []).length;
    const { data, error } = await supabase.from('tasks').insert({ category_id: categoryId, title, position }).select().single();
    if (error) { setError(error.message); return; }
    setTasksByCategory(prev => ({ ...prev, [categoryId]: [...(prev[categoryId] || []), data] }));
    setNewTaskTitle(prev => ({ ...prev, [categoryId]: '' }));
  };

  const toggleTask = async (task) => {
    const is_complete = !task.is_complete;
    setTasksByCategory(prev => ({
      ...prev,
      [task.category_id]: prev[task.category_id].map(t => t.id === task.id ? { ...t, is_complete } : t),
    }));
    const { error } = await supabase.from('tasks').update({ is_complete }).eq('id', task.id);
    if (error) setError(error.message);
  };

  const deleteTask = async (task) => {
    setTasksByCategory(prev => ({
      ...prev,
      [task.category_id]: prev[task.category_id].filter(t => t.id !== task.id),
    }));
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) setError(error.message);
    if (brush?.kind === 'task' && brush.id === task.id) setBrush(null);
  };

  const selectTaskBrush = (task) => {
    setBrush(prev => (prev?.kind === 'task' && prev.id === task.id) ? null : { kind: 'task', id: task.id, title: task.title });
  };

  const handlePointerDown = (date, idx) => {
    draggingRef.current = true;
    paintCell(date, idx);
  };
  const handlePointerEnter = (date, idx) => {
    if (draggingRef.current) paintCell(date, idx);
  };

  const addCustomActivity = () => {
    const name = newActivity.trim();
    if (!name) return;
    setBrush({ kind: 'activity', name });
    setNewActivity('');
  };

  const copyLastWeek = async () => {
    const prevStart = format(addDays(parseISO(weekStart), -7), 'yyyy-MM-dd');
    const prevEnd = format(addDays(parseISO(weekStart), -1), 'yyyy-MM-dd');
    const { data, error } = await supabase.from('planner_blocks').select('*')
      .gte('block_date', prevStart).lte('block_date', prevEnd);
    if (error) { setError(error.message); return; }
    if (!data || !data.length) { alert('No entries found in the previous week.'); return; }
    const rows = data.map(b => ({
      block_date: format(addDays(parseISO(b.block_date), 7), 'yyyy-MM-dd'),
      slot_index: b.slot_index,
      activity: b.activity,
      task_id: b.task_id || null,
    }));
    const { error: upErr } = await supabase.from('planner_blocks').upsert(rows, { onConflict: 'block_date,slot_index' });
    if (upErr) setError(upErr.message);
    else fetchWeek();
  };

  const clearWeek = async () => {
    if (!window.confirm('Clear every planned slot this week?')) return;
    const { error } = await supabase.from('planner_blocks').delete()
      .gte('block_date', weekDates[0]).lte('block_date', weekDates[6]);
    if (error) setError(error.message);
    else fetchWeek();
  };

  const visibleSlots = useMemo(() => {
    const start = showEarly ? 0 : 12; // 12 = 6:00am
    return Array.from({ length: 48 - start }, (_, i) => start + i);
  }, [showEarly]);

  return (
    <div className="card">
      <div className="card-header">
        <h2>Weekly Planner</h2>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Syncing…</span>}
      </div>

      <div className="planner-week-nav">
        <button className="nav-btn" onClick={() => setWeekStart(format(addDays(parseISO(weekStart), -7), 'yyyy-MM-dd'))}>‹</button>
        <span className="planner-week-label">{format(parseISO(weekStart), 'MMM d')} – {format(addDays(parseISO(weekStart), 6), 'MMM d, yyyy')}</span>
        <button className="nav-btn" onClick={() => setWeekStart(format(addDays(parseISO(weekStart), 7), 'yyyy-MM-dd'))}>›</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setWeekStart(mondayOf(today))}>This week</button>
        <button className="btn btn-sm btn-secondary" onClick={copyLastWeek}>Copy last week</button>
        <button className="btn btn-sm btn-secondary" onClick={() => setShowEarly(s => !s)}>{showEarly ? 'Hide' : 'Show'} 12–6am</button>
        <button className="btn btn-sm btn-secondary" onClick={clearWeek}>Clear week</button>
      </div>

      <p className="planner-hint">Select a task below, or an activity chip, then click or drag across the grid to fill it in. Click a filled slot with nothing selected to clear it.</p>

      <div className="planner-layout">
        {/* ─── Task list side panel ─────────────────────── */}
        <aside className="planner-side-panel">
          <div className="planner-panel-header">
            <h3>Tasks</h3>
            <label className="planner-show-completed">
              <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
              Show completed
            </label>
          </div>

          {categories.map(cat => {
            const catTasks = (tasksByCategory[cat.id] || []).filter(t => showCompleted || !t.is_complete);
            return (
              <div className="task-category" key={cat.id}>
                <div className="task-category-header">
                  <span>{cat.title}</span>
                  <button className="task-cat-delete" onClick={() => deleteCategory(cat.id)} title="Delete category">✕</button>
                </div>
                <ul className="task-list">
                  {catTasks.map(t => {
                    const mins = taskMinutesThisWeek[t.id];
                    const selected = brush?.kind === 'task' && brush.id === t.id;
                    return (
                      <li key={t.id} className={`task-item ${t.is_complete ? 'complete' : ''} ${selected ? 'selected' : ''}`}>
                        <input type="checkbox" checked={t.is_complete} onChange={() => toggleTask(t)} />
                        <span className="task-title" onClick={() => selectTaskBrush(t)}>{t.title}</span>
                        {mins ? <span className="task-time-badge">{formatMinutes(mins)}</span> : null}
                        <button className="task-delete" onClick={() => deleteTask(t)}>✕</button>
                      </li>
                    );
                  })}
                </ul>
                <div className="task-add-row">
                  <input
                    type="text"
                    placeholder="Add a task…"
                    value={newTaskTitle[cat.id] || ''}
                    onChange={e => setNewTaskTitle(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(cat.id); }}
                  />
                  <button className="btn btn-sm btn-secondary" disabled={!(newTaskTitle[cat.id] || '').trim()} onClick={() => addTask(cat.id)}>+</button>
                </div>
              </div>
            );
          })}

          <div className="task-add-category">
            <input
              type="text"
              placeholder="New category…"
              value={newCategoryTitle}
              onChange={e => setNewCategoryTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
            />
            <button className="btn btn-sm btn-secondary" disabled={!newCategoryTitle.trim()} onClick={addCategory}>+ Category</button>
          </div>
        </aside>

        {/* ─── Grid + quick activities ───────────────────── */}
        <div className="planner-main">
          <div className="planner-quick-label">Quick activities</div>
          <div className="planner-brushes">
            {topActivities.filter(Boolean).map(name => (
              <button
                key={name}
                className={`brush-chip ${brush?.kind === 'activity' && brush.name === name ? 'active' : ''}`}
                style={{ '--chip-color': activityColor(name) }}
                onClick={() => setBrush(prev => (prev?.kind === 'activity' && prev.name === name) ? null : { kind: 'activity', name })}
              >
                {name}
              </button>
            ))}
            <button
              className={`brush-chip eraser ${brush?.kind === 'erase' ? 'active' : ''}`}
              onClick={() => setBrush(prev => (prev?.kind === 'erase') ? null : { kind: 'erase' })}
            >
              Eraser
            </button>
          </div>

          <div className="planner-add-activity">
            <input
              type="text"
              placeholder="Add a new activity…"
              value={newActivity}
              onChange={e => setNewActivity(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomActivity(); }}
            />
            <button className="btn btn-sm btn-secondary" disabled={!newActivity.trim()} onClick={addCustomActivity}>+ Add</button>
          </div>

          <div className="planner-grid-wrap">
            <div className="planner-grid" style={{ gridTemplateRows: `auto repeat(${visibleSlots.length}, 28px)` }}>
              <div className="planner-time-head" />
              {weekDates.map((d, i) => (
                <div key={d} className={`planner-day-head ${d === today ? 'is-today' : ''}`}>
                  <div className="dow">{DAY_LABELS[i]}</div>
                  <div className="dom">{format(parseISO(d), 'MMM d')}</div>
                </div>
              ))}

              {visibleSlots.map(idx => (
                <React.Fragment key={idx}>
                  <div className={`planner-time-label ${idx % 2 === 0 ? 'hour-start' : ''}`}>
                    {idx % 2 === 0 ? slotLabel(idx) : ''}
                  </div>
                  {weekDates.map(d => {
                    const block = blockMap[`${d}_${idx}`];
                    const activity = block?.activity;
                    const isDone = block?.task_id && taskCompleteMap[block.task_id];
                    return (
                      <div
                        key={`${d}_${idx}`}
                        className={`planner-cell ${activity ? '' : 'empty'} ${idx % 2 === 0 ? 'hour-start' : ''} ${isDone ? 'is-done' : ''}`}
                        style={activity ? { background: activityColor(activity) } : undefined}
                        onMouseDown={() => handlePointerDown(d, idx)}
                        onMouseEnter={() => handlePointerEnter(d, idx)}
                        onTouchStart={() => handlePointerDown(d, idx)}
                        title={activity || ''}
                      >
                        {activity || ''}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// SECTION: Weight Tracking
// ═════════════════════════════════════════════════════════
function WeightSection({ data, onAdd, onDelete }) {
  const chartData = data.map(w => ({ date: fmtShort(w.logged_at), weight: Number(w.weight_lbs), fullDate: w.logged_at }));
  const latest = data.length ? Number(data[data.length - 1].weight_lbs) : null;
  const first = data.length ? Number(data[0].weight_lbs) : null;
  const change = latest !== null && first !== null ? (latest - first).toFixed(1) : null;
  const min = data.length ? Math.min(...data.map(w => Number(w.weight_lbs))) : 0;
  const max = data.length ? Math.max(...data.map(w => Number(w.weight_lbs))) : 0;
  const avg = data.length ? (data.reduce((s, w) => s + Number(w.weight_lbs), 0) / data.length).toFixed(1) : '—';

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Weight Trend</h2>
          <button className="add-btn" onClick={onAdd}>+ Log Weight</button>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><div className="label">Current</div><div className="value">{latest ?? '—'}</div><div className="label">lbs</div></div>
          <div className="stat-card"><div className="label">Change</div><div className="value" style={{ color: change > 0 ? '#ef4444' : change < 0 ? '#22c55e' : undefined }}>{change !== null ? `${change > 0 ? '+' : ''}${change}` : '—'}</div><div className="label">lbs</div></div>
          <div className="stat-card"><div className="label">Average</div><div className="value">{avg}</div><div className="label">lbs</div></div>
          <div className="stat-card"><div className="label">Range</div><div className="value">{data.length ? `${min}–${max}` : '—'}</div><div className="label">lbs</div></div>
        </div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e6ec' }} />
              <Area type="monotone" dataKey="weight" stroke="#4f6ef7" strokeWidth={2.5} fill="url(#weightGrad)" dot={{ r: 3, fill: '#4f6ef7' }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : chartData.length === 1 ? (
          <div className="empty-state"><p>Add another weight entry to see the trend chart.</p></div>
        ) : (
          <div className="empty-state"><div className="icon">⚖️</div><p>No weight data yet. Start tracking!</p></div>
        )}
      </div>
      {data.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Log History</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Weight</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {[...data].reverse().map(w => (
                  <tr key={w.id}>
                    <td>{fmt(w.logged_at)}</td>
                    <td><strong>{w.weight_lbs} lbs</strong></td>
                    <td style={{ color: '#5f6775' }}>{w.notes || '—'}</td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => onDelete(w.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════
// SECTION: Body Measurements
// ═════════════════════════════════════════════════════════
function MeasurementsSection({ data, onAdd, onDelete }) {
  const latest = data.length ? data[data.length - 1] : null;

  // Find comparison records closest to 3m, 6m, 12m ago
  const findClosest = (targetDate) => {
    if (!data.length) return null;
    let closest = null;
    let minDiff = Infinity;
    for (const row of data) {
      const diff = Math.abs(new Date(row.logged_at) - new Date(targetDate));
      if (diff < minDiff) { minDiff = diff; closest = row; }
    }
    // Only return if within 30 days of target
    return minDiff < 30 * 24 * 60 * 60 * 1000 ? closest : null;
  };

  const comparisons = [
    { label: '3 months ago', record: findClosest(ago(3)) },
    { label: '6 months ago', record: findClosest(ago(6)) },
    { label: '12 months ago', record: findClosest(ago(12)) },
  ];

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Body Measurements</h2>
          <button className="add-btn" onClick={onAdd}>+ Log Measurements</button>
        </div>
        {latest ? (
          <>
            <p style={{ fontSize: 13, color: '#5f6775', marginBottom: 16 }}>Latest: {fmt(latest.logged_at)}</p>
            <div className="comparison-grid">
              {MEASUREMENT_FIELDS.map(f => {
                const currentVal = latest[f.key];
                if (!currentVal) return null;
                return (
                  <div className="comparison-card" key={f.key}>
                    <div className="part">{f.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{currentVal}"</div>
                    {comparisons.map((c, i) => {
                      if (!c.record || !c.record[f.key]) return null;
                      const diff = (Number(currentVal) - Number(c.record[f.key])).toFixed(1);
                      return (
                        <div className="comparison-row" key={i}>
                          <span className="label">vs {c.label}</span>
                          <span style={{ fontWeight: 600, color: diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : '#5f6775' }}>
                            {diff > 0 ? '+' : ''}{diff}"
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state"><div className="icon">📏</div><p>No measurement data yet. Start tracking!</p></div>
        )}
      </div>
      {/* Trend chart for waist/chest if enough data */}
      {data.length > 1 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Measurement Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.map(d => ({ date: fmtShort(d.logged_at), ...MEASUREMENT_FIELDS.reduce((acc, f) => ({ ...acc, [f.label]: Number(d[f.key]) || null }), {}) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e6ec' }} />
              <Legend />
              {MEASUREMENT_FIELDS.map((f, i) => (
                <Line key={f.key} type="monotone" dataKey={f.label} stroke={['#4f6ef7', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Log History</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th>{MEASUREMENT_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th></th></tr></thead>
              <tbody>
                {[...data].reverse().map(row => (
                  <tr key={row.id}>
                    <td>{fmt(row.logged_at)}</td>
                    {MEASUREMENT_FIELDS.map(f => <td key={f.key}>{row[f.key] ? `${row[f.key]}"` : '—'}</td>)}
                    <td><button className="btn btn-sm btn-secondary" onClick={() => onDelete(row.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════
// SECTION: Workouts
// ═════════════════════════════════════════════════════════
function WorkoutsSection({ data, onAdd, onDelete }) {
  const totalWorkouts = data.length;
  const totalCalories = data.reduce((s, w) => s + (w.calories_burned || 0), 0);
  const totalDuration = data.reduce((s, w) => s + (w.duration_min || 0), 0);
  const typeBreakdown = data.reduce((acc, w) => { acc[w.workout_type] = (acc[w.workout_type] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({ name, value }));

  // Volume chart: total weight lifted per day (for strength)
  const volumeByDay = {};
  data.forEach(w => {
    if (w.sets && w.reps && w.weight_lbs) {
      const d = w.logged_at;
      volumeByDay[d] = (volumeByDay[d] || 0) + (w.sets * w.reps * Number(w.weight_lbs));
    }
  });
  const volumeChart = Object.entries(volumeByDay).sort().map(([date, vol]) => ({ date: fmtShort(date), volume: Math.round(vol) }));

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Workout Performance</h2>
          <button className="add-btn" onClick={onAdd}>+ Log Workout</button>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><div className="label">Total Sessions</div><div className="value">{totalWorkouts}</div></div>
          <div className="stat-card"><div className="label">Total Duration</div><div className="value">{totalDuration}</div><div className="label">min</div></div>
          <div className="stat-card"><div className="label">Calories Burned</div><div className="value">{totalCalories.toLocaleString()}</div></div>
          <div className="stat-card"><div className="label">Workout Types</div><div className="value">{Object.keys(typeBreakdown).length}</div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: pieData.length && volumeChart.length ? '200px 1fr' : '1fr', gap: 16, alignItems: 'center' }}>
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          {volumeChart.length > 1 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e6ec' }} formatter={(v) => [`${v.toLocaleString()} lbs`, 'Volume']} />
                <Bar dataKey="volume" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {!data.length && <div className="empty-state"><div className="icon">🏋️</div><p>No workouts logged yet. Get after it!</p></div>}
      </div>
      {data.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Workout Log</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Exercise</th><th>Sets×Reps</th><th>Weight</th><th>Duration</th><th>Calories</th><th></th></tr></thead>
              <tbody>
                {data.map(w => (
                  <tr key={w.id}>
                    <td>{fmt(w.logged_at)}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 12, background: '#eef1fe', color: '#4f6ef7', fontSize: 12, fontWeight: 600 }}>{w.workout_type}</span></td>
                    <td><strong>{w.exercise_name}</strong></td>
                    <td>{w.sets && w.reps ? `${w.sets}×${w.reps}` : '—'}</td>
                    <td>{w.weight_lbs ? `${w.weight_lbs} lbs` : '—'}</td>
                    <td>{w.duration_min ? `${w.duration_min} min` : '—'}</td>
                    <td>{w.calories_burned || '—'}</td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => onDelete(w.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════
// SECTION: Nutrition / Food Logs
// ═════════════════════════════════════════════════════════
function NutritionSection({ data, onAdd, onDelete }) {
  // Daily aggregation
  const dailyMap = {};
  data.forEach(f => {
    if (!dailyMap[f.logged_at]) dailyMap[f.logged_at] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, meals: [] };
    const d = dailyMap[f.logged_at];
    d.calories += f.calories || 0;
    d.protein += Number(f.protein_g) || 0;
    d.carbs += Number(f.carbs_g) || 0;
    d.fat += Number(f.fat_g) || 0;
    d.fiber += Number(f.fiber_g) || 0;
    d.meals.push(f);
  });
  const dailyData = Object.entries(dailyMap).sort().map(([date, d]) => ({ date: fmtShort(date), fullDate: date, ...d }));

  const totalCal = dailyData.reduce((s, d) => s + d.calories, 0);
  const avgCal = dailyData.length ? Math.round(totalCal / dailyData.length) : 0;
  const avgProtein = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length) : 0;
  const avgCarbs = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.carbs, 0) / dailyData.length) : 0;
  const avgFat = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.fat, 0) / dailyData.length) : 0;

  const macroTotal = avgProtein * 4 + avgCarbs * 4 + avgFat * 9;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Nutrition Overview</h2>
          <button className="add-btn" onClick={onAdd}>+ Log Food</button>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><div className="label">Avg Daily Cal</div><div className="value">{avgCal.toLocaleString()}</div></div>
          <div className="stat-card"><div className="label">Avg Protein</div><div className="value">{avgProtein}g</div></div>
          <div className="stat-card"><div className="label">Avg Carbs</div><div className="value">{avgCarbs}g</div></div>
          <div className="stat-card"><div className="label">Avg Fat</div><div className="value">{avgFat}g</div></div>
        </div>
        {/* Macro split pie */}
        {macroTotal > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={[
                  { name: 'Protein', value: avgProtein * 4 },
                  { name: 'Carbs', value: avgCarbs * 4 },
                  { name: 'Fat', value: avgFat * 9 },
                ]} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                  {PIE_COLORS.slice(0, 3).map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} cal`, 'Calories']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="macro-bar-wrap">
              {[{ label: 'Protein', val: avgProtein, max: 250, color: MACRO_COLORS.protein },
                { label: 'Carbs', val: avgCarbs, max: 400, color: MACRO_COLORS.carbs },
                { label: 'Fat', val: avgFat, max: 150, color: MACRO_COLORS.fat },
                { label: 'Fiber', val: Math.round(dailyData.length ? dailyData.reduce((s, d) => s + d.fiber, 0) / dailyData.length : 0), max: 50, color: MACRO_COLORS.fiber },
              ].map(m => (
                <div className="macro-bar-row" key={m.label}>
                  <div className="macro-bar-label">{m.label}</div>
                  <div className="macro-bar-track">
                    <div className="macro-bar-fill" style={{ width: `${Math.min(100, (m.val / m.max) * 100)}%`, background: m.color }} />
                  </div>
                  <div className="macro-bar-value">{m.val}g</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Calorie trend */}
        {dailyData.length > 1 && (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e6ec' }} />
              <Bar dataKey="calories" fill="#4f6ef7" radius={[4, 4, 0, 0]} name="Calories" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {!data.length && <div className="empty-state"><div className="icon">🍎</div><p>No food logs yet. Start tracking your meals!</p></div>}
      </div>
      {data.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Food Log</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Meal</th><th>Food</th><th>Cal</th><th>P</th><th>C</th><th>F</th><th></th></tr></thead>
              <tbody>
                {data.map(f => (
                  <tr key={f.id}>
                    <td>{fmt(f.logged_at)}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600 }}>{f.meal_type}</span></td>
                    <td><strong>{f.food_name}</strong></td>
                    <td>{f.calories || '—'}</td>
                    <td>{f.protein_g ? `${f.protein_g}g` : '—'}</td>
                    <td>{f.carbs_g ? `${f.carbs_g}g` : '—'}</td>
                    <td>{f.fat_g ? `${f.fat_g}g` : '—'}</td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => onDelete(f.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════
// SECTION: Progress Photos
// ═════════════════════════════════════════════════════════
function PhotosSection({ data, onAdd, onDelete }) {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h2>Progress Photos</h2>
          <button className="add-btn" onClick={onAdd}>+ Upload Photo</button>
        </div>
        {data.length ? (
          <div className="photo-grid">
            {data.map(p => (
              <div className="photo-card" key={p.id} onClick={() => setSelected(p)}>
                <img src={p.photo_url} alt={p.caption || 'Progress'} loading="lazy" />
                <div className="photo-info">
                  <div className="date">{fmt(p.logged_at)}</div>
                  {p.pose_type && <div className="pose">{p.pose_type}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="icon">📸</div><p>No progress photos yet. Upload your first!</p></div>
        )}
      </div>
      {/* Lightbox */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={selected.photo_url} alt={selected.caption || 'Progress'} style={{ width: '100%', borderRadius: 12, maxHeight: '80vh', objectFit: 'contain' }} />
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginTop: 12 }}>
              <p style={{ fontWeight: 600 }}>{fmt(selected.logged_at)} {selected.pose_type && `· ${selected.pose_type}`}</p>
              {selected.caption && <p style={{ color: '#5f6775', marginTop: 4 }}>{selected.caption}</p>}
              <div className="btn-group" style={{ justifyContent: 'center' }}>
                <button className="btn btn-sm btn-danger" onClick={() => { onDelete(selected.id); setSelected(null); }}>Delete</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════
// MODALS
// ═════════════════════════════════════════════════════════
function WeightModal({ onClose, onSave }) {
  const [form, setForm] = useState({ logged_at: today, weight_lbs: '', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Log Weight</h3>
        <div className="form-row">
          <div className="form-group"><label>Date</label><input type="date" value={form.logged_at} onChange={e => set('logged_at', e.target.value)} /></div>
          <div className="form-group"><label>Weight (lbs)</label><input type="number" step="0.1" placeholder="175.0" value={form.weight_lbs} onChange={e => set('weight_lbs', e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Notes</label><textarea placeholder="How are you feeling?" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        <div className="btn-group">
          <button className="btn btn-primary" disabled={!form.weight_lbs} onClick={() => onSave({ ...form, weight_lbs: Number(form.weight_lbs) })}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function MeasurementModal({ onClose, onSave }) {
  const [form, setForm] = useState({ logged_at: today, chest_in: '', waist_in: '', hips_in: '', bicep_left_in: '', bicep_right_in: '', thigh_left_in: '', thigh_right_in: '', neck_in: '', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toNum = (v) => v === '' ? null : Number(v);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Log Measurements</h3>
        <div className="form-group"><label>Date</label><input type="date" value={form.logged_at} onChange={e => set('logged_at', e.target.value)} /></div>
        <div className="form-row">
          {MEASUREMENT_FIELDS.map(f => (
            <div className="form-group" key={f.key}><label>{f.label} (in)</label><input type="number" step="0.1" placeholder="0.0" value={form[f.key]} onChange={e => set(f.key, e.target.value)} /></div>
          ))}
        </div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => {
            const d = { logged_at: form.logged_at, notes: form.notes };
            MEASUREMENT_FIELDS.forEach(f => { d[f.key] = toNum(form[f.key]); });
            onSave(d);
          }}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function WorkoutModal({ onClose, onSave }) {
  const [form, setForm] = useState({ logged_at: today, workout_type: 'Strength', exercise_name: '', sets: '', reps: '', weight_lbs: '', duration_min: '', distance_mi: '', calories_burned: '', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toNum = (v) => v === '' ? null : Number(v);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Log Workout</h3>
        <div className="form-row">
          <div className="form-group"><label>Date</label><input type="date" value={form.logged_at} onChange={e => set('logged_at', e.target.value)} /></div>
          <div className="form-group"><label>Type</label><select value={form.workout_type} onChange={e => set('workout_type', e.target.value)}>{WORKOUT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="form-group"><label>Exercise Name</label><input type="text" placeholder="Bench Press, Running, etc." value={form.exercise_name} onChange={e => set('exercise_name', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label>Sets</label><input type="number" value={form.sets} onChange={e => set('sets', e.target.value)} /></div>
          <div className="form-group"><label>Reps</label><input type="number" value={form.reps} onChange={e => set('reps', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Weight (lbs)</label><input type="number" step="0.1" value={form.weight_lbs} onChange={e => set('weight_lbs', e.target.value)} /></div>
          <div className="form-group"><label>Duration (min)</label><input type="number" value={form.duration_min} onChange={e => set('duration_min', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Distance (mi)</label><input type="number" step="0.01" value={form.distance_mi} onChange={e => set('distance_mi', e.target.value)} /></div>
          <div className="form-group"><label>Calories Burned</label><input type="number" value={form.calories_burned} onChange={e => set('calories_burned', e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        <div className="btn-group">
          <button className="btn btn-primary" disabled={!form.exercise_name} onClick={() => onSave({
            ...form, sets: toNum(form.sets), reps: toNum(form.reps), weight_lbs: toNum(form.weight_lbs),
            duration_min: toNum(form.duration_min), distance_mi: toNum(form.distance_mi), calories_burned: toNum(form.calories_burned)
          })}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function FoodModal({ onClose, onSave }) {
  const [form, setForm] = useState({ logged_at: today, meal_type: 'Breakfast', food_name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toNum = (v) => v === '' ? null : Number(v);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Log Food</h3>
        <div className="form-row">
          <div className="form-group"><label>Date</label><input type="date" value={form.logged_at} onChange={e => set('logged_at', e.target.value)} /></div>
          <div className="form-group"><label>Meal</label><select value={form.meal_type} onChange={e => set('meal_type', e.target.value)}>{MEAL_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="form-group"><label>Food Name</label><input type="text" placeholder="Grilled chicken breast" value={form.food_name} onChange={e => set('food_name', e.target.value)} /></div>
        <div className="form-row">
          <div className="form-group"><label>Calories</label><input type="number" placeholder="350" value={form.calories} onChange={e => set('calories', e.target.value)} /></div>
          <div className="form-group"><label>Protein (g)</label><input type="number" step="0.1" value={form.protein_g} onChange={e => set('protein_g', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Carbs (g)</label><input type="number" step="0.1" value={form.carbs_g} onChange={e => set('carbs_g', e.target.value)} /></div>
          <div className="form-group"><label>Fat (g)</label><input type="number" step="0.1" value={form.fat_g} onChange={e => set('fat_g', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Fiber (g)</label><input type="number" step="0.1" value={form.fiber_g} onChange={e => set('fiber_g', e.target.value)} /></div>
          <div className="form-group"></div>
        </div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        <div className="btn-group">
          <button className="btn btn-primary" disabled={!form.food_name} onClick={() => onSave({
            ...form, calories: toNum(form.calories), protein_g: toNum(form.protein_g), carbs_g: toNum(form.carbs_g),
            fat_g: toNum(form.fat_g), fiber_g: toNum(form.fiber_g)
          })}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PhotoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ logged_at: today, photo_url: '', pose_type: 'Front', caption: '' });
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('progress-photos').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
      set('photo_url', urlData.publicUrl);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Upload Progress Photo</h3>
        <div className="form-row">
          <div className="form-group"><label>Date</label><input type="date" value={form.logged_at} onChange={e => set('logged_at', e.target.value)} /></div>
          <div className="form-group"><label>Pose</label><select value={form.pose_type} onChange={e => set('pose_type', e.target.value)}>{POSE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="form-group">
          <label>Photo</label>
          <input type="file" accept="image/*" onChange={handleFileUpload} />
          {uploading && <p style={{ fontSize: 12, color: '#5f6775', marginTop: 4 }}>Uploading…</p>}
          {form.photo_url && <img src={form.photo_url} alt="preview" style={{ marginTop: 8, width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8 }} />}
        </div>
        <div className="form-group"><label>Or paste image URL</label><input type="url" placeholder="https://..." value={form.photo_url} onChange={e => set('photo_url', e.target.value)} /></div>
        <div className="form-group"><label>Caption</label><textarea placeholder="Week 4 check-in" value={form.caption} onChange={e => set('caption', e.target.value)} /></div>
        <div className="btn-group">
          <button className="btn btn-primary" disabled={!form.photo_url || uploading} onClick={() => onSave(form)}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
