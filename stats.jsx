const { useState, useEffect } = React;

function StatsDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            setIsAuthenticated(true);
            fetchBookings();
        } else {
            setLoading(false);
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
            
            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                setIsAuthenticated(true);
                fetchBookings();
            } else {
                setLoginError(data.error || 'Login failed');
            }
        } catch (err) {
            setLoginError('Network error');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        window.location.reload();
    };

    const fetchBookings = () => {
        fetch('/api/booking?action=list', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setBookings(data.bookings || []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    };

    if (!isAuthenticated) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy-ink)' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '16px', border: '1px solid var(--line)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', marginBottom: '30px' }} />
                    <h2 style={{ margin: '0 0 20px 0', color: '#fff', fontFamily: 'Lexend' }}>Business Stats</h2>
                    {loginError && <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>{loginError}</div>}
                    <form onSubmit={handleLogin}>
                        <input type="text" name="username" placeholder="Username" required />
                        <input type="password" name="password" placeholder="Password" required />
                        <button type="submit" disabled={isLoggingIn} className="btn" style={{ width: '100%', marginTop: '10px' }}>
                            {isLoggingIn ? 'Verifying...' : 'Access Stats'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) return <div className="loading">Loading business metrics...</div>;
    if (error) return <div className="loading" style={{color: '#ff6b6b'}}>Error: {error}</div>;

    // Calculate Stats
    const totalLeads = bookings.length;
    
    let totalRevenue = 0;
    let upcomingRevenue = 0;
    let completedJobs = 0;
    let pendingJobs = 0;

    const now = new Date();

    bookings.forEach(b => {
        const priceStr = b.fields['Total Price'] || '0';
        const price = parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;
        
        totalRevenue += price;

        const dateStr = b.fields['Outbound Date'] || '9999-12-31';
        const tripDate = new Date(dateStr);

        if (tripDate > now) {
            upcomingRevenue += price;
        }

        if (b.fields['Driver Name']) {
            if (tripDate < now) {
                completedJobs++;
            }
        }

        if (!b.fields['Driver Name']) {
            pendingJobs++;
        }
    });

    const recentBookings = [...bookings].sort((a, b) => {
        const dateA = new Date(a.fields['Submitted At'] || 0);
        const dateB = new Date(b.fields['Submitted At'] || 0);
        return dateB - dateA;
    }).slice(0, 5); // top 5 newest

    return (
        <div>
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '40px' }} />
                    <h1>Executive Dashboard</h1>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <a href="/admin.html" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Dispatch Portal</a>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                        Log Out
                    </button>
                </div>
            </div>
            
            <div className="wrap">
                <div className="grid-stats">
                    <div className="stat-card">
                        <div className="stat-title">Total Bookings (Leads)</div>
                        <div className="stat-value">{totalLeads}</div>
                        <div className="stat-sub">Lifetime leads captured</div>
                    </div>
                    
                    <div className="stat-card">
                        <div className="stat-title">Total Revenue</div>
                        <div className="stat-value">£{totalRevenue.toLocaleString()}</div>
                        <div className="stat-sub">Total lifetime booking value</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-title">Upcoming Revenue</div>
                        <div className="stat-value">£{upcomingRevenue.toLocaleString()}</div>
                        <div className="stat-sub neutral">Future booked value</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-title">Dispatch Status</div>
                        <div className="stat-value" style={{ fontSize: '32px', marginTop: '6px' }}>
                            {pendingJobs} <span style={{fontSize: '18px', color: 'var(--amber)'}}>Pending</span>
                        </div>
                        <div className="stat-sub neutral" style={{ marginTop: 'auto' }}>
                            {completedJobs} trips fully completed
                        </div>
                    </div>
                </div>

                <div className="chart-placeholder">
                    📈 In-depth visual charts (Monthly Revenue, Airport Split) can be integrated here via Chart.js or Recharts in a future iteration.
                </div>

                <div className="recent-jobs">
                    <h2>Latest High-Value Bookings</h2>
                    <div className="job-row header-row">
                        <div>Ref / Date</div>
                        <div>Customer</div>
                        <div>Trip Type</div>
                        <div>Value</div>
                    </div>
                    {recentBookings.map(b => (
                        <div className="job-row" key={b.id}>
                            <div>
                                <strong style={{color: 'var(--amber)'}}>{b.fields['Booking Ref']}</strong><br/>
                                <span style={{color: 'var(--muted)', fontSize: '12px'}}>{new Date(b.fields['Submitted At']).toLocaleDateString('en-GB')}</span>
                            </div>
                            <div>
                                <strong>{b.fields['Customer Name']}</strong><br/>
                                <span style={{color: 'var(--muted)', fontSize: '12px'}}>{b.fields['Airport']}</span>
                            </div>
                            <div>
                                {b.fields['Trip Type'] === 'return' ? 'Return' : 'One Way'}
                            </div>
                            <div style={{ fontWeight: 'bold' }}>
                                £{b.fields['Total Price']}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<StatsDashboard />);
