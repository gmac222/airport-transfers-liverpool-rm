import { useEffect, useMemo, useState, useCallback } from 'react';
import { listBookings } from '../api.js';
import JobCard from '../components/JobCard.jsx';
import JobSheet from '../components/JobSheet.jsx';
import BottomNav from '../components/BottomNav.jsx';
import {
  getJobDate, isToday, isThisWeek, formatDateLong
} from '../utils/dates.js';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Done' }
];

export default function JobsScreen({ driverName, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await listBookings();
      setBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const myJobs = useMemo(
    () => bookings.filter((b) => {
      const dn = (b.fields['Driver Name'] || '').toLowerCase().trim();
      return dn === driverName.toLowerCase().trim();
    }),
    [bookings, driverName]
  );

  const filtered = useMemo(() => {
    let jobs = [...myJobs];
    if (tab === 'today') {
      jobs = jobs.filter((b) => { const jd = getJobDate(b); return jd && isToday(jd); });
    } else if (tab === 'upcoming') {
      jobs = jobs.filter((b) => !['Completed', 'Archived', 'Cancelled'].includes(b.fields['Status']));
    } else if (tab === 'completed') {
      jobs = jobs.filter((b) => ['Completed', 'Archived'].includes(b.fields['Status']));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter((b) => {
        const f = b.fields;
        return (
          (f['Booking Ref'] || '').toLowerCase().includes(q) ||
          (f['Customer Name'] || '').toLowerCase().includes(q) ||
          (f['Home Address'] || '').toLowerCase().includes(q) ||
          (f['Airport'] || '').toLowerCase().includes(q)
        );
      });
    }
    jobs.sort((a, b) => (getJobDate(a) || 0) - (getJobDate(b) || 0));
    return jobs;
  }, [myJobs, tab, search]);

  const stats = useMemo(() => ({
    today: myJobs.filter((b) => { const jd = getJobDate(b); return jd && isToday(jd); }).length,
    week: myJobs.filter((b) => { const jd = getJobDate(b); return jd && isThisWeek(jd); }).length,
    active: myJobs.filter((b) => !['Completed', 'Archived', 'Cancelled'].includes(b.fields['Status'])).length
  }), [myJobs]);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="hello">Hi, {driverName.split(' ')[0]}</div>
          <div className="sub">{formatDateLong(new Date())}</div>
        </div>
        <button className="icon-btn" onClick={() => fetchData()} aria-label="Refresh">
          {refreshing ? '…' : '↻'}
        </button>
      </header>

      <div className="hero-stats">
        <Stat n={stats.today} label="Today" tone={stats.today ? 'danger' : 'ink'} />
        <Stat n={stats.week} label="Week" tone="warn" />
        <Stat n={stats.active} label="Active" tone="navy" />
      </div>

      <div className="search-row">
        <input
          type="search"
          placeholder="Search ref, name, place…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="seg">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`seg-btn ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="list">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">🚗</div>
            <p><strong>{tab === 'today' ? 'Nothing today' : 'No jobs'}</strong></p>
            <p className="muted">Pull down or tap ↻ to refresh.</p>
          </div>
        ) : (
          filtered.map((b) => (
            <JobCard key={b.id} booking={b} onTap={() => setSelected(b)} />
          ))
        )}
      </main>

      <BottomNav onLogout={onLogout} />

      {selected && (
        <JobSheet
          booking={selected}
          onClose={() => setSelected(null)}
          onAfterAction={() => { setSelected(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function Stat({ n, label, tone }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}
