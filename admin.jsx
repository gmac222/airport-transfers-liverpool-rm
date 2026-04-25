const { useState, useEffect } = React;

function AdminApp() {
    const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('adminLoggedIn') === 'true');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const [driverNames, setDriverNames] = useState({});

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError('');

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            localStorage.setItem('adminLoggedIn', 'true');
            setIsLoggedIn(true);
        })
        .catch(err => setLoginError(err.message))
        .finally(() => setIsLoggingIn(false));
    };

    const handleLogout = () => {
        localStorage.removeItem('adminLoggedIn');
        setIsLoggedIn(false);
    };

    const fetchBookings = () => {
        fetch('/api/booking?action=list', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setBookings(data.bookings);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        if (isLoggedIn) {
            fetchBookings();
        }
    }, [isLoggedIn]);

    const handleDriverNameChange = (id, name) => {
        setDriverNames(prev => ({ ...prev, [id]: name }));
    };

    const handleAssignDriver = (id) => {
        const driverName = driverNames[id];
        if (!driverName || driverName.trim() === '') return alert('Please enter a driver name');

        setAssigningId(id);

        fetch('/api/booking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                fields: {
                    'Status': 'Accepted',
                    'Driver Name': driverName.trim()
                }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            // Refresh list
            fetchBookings();
        })
        .catch(err => alert('Error assigning driver: ' + err.message))
        .finally(() => setAssigningId(null));
    };

    if (!isLoggedIn) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
                <div className="job-card" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <h1 style={{ fontFamily: 'Lexend', fontSize: '24px', margin: '0 0 8px 0', color: 'var(--navy)' }}>Operator Login</h1>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Please sign in to continue</p>
                    </div>
                    
                    {loginError && <div style={{ color: 'red', fontSize: '14px', marginBottom: '16px', textAlign: 'center', background: '#ffebee', padding: '8px', borderRadius: '6px' }}>{loginError}</div>}
                    
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Username</label>
                            <input 
                                type="text" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Password</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit' }}
                                required
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoggingIn}
                            style={{ 
                                width: '100%', 
                                padding: '12px', 
                                background: 'var(--navy)', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '8px', 
                                fontWeight: 600,
                                marginTop: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            {isLoggingIn ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Operator Dispatch Dashboard</h1>
                    <div style={{fontSize: '14px'}}>Logged in as Admin</div>
                </div>
                <button 
                    onClick={handleLogout}
                    style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                >
                    Log Out
                </button>
            </div>
            
            <div className="wrap">
                {error && <div style={{color: 'red', marginBottom: '20px'}}>{error}</div>}
                
                {loading ? (
                    <div className="loading">Loading pending jobs...</div>
                ) : (
                    <div className="jobs-grid">
                        {bookings.map(record => {
                            const { id, fields } = record;
                            const status = fields['Status'] || 'Pending';
                            const isPending = status === 'Pending';
                            
                            return (
                                <div key={id} className="job-card" style={{opacity: isPending ? 1 : 0.6}}>
                                    <div className="job-header">
                                        <div className="job-ref">{fields['Booking Ref']}</div>
                                        <div className={`badge ${isPending ? 'badge-pending' : 'badge-accepted'}`}>
                                            {status}
                                        </div>
                                    </div>
                                    
                                    <div className="job-details">
                                        <div className="detail">
                                            <span>Passenger</span>
                                            <strong>{fields['Customer Name']}</strong>
                                        </div>
                                        <div className="detail">
                                            <span>Phone</span>
                                            <strong>{fields['Customer Phone']}</strong>
                                        </div>
                                        <div className="detail">
                                            <span>Date & Time</span>
                                            <strong>{fields['Outbound Date']} @ {fields['Outbound Time']}</strong>
                                        </div>
                                        <div className="detail">
                                            <span>Pickup</span>
                                            <strong>{fields['Home Address']}</strong>
                                        </div>
                                    </div>

                                    {isPending ? (
                                        <div className="job-actions">
                                            <input 
                                                type="text" 
                                                placeholder="Enter Driver Name..." 
                                                value={driverNames[id] || ''}
                                                onChange={e => handleDriverNameChange(id, e.target.value)}
                                            />
                                            <button 
                                                onClick={() => handleAssignDriver(id)}
                                                disabled={assigningId === id}
                                            >
                                                {assigningId === id ? '...' : 'Assign & Accept'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="job-actions" style={{background: 'var(--cream)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600}}>Driver: {fields['Driver Name']}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminApp />);
