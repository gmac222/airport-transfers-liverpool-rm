const { useState, useEffect, useMemo } = React;

// Quick currency formatter
const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const fmtUKDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw);
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB');
};
// Read a numeric field that might be a string
const num = (raw) => {
    if (typeof raw === 'number') return raw;
    if (raw == null) return 0;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
};

const RANGES = [
    { id: '7', label: 'Last 7 days', days: 7 },
    { id: '30', label: 'Last 30 days', days: 30 },
    { id: '90', label: 'Last 90 days', days: 90 },
    { id: 'ytd', label: 'Year to date', days: null },
    { id: 'all', label: 'All time', days: null }
];

function SuperAdmin() {
    const [authState, setAuthState] = useState('checking'); // 'checking' | 'login' | 'forbidden' | 'ok'
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [adminName, setAdminName] = useState('');

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [rangeId, setRangeId] = useState('30');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        const isSuper = localStorage.getItem('adminIsSuper') === 'true';
        if (token && isSuper) {
            setAdminName(localStorage.getItem('adminName') || '');
            setAuthState('ok');
            fetchBookings();
        } else if (token && !isSuper) {
            setAuthState('forbidden');
        } else {
            setAuthState('login');
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError('');
        const username = e.target.username.value.trim().toLowerCase();
        const password = e.target.password.value;
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!data.success) {
                setLoginError(data.error || 'Login failed');
                setIsLoggingIn(false);
                return;
            }
            if (!data.isSuperAdmin) {
                setLoginError('Your account does not have super admin access.');
                setIsLoggingIn(false);
                return;
            }
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminIsSuper', 'true');
            localStorage.setItem('adminName', data.adminName || username);
            setAdminName(data.adminName || username);
            setAuthState('ok');
            fetchBookings();
        } catch (err) {
            setLoginError('Network error');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminIsSuper');
        localStorage.removeItem('adminName');
        window.location.reload();
    };

    const fetchBookings = () => {
        setLoading(true);
        fetch('/api/booking?action=list', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setBookings(data.bookings || []);
                setLoading(false);
            })
            .catch(err => { setError(err.message); setLoading(false); });
    };

    // Filter bookings by selected range, using Outbound Date as the trip date
    const filtered = useMemo(() => {
        const range = RANGES.find(r => r.id === rangeId);
        if (!range || range.id === 'all') return bookings;
        const now = new Date();
        let cutoff;
        if (range.id === 'ytd') {
            cutoff = new Date(now.getFullYear(), 0, 1);
        } else {
            cutoff = new Date(now.getTime() - range.days * 24 * 60 * 60 * 1000);
        }
        return bookings.filter(b => {
            const d = new Date(b.fields['Outbound Date'] || b.fields['Submitted At'] || 0);
            return d >= cutoff;
        });
    }, [bookings, rangeId]);

    // Top-level stats
    const stats = useMemo(() => {
        let revenue = 0, cost = 0, profit = 0;
        let paidJobs = 0, paidRevenue = 0, paidProfit = 0;
        let upcomingProfit = 0;
        let pending = 0, awaitingConfirm = 0, awaitingPayment = 0, accepted = 0, declined = 0, completed = 0;
        const byOperator = {};
        const byAirport = {};
        const byMonth = {};
        const byDriver = {};
        const now = new Date();

        for (const b of filtered) {
            const f = b.fields;
            const customerPrice = num(f['Customer Price'] || f['Total Price']);
            const operatorPrice = num(f['Operator Price']);
            const jobProfit = f['Profit'] != null ? num(f['Profit']) : (customerPrice - operatorPrice);
            revenue += customerPrice;
            cost += operatorPrice;
            profit += jobProfit;

            const status = f['Status'] || 'Pending';
            if (status === 'Pending') pending++;
            else if (status === 'Awaiting Confirmation') awaitingConfirm++;
            else if (status === 'Awaiting Payment') awaitingPayment++;
            else if (status === 'Accepted') accepted++;
            else if (status === 'Declined') declined++;
            else if (status === 'Completed') completed++;

            const isPaid = (status === 'Accepted' || status === 'Completed');
            if (isPaid) {
                paidJobs++;
                paidRevenue += customerPrice;
                paidProfit += jobProfit;
            }
            const tripDate = new Date(f['Outbound Date'] || 0);
            if (tripDate > now && isPaid) upcomingProfit += jobProfit;

            const op = f['Operator'] || 'Unassigned';
            if (!byOperator[op]) byOperator[op] = { jobs: 0, revenue: 0, cost: 0, profit: 0 };
            byOperator[op].jobs += 1;
            byOperator[op].revenue += customerPrice;
            byOperator[op].cost += operatorPrice;
            byOperator[op].profit += jobProfit;

            const ap = f['Airport'] || 'Unknown';
            if (!byAirport[ap]) byAirport[ap] = { jobs: 0, profit: 0, revenue: 0 };
            byAirport[ap].jobs += 1;
            byAirport[ap].profit += jobProfit;
            byAirport[ap].revenue += customerPrice;

            const dKey = (f['Outbound Date'] || '').slice(0, 7) || 'unknown';
            if (!byMonth[dKey]) byMonth[dKey] = { jobs: 0, revenue: 0, profit: 0 };
            byMonth[dKey].jobs += 1;
            byMonth[dKey].revenue += customerPrice;
            byMonth[dKey].profit += jobProfit;

            const drv = f['Driver Name'] || 'Unassigned';
            if (!byDriver[drv]) byDriver[drv] = { jobs: 0, revenue: 0, profit: 0 };
            byDriver[drv].jobs += 1;
            byDriver[drv].revenue += customerPrice;
            byDriver[drv].profit += jobProfit;
        }

        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const aov = filtered.length ? revenue / filtered.length : 0;
        const decliners = pending + awaitingConfirm + awaitingPayment + declined;
        const conversionRate = filtered.length ? (paidJobs / filtered.length) * 100 : 0;

        return {
            jobs: filtered.length,
            revenue, cost, profit, margin, aov,
            paidJobs, paidRevenue, paidProfit, upcomingProfit,
            pending, awaitingConfirm, awaitingPayment, accepted, declined, completed,
            conversionRate, decliners,
            byOperator, byAirport, byMonth, byDriver
        };
    }, [filtered]);

    if (authState === 'checking') return null;

    if (authState === 'forbidden') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy-ink)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '16px', border: '1px solid var(--line)', width: '100%', maxWidth: '440px', textAlign: 'center' }}>
                    <h2 style={{ color: '#fff', fontFamily: 'Lexend' }}>Access Restricted</h2>
                    <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>This area is for super administrators only.</p>
                    <a href="/stats.html" className="btn" style={{ display: 'inline-block', marginTop: '8px' }}>Back to Stats</a>
                </div>
            </div>
        );
    }

    if (authState === 'login') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy-ink)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '16px', border: '1px solid var(--line)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', marginBottom: '24px' }} />
                    <h2 style={{ margin: '0 0 6px 0', color: '#fff', fontFamily: 'Lexend' }}>Super Admin</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 20px 0' }}>Finance &amp; performance dashboard</p>
                    {loginError && <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>{loginError}</div>}
                    <form onSubmit={handleLogin}>
                        <input type="text" name="username" placeholder="Username" required autoCapitalize="none" autoCorrect="off" />
                        <input type="password" name="password" placeholder="Password" required />
                        <button type="submit" disabled={isLoggingIn} className="btn" style={{ width: '100%', marginTop: '4px' }}>
                            {isLoggingIn ? 'Verifying…' : 'Enter'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading">Crunching numbers…</div>;
    if (error) return <div className="loading" style={{color: '#ff6b6b'}}>Error: {error}</div>;

    const sortedOperators = Object.entries(stats.byOperator).sort((a, b) => b[1].profit - a[1].profit);
    const sortedAirports = Object.entries(stats.byAirport).sort((a, b) => b[1].profit - a[1].profit);
    const sortedMonths = Object.entries(stats.byMonth).filter(([k]) => k !== 'unknown').sort();
    const sortedDrivers = Object.entries(stats.byDriver).filter(([k]) => k !== 'Unassigned').sort((a, b) => b[1].profit - a[1].profit).slice(0, 10);

    const cell = { padding: '12px 14px', borderBottom: '1px solid var(--line)' };
    const rightCell = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

    return (
        <div>
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '40px' }} />
                    <div>
                        <h1 style={{ margin: 0 }}>Super Admin</h1>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Logged in as {adminName}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <a href="/stats.html" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Stats</a>
                    <a href="/operator.html" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Dispatch</a>
                    <a href="/admin.html" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Admin</a>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                        Log Out
                    </button>
                </div>
            </div>

            <div className="wrap">
                {/* Range selector */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                    {RANGES.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setRangeId(r.id)}
                            style={{
                                padding: '8px 14px',
                                border: '1px solid ' + (rangeId === r.id ? 'var(--amber)' : 'rgba(255,255,255,0.1)'),
                                background: rangeId === r.id ? 'var(--amber)' : 'rgba(255,255,255,0.04)',
                                color: rangeId === r.id ? 'var(--navy-ink)' : '#fff',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                fontSize: '13px'
                            }}>
                            {r.label}
                        </button>
                    ))}
                    <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: '13px', marginLeft: '8px' }}>
                        {stats.jobs} bookings in window
                    </span>
                </div>

                {/* Hero finance cards */}
                <div className="grid-stats">
                    <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(76,175,80,0.12), rgba(76,175,80,0.03))', borderColor: 'rgba(76,175,80,0.25)' }}>
                        <div className="stat-title">Net Profit</div>
                        <div className="stat-value" style={{ color: '#7be88a' }}>{fmt(stats.profit)}</div>
                        <div className="stat-sub">{stats.margin.toFixed(1)}% margin · Customer − Operator</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Customer Revenue</div>
                        <div className="stat-value">{fmt(stats.revenue)}</div>
                        <div className="stat-sub neutral">Sum of Customer Price across all bookings</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Operator Cost</div>
                        <div className="stat-value">{fmt(stats.cost)}</div>
                        <div className="stat-sub neutral">What we pay subcontractors</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Avg. Order Value</div>
                        <div className="stat-value">{fmt(stats.aov)}</div>
                        <div className="stat-sub neutral">Across {stats.jobs} bookings</div>
                    </div>
                </div>

                {/* Booked vs paid */}
                <div className="grid-stats" style={{ marginTop: '20px' }}>
                    <div className="stat-card">
                        <div className="stat-title">Paid Profit</div>
                        <div className="stat-value">{fmt(stats.paidProfit)}</div>
                        <div className="stat-sub">{stats.paidJobs} jobs paid for</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Upcoming Profit</div>
                        <div className="stat-value">{fmt(stats.upcomingProfit)}</div>
                        <div className="stat-sub neutral">Paid &amp; future-dated</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Conversion Rate</div>
                        <div className="stat-value">{stats.conversionRate.toFixed(1)}%</div>
                        <div className="stat-sub neutral">Bookings that became paid jobs</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-title">Pipeline</div>
                        <div className="stat-value" style={{ fontSize: '24px', lineHeight: 1.4 }}>
                            {stats.pending}<span style={{fontSize:'13px',color:'var(--muted)'}}> pending</span><br/>
                            {stats.awaitingConfirm}<span style={{fontSize:'13px',color:'var(--muted)'}}> quoted</span> · {stats.awaitingPayment}<span style={{fontSize:'13px',color:'var(--muted)'}}> awaiting £</span>
                        </div>
                        <div className="stat-sub neutral">{stats.declined} declined</div>
                    </div>
                </div>

                {/* Per-operator profit breakdown */}
                <div className="recent-jobs" style={{ marginTop: '40px', padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '20px 24px 0', fontSize: '18px' }}>Profit by Operator</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                                <th style={{ ...cell, textAlign: 'left' }}>Operator</th>
                                <th style={{ ...rightCell }}>Jobs</th>
                                <th style={{ ...rightCell }}>Revenue</th>
                                <th style={{ ...rightCell }}>Cost</th>
                                <th style={{ ...rightCell }}>Profit</th>
                                <th style={{ ...rightCell }}>Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedOperators.length === 0 && (
                                <tr><td colSpan="6" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No data in this range.</td></tr>
                            )}
                            {sortedOperators.map(([name, s]) => {
                                const m = s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0;
                                return (
                                    <tr key={name}>
                                        <td style={{ ...cell }}>{name}</td>
                                        <td style={rightCell}>{s.jobs}</td>
                                        <td style={rightCell}>{fmt(s.revenue)}</td>
                                        <td style={rightCell}>{fmt(s.cost)}</td>
                                        <td style={{ ...rightCell, color: s.profit >= 0 ? '#7be88a' : '#ff6b6b', fontWeight: 700 }}>{fmt(s.profit)}</td>
                                        <td style={rightCell}>{m.toFixed(1)}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Per-airport profit breakdown */}
                <div className="recent-jobs" style={{ marginTop: '20px', padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '20px 24px 0', fontSize: '18px' }}>Profit by Airport</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                                <th style={{ ...cell, textAlign: 'left' }}>Airport</th>
                                <th style={rightCell}>Jobs</th>
                                <th style={rightCell}>Revenue</th>
                                <th style={rightCell}>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAirports.length === 0 && (
                                <tr><td colSpan="4" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No data in this range.</td></tr>
                            )}
                            {sortedAirports.map(([name, s]) => (
                                <tr key={name}>
                                    <td style={cell}>{name}</td>
                                    <td style={rightCell}>{s.jobs}</td>
                                    <td style={rightCell}>{fmt(s.revenue)}</td>
                                    <td style={{ ...rightCell, color: s.profit >= 0 ? '#7be88a' : '#ff6b6b', fontWeight: 700 }}>{fmt(s.profit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Monthly profit timeline */}
                <div className="recent-jobs" style={{ marginTop: '20px', padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '20px 24px 0', fontSize: '18px' }}>Monthly Profit (by Outbound Date)</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                                <th style={{ ...cell, textAlign: 'left' }}>Month</th>
                                <th style={rightCell}>Jobs</th>
                                <th style={rightCell}>Revenue</th>
                                <th style={rightCell}>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedMonths.length === 0 && (
                                <tr><td colSpan="4" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No data in this range.</td></tr>
                            )}
                            {sortedMonths.map(([k, s]) => (
                                <tr key={k}>
                                    <td style={cell}>{k}</td>
                                    <td style={rightCell}>{s.jobs}</td>
                                    <td style={rightCell}>{fmt(s.revenue)}</td>
                                    <td style={{ ...rightCell, color: s.profit >= 0 ? '#7be88a' : '#ff6b6b', fontWeight: 700 }}>{fmt(s.profit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Top drivers by profit */}
                <div className="recent-jobs" style={{ marginTop: '20px', padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '20px 24px 0', fontSize: '18px' }}>Top Drivers (by Profit)</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                                <th style={{ ...cell, textAlign: 'left' }}>Driver</th>
                                <th style={rightCell}>Jobs</th>
                                <th style={rightCell}>Revenue</th>
                                <th style={rightCell}>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedDrivers.length === 0 && (
                                <tr><td colSpan="4" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No driver data in this range.</td></tr>
                            )}
                            {sortedDrivers.map(([name, s]) => (
                                <tr key={name}>
                                    <td style={cell}>{name}</td>
                                    <td style={rightCell}>{s.jobs}</td>
                                    <td style={rightCell}>{fmt(s.revenue)}</td>
                                    <td style={{ ...rightCell, color: s.profit >= 0 ? '#7be88a' : '#ff6b6b', fontWeight: 700 }}>{fmt(s.profit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Per-job table — full transparency */}
                <div className="recent-jobs" style={{ marginTop: '20px', padding: 0, overflow: 'hidden' }}>
                    <h2 style={{ padding: '20px 24px 0', fontSize: '18px' }}>All Bookings — Per-Job P&amp;L</h2>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '13px', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                                    <th style={{ ...cell, textAlign: 'left' }}>Ref</th>
                                    <th style={{ ...cell, textAlign: 'left' }}>Customer</th>
                                    <th style={{ ...cell, textAlign: 'left' }}>Date</th>
                                    <th style={{ ...cell, textAlign: 'left' }}>Operator</th>
                                    <th style={{ ...cell, textAlign: 'left' }}>Status</th>
                                    <th style={rightCell}>Customer £</th>
                                    <th style={rightCell}>Operator £</th>
                                    <th style={rightCell}>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan="8" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No bookings in this range.</td></tr>
                                )}
                                {[...filtered].sort((a, b) => new Date(b.fields['Outbound Date'] || 0) - new Date(a.fields['Outbound Date'] || 0)).map(b => {
                                    const f = b.fields;
                                    const cp = num(f['Customer Price'] || f['Total Price']);
                                    const op = num(f['Operator Price']);
                                    const p = f['Profit'] != null ? num(f['Profit']) : (cp - op);
                                    return (
                                        <tr key={b.id}>
                                            <td style={{ ...cell, color: 'var(--amber)', fontWeight: 600 }}>{f['Booking Ref']}</td>
                                            <td style={cell}>{f['Customer Name'] || '—'}</td>
                                            <td style={cell}>{fmtUKDate(f['Outbound Date'])}</td>
                                            <td style={cell}>{f['Operator'] || '—'}</td>
                                            <td style={cell}>{f['Status'] || 'Pending'}</td>
                                            <td style={rightCell}>{cp ? fmt(cp) : '—'}</td>
                                            <td style={rightCell}>{op ? fmt(op) : '—'}</td>
                                            <td style={{ ...rightCell, color: p > 0 ? '#7be88a' : p < 0 ? '#ff6b6b' : 'var(--muted)', fontWeight: 700 }}>{cp || op ? fmt(p) : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SuperAdmin />);
