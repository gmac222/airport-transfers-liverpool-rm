const { useState, useEffect, useCallback } = React;

const STORAGE_KEY = 'driverAuth';

function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const res = await fetch('/api/driver-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Login failed');
                setBusy(false);
                return;
            }
            onLogin(data.driver);
        } catch (err) {
            setError('Connection error. Try again.');
            setBusy(false);
        }
    };

    return (
        <div className="wrap">
            <a href="/" className="brand">
                <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '56px', filter: 'brightness(0) invert(1)' }} />
            </a>
            <div className="card">
                <div className="card-header">
                    <h1>Driver Portal</h1>
                    <p>Sign in to view your assigned jobs</p>
                </div>
                <div className="card-body">
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={submit}>
                        <label>Username</label>
                        <input
                            className="input"
                            type="text"
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <label>Password</label>
                        <input
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button type="submit" className="btn btn-primary" disabled={busy}>
                            {busy ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function JobCard({ job, onAction }) {
    const f = job.fields || {};
    const status = f['Status'] || 'Pending';
    const [busy, setBusy] = useState(null);

    const pillClass =
        status === 'Accepted' ? 'pill-accepted' :
        status === 'Paid' || status === 'Awaiting Payment' ? 'pill-paid' :
        'pill-pending';

    const handle = async (action, label) => {
        if (!confirm(`${label} for booking ${f['Booking Ref']}?`)) return;
        setBusy(action);
        try {
            const res = await fetch('/api/driver-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ref: f['Booking Ref'], action })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Action failed');
            onAction(`${label} sent`);
        } catch (err) {
            onAction(err.message || 'Action failed', true);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="job">
            <div className="job-head">
                <div className="job-ref">{f['Booking Ref']}</div>
                <div className={`pill ${pillClass}`}>{status}</div>
            </div>
            <div className="job-body">
                <div className="row"><div className="k">Date</div><div className="v">{f['Outbound Date']} at {f['Outbound Time']}</div></div>
                <div className="row"><div className="k">Customer</div><div className="v">{f['Customer Name']}</div></div>
                {f['Customer Phone'] && (
                    <div className="row"><div className="k">Phone</div><div className="v"><a href={`tel:${f['Customer Phone']}`} style={{color:'#fff'}}>{f['Customer Phone']}</a></div></div>
                )}
                <div className="row"><div className="k">Pickup</div><div className="v">{f['Home Address']}</div></div>
                <div className="row"><div className="k">Airport</div><div className="v">{f['Airport']}</div></div>
                <div className="row"><div className="k">Pax / Bags</div><div className="v">{f['Passengers'] || 0} / {f['Luggage'] || 0}</div></div>
                {f['Flight Number'] && (
                    <div className="row"><div className="k">Flight</div><div className="v">{f['Flight Number']}</div></div>
                )}
                {f['Notes'] && (
                    <div className="row"><div className="k">Notes</div><div className="v">{f['Notes']}</div></div>
                )}
                {f['Total Price'] && (
                    <div className="row"><div className="k">Price</div><div className="v">£{f['Total Price']}</div></div>
                )}
            </div>
            <div className="job-actions">
                <button
                    className="btn btn-secondary"
                    disabled={busy !== null}
                    onClick={() => handle('on-the-way', 'On the way SMS')}
                >
                    {busy === 'on-the-way' ? 'Sending…' : "🚗 On the way"}
                </button>
                <button
                    className="btn btn-secondary"
                    disabled={busy !== null}
                    onClick={() => handle('complete-job', 'Mark complete')}
                >
                    {busy === 'complete-job' ? 'Updating…' : "✓ Complete"}
                </button>
                <button
                    className="btn btn-primary full"
                    disabled={busy !== null}
                    onClick={() => handle('close-job', 'Close & archive')}
                >
                    {busy === 'close-job' ? 'Closing…' : '📁 Close Job & Archive'}
                </button>
            </div>
        </div>
    );
}

function JobsScreen({ driver, onLogout }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/driver-jobs?driver=${encodeURIComponent(driver.name)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load jobs');
            setJobs(data.jobs || []);
        } catch (err) {
            setError(err.message || 'Failed to load jobs');
        } finally {
            setLoading(false);
        }
    }, [driver.name]);

    useEffect(() => { load(); }, [load]);

    const showToast = (msg, isError) => {
        setToast({ msg, isError });
        setTimeout(() => setToast(null), 3000);
        // refresh after action so completed/archived disappear
        load();
    };

    return (
        <div className="wrap">
            <a href="/" className="brand">
                <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '48px', filter: 'brightness(0) invert(1)' }} />
            </a>

            <div className="topbar">
                <div className="who">
                    <span>Signed in as</span>
                    <strong>{driver.name}</strong>
                </div>
                <button className="btn btn-ghost" style={{ width: 'auto', padding: '0 16px' }} onClick={onLogout}>
                    Sign out
                </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Your Jobs</h2>
                <button className="btn btn-ghost" style={{ width: 'auto', padding: '0 14px' }} onClick={load} disabled={loading}>
                    {loading ? '…' : '↻ Refresh'}
                </button>
            </div>

            {loading && (
                <div className="card">
                    <div className="loading">
                        <div className="spinner"></div>
                        <span>Loading jobs…</span>
                    </div>
                </div>
            )}

            {!loading && error && (
                <div className="card"><div className="card-body"><div className="error-msg">{error}</div></div></div>
            )}

            {!loading && !error && jobs.length === 0 && (
                <div className="card">
                    <div className="empty">
                        <div className="big">🅿️</div>
                        <strong>No active jobs</strong>
                        <p style={{ margin: '6px 0 0', fontSize: 14 }}>You'll see jobs here as soon as the operator assigns them.</p>
                    </div>
                </div>
            )}

            {!loading && !error && jobs.length > 0 && (
                <div className="jobs">
                    {jobs.map(j => (
                        <JobCard key={j.id} job={j} onAction={showToast} />
                    ))}
                </div>
            )}

            {toast && (
                <div className="toast" style={{ background: toast.isError ? 'rgba(127,29,29,0.9)' : 'rgba(0,0,0,0.85)' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

function DriverApp() {
    const [driver, setDriver] = useState(null);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setDriver(JSON.parse(raw));
        } catch (e) { /* ignore */ }
        setHydrated(true);
    }, []);

    const handleLogin = (d) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
        setDriver(d);
    };

    const handleLogout = () => {
        localStorage.removeItem(STORAGE_KEY);
        setDriver(null);
    };

    if (!hydrated) return null;
    if (!driver) return <LoginScreen onLogin={handleLogin} />;
    return <JobsScreen driver={driver} onLogout={handleLogout} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<DriverApp />);
