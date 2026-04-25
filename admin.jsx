const { useState, useEffect } = React;

function AdminApp() {
    const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('adminLoggedIn') === 'true');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [bookings, setBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const [driversList, setDriversList] = useState([{ name: "Select a driver...", phone: "" }, { name: "Custom Driver", phone: "" }]);

    const [newDriverName, setNewDriverName] = useState('');
    const [newDriverPhone, setNewDriverPhone] = useState('');
    const [isAddingDriver, setIsAddingDriver] = useState(false);

    const [driverNames, setDriverNames] = useState({});
    const [driverPhones, setDriverPhones] = useState({});
    const [paymentLinks, setPaymentLinks] = useState({});

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
                
                // Sort bookings by Submitted At (latest first)
                const sorted = data.bookings.sort((a, b) => {
                    const dateA = new Date(a.fields['Submitted At'] || 0);
                    const dateB = new Date(b.fields['Submitted At'] || 0);
                    return dateB - dateA;
                });
                
                setBookings(sorted);
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
            
            // Fetch dynamic drivers list from Airtable
            fetch('/api/drivers')
                .then(res => res.json())
                .then(data => {
                    if (data.drivers && data.drivers.length > 0) {
                        setDriversList([
                            { name: "Select a driver...", phone: "" },
                            ...data.drivers,
                            { name: "Custom Driver", phone: "" }
                        ]);
                    }
                })
                .catch(err => console.error("Failed to fetch drivers:", err));
        }
    }, [isLoggedIn]);

    const handleAddDriver = async (e) => {
        e.preventDefault();
        if (!newDriverName.trim()) return alert("Driver name is required.");
        
        setIsAddingDriver(true);
        try {
            const res = await fetch('/api/drivers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDriverName.trim(), phone: newDriverPhone.trim() })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);

            // Add the new driver to the list locally or refetch
            setDriversList(prev => [
                ...prev.slice(0, prev.length - 1), // all except custom driver
                { name: data.driver.fields['Name'], phone: data.driver.fields['Phone'] || '' },
                { name: "Custom Driver", phone: "" } // put custom driver back at the end
            ]);

            setNewDriverName('');
            setNewDriverPhone('');
            alert('Driver added successfully!');
        } catch (err) {
            alert('Error adding driver: ' + err.message);
        } finally {
            setIsAddingDriver(false);
        }
    };

    const handleDriverSelection = (id, e) => {
        const selectedName = e.target.value;
        setDriverNames(prev => ({ ...prev, [id]: selectedName }));
        
        const foundDriver = driversList.find(d => d.name === selectedName);
        if (foundDriver && foundDriver.phone) {
            setDriverPhones(prev => ({ ...prev, [id]: foundDriver.phone }));
        }
    };

    const handleDriverNameChange = (id, name) => {
        setDriverNames(prev => ({ ...prev, [id]: name }));
    };

    const handleDriverPhoneChange = (id, phone) => {
        setDriverPhones(prev => ({ ...prev, [id]: phone }));
    };

    const handlePaymentLinkChange = (id, link) => {
        setPaymentLinks(prev => ({ ...prev, [id]: link }));
    };

    const handleAssignDriver = (id) => {
        const driverName = driverNames[id];
        const driverPhone = driverPhones[id];
        const paymentLink = paymentLinks[id];
        if (!driverName || driverName.trim() === '') return alert('Please enter a driver name');
        if (!driverPhone || driverPhone.trim() === '') return alert('Please enter a driver phone number');
        if (!paymentLink || paymentLink.trim() === '') return alert('Please enter a payment link');

        setAssigningId(id);

        fetch('/api/booking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                fields: {
                    'Status': 'Accepted',
                    'Driver Name': driverName.trim(),
                    'Driver Phone': driverPhone.trim(),
                    'Payment Link': paymentLink.trim()
                }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            const record = bookings.find(b => b.id === id);
            if (record) {
                fetch('https://gmac222.app.n8n.cloud/webhook/accept-booking-webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerPhone: record.fields['Customer Phone'],
                        bookingRef: record.fields['Booking Ref'],
                        driverName: driverName.trim(),
                        driverPhone: driverPhone.trim(),
                        pickupAddress: record.fields['Home Address'],
                        outboundDate: record.fields['Outbound Date'],
                        outboundTime: record.fields['Outbound Time'],
                        paymentLink: paymentLink.trim(),
                        portalLink: `https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${record.fields['Booking Ref']}`
                    })
                }).catch(err => console.error('Error triggering webhook:', err));
            }

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

    const filteredBookings = bookings.filter(b => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const ref = (b.fields['Booking Ref'] || '').toLowerCase();
        const name = (b.fields['Customer Name'] || '').toLowerCase();
        const phone = (b.fields['Customer Phone'] || '').toLowerCase();
        return ref.includes(query) || name.includes(query) || phone.includes(query);
    });

    return (
        <div>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Operator Dispatch Dashboard</h1>
                    <div style={{fontSize: '14px'}}>Logged in as Admin</div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <a href="/stats.html" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                        Business Stats
                    </a>
                    <a href="/#book" target="_blank" className="btn" style={{ background: 'var(--amber)', color: 'var(--navy-ink)', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                        + New Manual Booking
                    </a>
                    <button 
                        onClick={handleLogout}
                        style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        Log Out
                    </button>
                </div>
            </div>
            
            <div className="wrap">
                <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 400px' }}>
                        <input 
                            type="text" 
                            placeholder="Search by ref, name, or phone..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '15px' }}
                        />
                    </div>
                    
                    <form onSubmit={handleAddDriver} style={{ flex: '1 1 400px', display: 'flex', gap: '10px', background: 'var(--cream)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                        <input 
                            type="text" 
                            placeholder="New Driver Name" 
                            value={newDriverName}
                            onChange={e => setNewDriverName(e.target.value)}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}
                            required
                        />
                        <input 
                            type="tel" 
                            placeholder="Phone Number" 
                            value={newDriverPhone}
                            onChange={e => setNewDriverPhone(e.target.value)}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}
                        />
                        <button type="submit" disabled={isAddingDriver} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>
                            {isAddingDriver ? 'Adding...' : 'Add Driver'}
                        </button>
                    </form>
                </div>

                {error && <div style={{color: 'red', marginBottom: '20px'}}>{error}</div>}
                
                {loading ? (
                    <div className="loading">Loading pending jobs...</div>
                ) : (
                    <div className="jobs-list">
                        {filteredBookings.map(record => {
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
                                        {fields['Outbound Flight'] && (
                                            <div className="detail">
                                                <span>Flight</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <strong>{fields['Outbound Flight']}</strong>
                                                    <a 
                                                        href={`https://www.flightradar24.com/data/flights/${fields['Outbound Flight'].replace(/\s/g, '').toLowerCase()}`} 
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ fontSize: '11px', background: 'rgba(230, 178, 75, 0.2)', color: 'var(--amber-deep)', padding: '2px 8px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}
                                                    >
                                                        Track Live
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {isPending ? (
                                        <div className="job-actions" style={{ flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                <select 
                                                    value={driverNames[id] || ''}
                                                    onChange={e => handleDriverSelection(id, e)}
                                                    style={{ flex: '1 1 200px', padding: '10px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit' }}
                                                >
                                                    {driversList.map((d, index) => (
                                                        <option key={index} value={d.name === 'Select a driver...' ? '' : d.name}>
                                                            {d.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {driverNames[id] === 'Custom Driver' && (
                                                    <input 
                                                        type="text" 
                                                        placeholder="Enter Custom Name..." 
                                                        value={driverNames[id] === 'Custom Driver' ? '' : driverNames[id]}
                                                        onChange={e => handleDriverNameChange(id, e.target.value)}
                                                        style={{ flex: '1 1 150px' }}
                                                    />
                                                )}
                                                <input 
                                                    type="tel" 
                                                    placeholder="Driver Phone..." 
                                                    value={driverPhones[id] || ''}
                                                    onChange={e => handleDriverPhoneChange(id, e.target.value)}
                                                    style={{ flex: '1 1 150px' }}
                                                />
                                                <input 
                                                    type="url" 
                                                    placeholder="Paste Revolut Payment Link..." 
                                                    value={paymentLinks[id] || ''}
                                                    onChange={e => handlePaymentLinkChange(id, e.target.value)}
                                                    style={{ flex: '2 1 300px' }}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleAssignDriver(id)}
                                                disabled={assigningId === id}
                                                style={{ padding: '12px', width: '100%' }}
                                            >
                                                {assigningId === id ? '...' : 'Assign Driver & Send Payment Link'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="job-actions" style={{background: 'var(--cream)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600}}>Driver: {fields['Driver Name']} {fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                            {fields['Payment Link'] && <span style={{fontSize: '14px', color: 'var(--muted)'}}>Payment Link: <a href={fields['Payment Link']} target="_blank" rel="noreferrer" style={{color: 'var(--navy)'}}>{fields['Payment Link']}</a></span>}
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
