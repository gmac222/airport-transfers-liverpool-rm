const { useState, useEffect, useMemo } = React;

function DriverPortal() {
    // Auth state
    const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('driverLoggedIn') === 'true');
    const [driverName, setDriverName] = useState(localStorage.getItem('driverName') || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Data state
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [view, setView] = useState('list'); // list | calendar
    const [filter, setFilter] = useState('upcoming'); // upcoming | today | week | all | completed
    const [search, setSearch] = useState('');
    const [sortDir, setSortDir] = useState('asc'); // asc | desc
    const [selectedJob, setSelectedJob] = useState(null);
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [calSelectedDate, setCalSelectedDate] = useState(null);

    // Login
    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError('');
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, portal: 'driver' })
        })
        .then(r => r.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            localStorage.setItem('driverLoggedIn', 'true');
            localStorage.setItem('driverName', data.driverName || username);
            setDriverName(data.driverName || username);
            setIsLoggedIn(true);
        })
        .catch(err => setLoginError(err.message))
        .finally(() => setIsLoggingIn(false));
    };

    const handleLogout = () => {
        localStorage.removeItem('driverLoggedIn');
        localStorage.removeItem('driverName');
        setDriverName('');
        setIsLoggedIn(false);
    };

    // Fetch bookings
    const fetchBookings = () => {
        fetch('/api/booking?action=list&view=driver', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setBookings(data.bookings || []);
                setLoading(false);
            })
            .catch(err => { console.error(err); setLoading(false); });
    };

    useEffect(() => {
        if (isLoggedIn) {
            fetchBookings();
            const iv = setInterval(fetchBookings, 60000);
            return () => clearInterval(iv);
        }
    }, [isLoggedIn]);

    // Filter to only this driver's jobs
    const myJobs = useMemo(() => {
        return bookings.filter(b => {
            const dn = (b.fields['Driver Name'] || '').toLowerCase().trim();
            return dn === driverName.toLowerCase().trim();
        });
    }, [bookings, driverName]);

    // Date helpers
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getJobDate = (b) => {
        const d = b.fields['Outbound Date'];
        const t = b.fields['Outbound Time'] || '00:00';
        return d ? new Date(d + 'T' + t) : null;
    };

    const getUrgency = (b) => {
        const jd = getJobDate(b);
        if (!jd) return 'future';
        const now = new Date();
        const diffHrs = (jd - now) / (1000 * 60 * 60);
        if (diffHrs < 0 || diffHrs < 6) return 'urgent';
        if (diffHrs < 48) return 'soon';
        return 'future';
    };

    const isToday = (d) => {
        const t = new Date();
        return d && d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    };

    const isThisWeek = (d) => {
        if (!d) return false;
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        return d >= now && d <= endOfWeek;
    };

    // Filtered + sorted jobs
    const filteredJobs = useMemo(() => {
        let jobs = [...myJobs];

        // Filter by tab
        if (filter === 'upcoming') {
            jobs = jobs.filter(b => !['Completed', 'Archived', 'Cancelled'].includes(b.fields['Status']));
        } else if (filter === 'today') {
            jobs = jobs.filter(b => {
                const jd = getJobDate(b);
                return jd && isToday(jd);
            });
        } else if (filter === 'week') {
            jobs = jobs.filter(b => {
                const jd = getJobDate(b);
                return jd && isThisWeek(jd);
            });
        } else if (filter === 'completed') {
            jobs = jobs.filter(b => ['Completed', 'Archived'].includes(b.fields['Status']));
        }

        // Calendar date filter
        if (view === 'calendar' && calSelectedDate) {
            jobs = jobs.filter(b => {
                const jd = getJobDate(b);
                return jd && jd.getFullYear() === calSelectedDate.getFullYear() && jd.getMonth() === calSelectedDate.getMonth() && jd.getDate() === calSelectedDate.getDate();
            });
        }

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            jobs = jobs.filter(b => {
                const f = b.fields;
                return (f['Booking Ref'] || '').toLowerCase().includes(q) ||
                       (f['Customer Name'] || '').toLowerCase().includes(q) ||
                       (f['Home Address'] || '').toLowerCase().includes(q) ||
                       (f['Airport'] || '').toLowerCase().includes(q);
            });
        }

        // Sort
        jobs.sort((a, b) => {
            const da = getJobDate(a) || new Date(0);
            const db = getJobDate(b) || new Date(0);
            return sortDir === 'asc' ? da - db : db - da;
        });

        return jobs;
    }, [myJobs, filter, search, sortDir, view, calSelectedDate]);

    // Stats
    const stats = useMemo(() => {
        const active = myJobs.filter(b => !['Completed', 'Archived', 'Cancelled'].includes(b.fields['Status']));
        const todayJobs = myJobs.filter(b => { const jd = getJobDate(b); return jd && isToday(jd); });
        const weekJobs = myJobs.filter(b => { const jd = getJobDate(b); return jd && isThisWeek(jd); });
        const completed = myJobs.filter(b => b.fields['Status'] === 'Completed');
        return { active: active.length, today: todayJobs.length, week: weekJobs.length, completed: completed.length };
    }, [myJobs]);

    // Calendar data
    const calDays = useMemo(() => {
        const first = new Date(calYear, calMonth, 1);
        const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1; // Monday start
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const daysInPrev = new Date(calYear, calMonth, 0).getDate();
        const days = [];

        // Previous month padding
        for (let i = startDay - 1; i >= 0; i--) {
            days.push({ day: daysInPrev - i, month: calMonth - 1, year: calYear, other: true });
        }
        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            days.push({ day: d, month: calMonth, year: calYear, other: false });
        }
        // Next month padding
        const remaining = 42 - days.length;
        for (let d = 1; d <= remaining; d++) {
            days.push({ day: d, month: calMonth + 1, year: calYear, other: true });
        }
        return days;
    }, [calMonth, calYear]);

    const jobsByDate = useMemo(() => {
        const map = {};
        myJobs.forEach(b => {
            const jd = getJobDate(b);
            if (jd) {
                const key = `${jd.getFullYear()}-${jd.getMonth()}-${jd.getDate()}`;
                map[key] = (map[key] || 0) + 1;
            }
        });
        return map;
    }, [myJobs]);

    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const formatDate = (d) => {
        if (!d) return '—';
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    // ─── Login Screen ─────────────────────────────
    if (!isLoggedIn) {
        return (
            <div className="login-wrap">
                <div className="login-card">
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', filter: 'brightness(0) invert(1)' }} />
                    <h1>Driver Portal</h1>
                    <p>Sign in to view your upcoming jobs</p>
                    {loginError && <div className="login-error">{loginError}</div>}
                    <form onSubmit={handleLogin}>
                        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
                        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                        <button type="submit" className="btn-login" disabled={isLoggingIn}>{isLoggingIn ? 'Signing in...' : 'Sign In'}</button>
                    </form>
                </div>
            </div>
        );
    }

    // ─── Main Dashboard ─────────────────────────────
    return (
        <div>
            {/* Header */}
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src="./assets/logo.png" alt="RM" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
                    <div>
                        <h1>My Jobs</h1>
                        <div className="sub">Welcome back, {driverName}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => fetchBookings()} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>↻ Refresh</button>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>Log Out</button>
                </div>
            </div>

            <div className="wrap">
                {/* Stats */}
                <div className="stats-bar">
                    <div className="stat-card" onClick={() => { setFilter('today'); setView('list'); }} style={{ cursor: 'pointer' }}>
                        <div className="stat-num" style={{ color: stats.today > 0 ? 'var(--danger)' : 'var(--ink)' }}>{stats.today}</div>
                        <div className="stat-label">Today</div>
                    </div>
                    <div className="stat-card" onClick={() => { setFilter('week'); setView('list'); }} style={{ cursor: 'pointer' }}>
                        <div className="stat-num" style={{ color: 'var(--warn)' }}>{stats.week}</div>
                        <div className="stat-label">This Week</div>
                    </div>
                    <div className="stat-card" onClick={() => { setFilter('upcoming'); setView('list'); }} style={{ cursor: 'pointer' }}>
                        <div className="stat-num" style={{ color: 'var(--navy)' }}>{stats.active}</div>
                        <div className="stat-label">Active</div>
                    </div>
                    <div className="stat-card" onClick={() => { setFilter('completed'); setView('list'); }} style={{ cursor: 'pointer' }}>
                        <div className="stat-num" style={{ color: 'var(--ok)' }}>{stats.completed}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="tabs">
                    <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => { setView('list'); setCalSelectedDate(null); }}>
                        📋 List View
                    </button>
                    <button className={`tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
                        📅 Calendar
                    </button>
                </div>

                {/* Filter chips (list view) */}
                {view === 'list' && (
                    <div className="filter-bar">
                        {[
                            { key: 'upcoming', label: 'Upcoming' },
                            { key: 'today', label: 'Today' },
                            { key: 'week', label: 'This Week' },
                            { key: 'all', label: 'All Jobs' },
                            { key: 'completed', label: 'Completed' }
                        ].map(f => (
                            <button key={f.key} className={`filter-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                                {f.label}
                            </button>
                        ))}
                        <input type="text" placeholder="Search ref, customer, address..." value={search} onChange={e => setSearch(e.target.value)} />
                        <button className="filter-chip" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} title="Toggle sort order">
                            {sortDir === 'asc' ? '↑ Earliest first' : '↓ Latest first'}
                        </button>
                    </div>
                )}

                {/* Calendar View */}
                {view === 'calendar' && (
                    <div className="cal-card">
                        <div className="cal-nav">
                            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } }}>← Prev</button>
                            <h3>{months[calMonth]} {calYear}</h3>
                            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } }}>Next →</button>
                        </div>
                        <div className="calendar-grid">
                            {dayNames.map(d => <div key={d} className="cal-h">{d}</div>)}
                            {calDays.map((cd, i) => {
                                const dateKey = `${cd.year}-${cd.month}-${cd.day}`;
                                const jobCount = jobsByDate[dateKey] || 0;
                                const isT = !cd.other && cd.day === today.getDate() && cd.month === today.getMonth() && cd.year === today.getFullYear();
                                const isSel = calSelectedDate && !cd.other && cd.day === calSelectedDate.getDate() && cd.month === calSelectedDate.getMonth() && cd.year === calSelectedDate.getFullYear();
                                return (
                                    <div key={i} className={`cal-day ${cd.other ? 'other' : ''} ${isT ? 'today' : ''} ${isSel ? 'selected' : ''}`}
                                        onClick={() => {
                                            if (!cd.other) {
                                                const d = new Date(cd.year, cd.month, cd.day);
                                                setCalSelectedDate(calSelectedDate && d.getTime() === calSelectedDate.getTime() ? null : d);
                                                setFilter('all');
                                            }
                                        }}>
                                        {cd.day}
                                        {jobCount > 0 && !cd.other && <div className={`cal-dot ${jobCount > 2 ? 'many' : ''}`}></div>}
                                    </div>
                                );
                            })}
                        </div>
                        {calSelectedDate && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--navy)' }}>
                                Showing jobs for {formatDate(calSelectedDate)}
                                <button onClick={() => setCalSelectedDate(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Clear</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Job list */}
                {loading ? (
                    <div className="loading-spinner">Loading your jobs...</div>
                ) : filteredJobs.length === 0 ? (
                    <div className="empty">
                        <div className="icon">{view === 'calendar' && calSelectedDate ? '📅' : filter === 'completed' ? '✅' : '🚗'}</div>
                        <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                            {view === 'calendar' && calSelectedDate ? 'No jobs on this date' : filter === 'completed' ? 'No completed jobs yet' : 'No upcoming jobs'}
                        </p>
                        <p style={{ fontSize: '14px' }}>
                            {filter === 'today' ? "You're free today — enjoy the break!" : 'Check back soon for new assignments.'}
                        </p>
                    </div>
                ) : (
                    <div className="job-list">
                        {filteredJobs.map(b => {
                            const f = b.fields;
                            const jd = getJobDate(b);
                            const urg = getUrgency(b);
                            const status = f['Status'] || 'Pending';
                            const statusClass = status === 'Completed' || status === 'Archived' ? 's-completed' : status === 'Accepted' ? 's-accepted' : 's-pending';

                            return (
                                <div key={b.id} className={`job-card ${urg}`} onClick={() => setSelectedJob(b)}>
                                    <div className="job-date-block">
                                        {jd ? (
                                            <>
                                                <div className="day">{jd.getDate()}</div>
                                                <div className="month">{jd.toLocaleDateString('en-GB', { month: 'short' })}</div>
                                                <div className="time">{f['Outbound Time'] || ''}</div>
                                            </>
                                        ) : (
                                            <div className="day" style={{ fontSize: '14px' }}>TBC</div>
                                        )}
                                    </div>
                                    <div className="job-details">
                                        <h3>{f['Customer Name'] || 'Unknown Customer'}</h3>
                                        <div className="route">
                                            <span>{f['Home Address'] || '—'}</span>
                                            <span>→</span>
                                            <span>{f['Airport'] || '—'}</span>
                                        </div>
                                        <div className="meta">
                                            <span>📋 {f['Booking Ref'] || '—'}</span>
                                            <span>👥 {f['Passengers'] || 1} pax</span>
                                            <span>🧳 {f['Luggage'] || 0} bags</span>
                                            {f['Trip Type'] === 'return' && <span>🔄 Return</span>}
                                        </div>
                                    </div>
                                    <div className="job-actions">
                                        <span className={`job-status ${statusClass}`}>{status}</span>
                                        {status === 'Accepted' && (
                                            <a href={`/driver-action.html?ref=${f['Booking Ref']}`}
                                               className="btn-action btn-gold"
                                               onClick={e => e.stopPropagation()}
                                               style={{ marginTop: '6px', fontSize: '12px' }}>
                                                🚗 Start Job
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Job Detail Modal */}
            {selectedJob && (
                <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-head">
                            <div>
                                <h2>{selectedJob.fields['Booking Ref']}</h2>
                                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                                    {selectedJob.fields['Status'] || 'Pending'}
                                </div>
                            </div>
                            <button onClick={() => setSelectedJob(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>✕</button>
                        </div>
                        <div className="modal-body">
                            {[
                                ['Customer', selectedJob.fields['Customer Name']],
                                ['Phone', selectedJob.fields['Customer Phone']],
                                ['Pickup Address', selectedJob.fields['Home Address']],
                                ['Airport', selectedJob.fields['Airport']],
                                ['Outbound', `${selectedJob.fields['Outbound Date'] || '—'} at ${selectedJob.fields['Outbound Time'] || '—'}`],
                                ['Outbound Flight', selectedJob.fields['Outbound Flight']],
                                selectedJob.fields['Trip Type'] === 'return' ? ['Return', `${selectedJob.fields['Return Date'] || '—'} at ${selectedJob.fields['Return Time'] || '—'}`] : null,
                                selectedJob.fields['Trip Type'] === 'return' ? ['Return Flight', selectedJob.fields['Return Flight']] : null,
                                ['Direction', selectedJob.fields['Oneway Direction'] === 'from' ? 'From Airport' : selectedJob.fields['Oneway Direction'] === 'to' ? 'To Airport' : selectedJob.fields['Trip Type'] === 'return' ? 'Return Trip' : '—'],
                                ['Passengers', selectedJob.fields['Passengers']],
                                ['Luggage', selectedJob.fields['Luggage']],
                                ['Notes', selectedJob.fields['Notes']]
                            ].filter(Boolean).map(([lbl, val], i) => (
                                <div key={i} className="d-row">
                                    <span className="lbl">{lbl}</span>
                                    <span className="val">{val || '—'}</span>
                                </div>
                            ))}
                        </div>
                        <div className="modal-foot">
                            {selectedJob.fields['Customer Phone'] && (
                                <a href={`tel:${selectedJob.fields['Customer Phone']}`} className="btn-action btn-gold" style={{ flex: 1, justifyContent: 'center' }}>
                                    📞 Call Customer
                                </a>
                            )}
                            {selectedJob.fields['Status'] === 'Accepted' && (
                                <a href={`/driver-action.html?ref=${selectedJob.fields['Booking Ref']}`} className="btn-action btn-gold" style={{ flex: 1, justifyContent: 'center' }}>
                                    🚗 Start Job
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<DriverPortal />);
