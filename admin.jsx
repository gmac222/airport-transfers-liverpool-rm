const { useState, useEffect } = React;

function AdminApp() {
    const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('adminLoggedIn') === 'true');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [operators, setOperators] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('operators'); // operators | jobs

    // New operator form
    const [newOp, setNewOp] = useState({ name: '', username: '', password: '', phone: '', email: '' });
    const [isAdding, setIsAdding] = useState(false);

    // Job assignment
    const [assignOperator, setAssignOperator] = useState('RM Transfers');
    const [isAssigning, setIsAssigning] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError('');
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(r => r.json())
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

    const fetchOperators = () => {
        fetch('/api/operators')
            .then(r => r.json())
            .then(data => setOperators(data.operators || []))
            .catch(err => console.error('Failed to fetch operators:', err));
    };

    const fetchBookings = () => {
        fetch('/api/booking?action=list', { method: 'POST' })
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
            fetchOperators();
            fetchBookings();
        }
    }, [isLoggedIn]);

    const handleAddOperator = async (e) => {
        e.preventDefault();
        if (!newOp.name || !newOp.username || !newOp.password) return alert('Name, username and password are required.');
        setIsAdding(true);
        try {
            const res = await fetch('/api/operators', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOp)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setNewOp({ name: '', username: '', password: '', phone: '', email: '' });
            fetchOperators();
            alert('Operator created successfully!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteOperator = async (id, name) => {
        if (!window.confirm(`Delete operator "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch('/api/operators', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchOperators();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleAutoAssign = async () => {
        if (!assignOperator) return alert('Please select an operator.');
        const unassigned = bookings.filter(b => !b.fields['Operator'] && !['Archived','Cancelled'].includes(b.fields['Status']));
        if (unassigned.length === 0) return alert('No unassigned jobs to assign.');
        if (!window.confirm(`Assign ${unassigned.length} unassigned job(s) to "${assignOperator}"?`)) return;

        setIsAssigning(true);
        let success = 0;
        for (const b of unassigned) {
            try {
                await fetch('/api/booking', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: b.id, fields: { 'Operator': assignOperator } })
                });
                success++;
            } catch (err) {
                console.error('Failed to assign:', b.id, err);
            }
        }
        alert(`${success} of ${unassigned.length} jobs assigned to ${assignOperator}.`);
        fetchBookings();
        setIsAssigning(false);
    };

    const handleReassignSingle = async (bookingId, opName) => {
        try {
            await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookingId, fields: { 'Operator': opName } })
            });
            fetchBookings();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // ─── Login screen ─────────────────────────────────────────────
    if (!isLoggedIn) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cream)' }}>
                <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <h1 style={{ fontFamily: 'Lexend', fontSize: '24px', margin: '0 0 8px 0', color: 'var(--navy)' }}>Admin Login</h1>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Super-admin access only</p>
                    </div>
                    {loginError && <div style={{ color: 'red', fontSize: '14px', marginBottom: '16px', textAlign: 'center', background: '#ffebee', padding: '8px', borderRadius: '6px' }}>{loginError}</div>}
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Username</label>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Password</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit' }} required />
                        </div>
                        <button type="submit" disabled={isLoggingIn} style={{ width: '100%', padding: '12px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                            {isLoggingIn ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ─── Main admin panel ─────────────────────────────────────────
    const opNames = operators.map(o => o.name);
    const activeBookings = bookings.filter(b => !['Archived','Cancelled'].includes(b.fields['Status']));
    const unassignedCount = activeBookings.filter(b => !b.fields['Operator']).length;

    return (
        <div>
            {/* Header */}
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '40px' }} />
                    <div>
                        <h1>Admin Panel</h1>
                        <div style={{ fontSize: '14px', marginTop: '2px', opacity: 0.7 }}>Manage operators &amp; job assignments</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <a href="/operator.html" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>Operator Portal →</a>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Log Out</button>
                </div>
            </div>

            <div className="wrap">
                {/* Tab controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button onClick={() => setView('operators')} style={{ padding: '10px 20px', borderRadius: '8px', border: view === 'operators' ? '2px solid var(--navy)' : '1px solid var(--line)', background: view === 'operators' ? 'var(--navy)' : 'white', color: view === 'operators' ? 'white' : 'var(--ink)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>
                        Manage Operators ({operators.length})
                    </button>
                    <button onClick={() => setView('jobs')} style={{ padding: '10px 20px', borderRadius: '8px', border: view === 'jobs' ? '2px solid var(--navy)' : '1px solid var(--line)', background: view === 'jobs' ? 'var(--navy)' : 'white', color: view === 'jobs' ? 'white' : 'var(--ink)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>
                        Job Assignments {unassignedCount > 0 && <span style={{ background: '#e53e3e', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '12px', marginLeft: '6px' }}>{unassignedCount}</span>}
                    </button>
                </div>

                {/* ─── Operators View ─── */}
                {view === 'operators' && (
                    <div>
                        {/* Create operator form */}
                        <div className="card" style={{ marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'Lexend', fontSize: '18px', margin: '0 0 16px 0' }}>Create New Operator</h2>
                            <form onSubmit={handleAddOperator} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>Operator Name *</label>
                                    <input value={newOp.name} onChange={e => setNewOp({...newOp, name: e.target.value})} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'inherit' }} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>Login Username *</label>
                                    <input value={newOp.username} onChange={e => setNewOp({...newOp, username: e.target.value})} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'inherit' }} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>Password *</label>
                                    <input value={newOp.password} onChange={e => setNewOp({...newOp, password: e.target.value})} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'inherit' }} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>Phone</label>
                                    <input value={newOp.phone} onChange={e => setNewOp({...newOp, phone: e.target.value})} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'inherit' }} />
                                </div>
                                <div>
                                    <button type="submit" disabled={isAdding} style={{ padding: '8px 20px', background: 'var(--amber)', color: 'var(--navy-ink)', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                                        {isAdding ? 'Creating...' : '+ Add Operator'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Operators list */}
                        <div className="card">
                            <h2 style={{ fontFamily: 'Lexend', fontSize: '18px', margin: '0 0 16px 0' }}>Active Operators</h2>
                            {operators.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>No operators created yet. Add one above.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Name</th>
                                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Username</th>
                                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Phone</th>
                                            <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Active Jobs</th>
                                            <th style={{ padding: '10px 12px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {operators.map((op, i) => {
                                            const jobCount = activeBookings.filter(b => (b.fields['Operator'] || 'RM Transfers') === op.name).length;
                                            return (
                                                <tr key={op.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{op.name}</td>
                                                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{op.username}</td>
                                                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{op.phone || '–'}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                        <span style={{ background: jobCount > 0 ? '#dcfce7' : '#f3f4f6', color: jobCount > 0 ? '#166534' : '#9ca3af', padding: '2px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '13px' }}>{jobCount}</span>
                                                    </td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                        <button onClick={() => handleDeleteOperator(op.id, op.name)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Delete</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── Jobs View ─── */}
                {view === 'jobs' && (
                    <div>
                        {/* Auto-assign bar */}
                        <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '14px' }}>Auto-assign all unassigned jobs to:</strong>
                            <select value={assignOperator} onChange={e => setAssignOperator(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '14px' }}>
                                {operators.map(op => <option key={op.id} value={op.name}>{op.name}</option>)}
                                {operators.length === 0 && <option value="RM Transfers">RM Transfers</option>}
                            </select>
                            <button onClick={handleAutoAssign} disabled={isAssigning} style={{ padding: '8px 20px', background: 'var(--amber)', color: 'var(--navy-ink)', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {isAssigning ? 'Assigning...' : `Assign ${unassignedCount} Job(s)`}
                            </button>
                        </div>

                        {/* Jobs table */}
                        <div className="card" style={{ overflow: 'auto' }}>
                            <h2 style={{ fontFamily: 'Lexend', fontSize: '18px', margin: '0 0 16px 0' }}>Active Bookings ({activeBookings.length})</h2>
                            {loading ? (
                                <div className="loading">Loading...</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Ref</th>
                                            <th style={{ padding: '8px' }}>Customer</th>
                                            <th style={{ padding: '8px' }}>Date</th>
                                            <th style={{ padding: '8px' }}>Status</th>
                                            <th style={{ padding: '8px' }}>Driver</th>
                                            <th style={{ padding: '8px' }}>Assigned To</th>
                                            <th style={{ padding: '8px' }}>Reassign</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeBookings.sort((a,b) => new Date(a.fields['Outbound Date']+'T'+(a.fields['Outbound Time']||'00:00')) - new Date(b.fields['Outbound Date']+'T'+(b.fields['Outbound Time']||'00:00'))).map((b, i) => {
                                            const currentOp = b.fields['Operator'] || '';
                                            return (
                                                <tr key={b.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                                    <td style={{ padding: '8px', fontWeight: 600 }}>{b.fields['Booking Ref']}</td>
                                                    <td style={{ padding: '8px' }}>{b.fields['Customer Name']}</td>
                                                    <td style={{ padding: '8px' }}>{b.fields['Outbound Date']} {b.fields['Outbound Time']}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: b.fields['Status'] === 'Accepted' ? '#dcfce7' : '#fef3c7', color: b.fields['Status'] === 'Accepted' ? '#166534' : '#92400e', fontWeight: 600 }}>{b.fields['Status']}</span>
                                                    </td>
                                                    <td style={{ padding: '8px' }}>{b.fields['Driver Name'] || <span style={{color:'#9ca3af'}}>–</span>}</td>
                                                    <td style={{ padding: '8px', fontWeight: currentOp ? 600 : 400, color: currentOp ? 'var(--navy-ink)' : '#e53e3e' }}>{currentOp || 'Unassigned'}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        <select value={currentOp} onChange={e => handleReassignSingle(b.id, e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}>
                                                            <option value="">Unassigned</option>
                                                            {operators.map(op => <option key={op.id} value={op.name}>{op.name}</option>)}
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {activeBookings.length === 0 && (
                                            <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>No active bookings.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminApp />);
