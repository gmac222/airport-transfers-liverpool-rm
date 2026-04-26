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
    const [acknowledgingId, setAcknowledgingId] = useState(null);
    const [driversList, setDriversList] = useState([{ name: "Select a driver...", phone: "" }, { name: "Custom Driver", phone: "" }]);

    const [editingJob, setEditingJob] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [newDriverName, setNewDriverName] = useState('');
    const [newDriverPhone, setNewDriverPhone] = useState('');
    const [isAddingDriver, setIsAddingDriver] = useState(false);

    const [driverNames, setDriverNames] = useState({});
    const [driverPhones, setDriverPhones] = useState({});
    const [paymentLinks, setPaymentLinks] = useState({});
    const [prices, setPrices] = useState({});

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

    const handlePriceChange = (id, price) => {
        setPrices(prev => ({ ...prev, [id]: price }));
    };

    const handleAssignDriver = (id) => {
        const driverName = driverNames[id];
        const driverPhone = driverPhones[id];
        const paymentLink = paymentLinks[id];
        const price = prices[id];
        if (!driverName || driverName.trim() === '') return alert('Please enter a driver name');
        if (!driverPhone || driverPhone.trim() === '') return alert('Please enter a driver phone number');
        if (!paymentLink || paymentLink.trim() === '') return alert('Please enter a payment link');
        if (!price || price.trim() === '') return alert('Please enter a price');

        setAssigningId(id);

        fetch('/api/booking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                fields: {
                    'Status': 'Awaiting Payment',
                    'Driver Name': driverName.trim(),
                    'Driver Phone': driverPhone.trim(),
                    'Payment Link': paymentLink.trim(),
                    'Total Price': parseFloat(price)
                }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            const record = bookings.find(b => b.id === id);
            if (record) {
                fetch('/api/sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send-payment-link',
                        fields: {
                            'Booking Ref': record.fields['Booking Ref'],
                            'Customer Name': record.fields['Customer Name'],
                            'Customer Phone': record.fields['Customer Phone'],
                            'Payment Link': paymentLink.trim(),
                            'Total Price': parseFloat(price)
                        }
                    })
                }).catch(err => console.error('Error triggering sms:', err));
            }

            // Refresh list
            fetchBookings();
        })
        .catch(err => alert('Error assigning driver: ' + err.message))
        .finally(() => setAssigningId(null));
    };

    const handleAcknowledgePayment = (id) => {
        setAcknowledgingId(id);

        fetch('/api/booking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                fields: {
                    'Status': 'Accepted'
                }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            const record = bookings.find(b => b.id === id);
            if (record) {
                fetch('/api/sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send-confirmation',
                        fields: record.fields
                    })
                }).catch(err => console.error('Error triggering sms:', err));
            }

            // Refresh list
            fetchBookings();
        })
        .catch(err => alert('Error acknowledging payment: ' + err.message))
        .finally(() => setAcknowledgingId(null));
    };

    const handleDeleteJob = (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this booking?")) return;
        
        fetch('/api/booking', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            fetchBookings();
        })
        .catch(err => alert('Error deleting booking: ' + err.message));
    };

    const openCreateModal = () => {
        setEditingJob('new');
        setEditForm({
            'Booking Ref': 'ATL-' + Array.from({length: 8}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''),
            'Trip Type': 'oneway',
            'Oneway Direction': 'to',
            'Airport': 'LJLA',
            'Customer Name': '',
            'Customer Phone': '',
            'Customer Email': '',
            'Home Address': '',
            'Outbound Date': '',
            'Outbound Time': '',
            'Outbound Flight': '',
            'Return Date': '',
            'Return Time': '',
            'Return Flight': '',
            'Passengers': 1,
            'Luggage': 0,
            'Notes': '',
            'Total Price': 0,
            'Status': 'Pending',
            'Submitted At': new Date().toISOString()
        });
    };

    const openEditModal = (record) => {
        setEditingJob(record.id);
        setEditForm({ ...record.fields });
    };

    const handleSaveBooking = (e) => {
        e.preventDefault();
        setIsSavingEdit(true);
        
        if (editingJob === 'new') {
            // Create
            fetch('/api/booking?action=create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: editForm })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setEditingJob(null);
                fetchBookings();
            })
            .catch(err => alert('Error creating booking: ' + err.message))
            .finally(() => setIsSavingEdit(false));
        } else {
            // Update
            fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingJob, fields: editForm })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setEditingJob(null);
                fetchBookings();
            })
            .catch(err => alert('Error updating booking: ' + err.message))
            .finally(() => setIsSavingEdit(false));
        }
    };

    const handleResendSMS = (action) => {
        if (!window.confirm(`Are you sure you want to resend the ${action === 'resend-customer' ? 'Customer' : 'Driver'} SMS?`)) return;
        
        fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, fields: editForm })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            alert('SMS sent successfully!');
        })
        .catch(err => alert('Error sending SMS: ' + err.message));
    };

    const handleDirectSMS = (record, action) => {
        let confirmText = '';
        if (action === 'driver-on-way') confirmText = "Send 'Driver On Way' SMS to Customer?";
        if (action === 'driver-arrived') confirmText = "Send 'Driver Arrived' SMS to Customer?";
        if (action === 'resend-driver') confirmText = "Resend Job SMS & Portal Link to Driver?";
        if (action === 'send-review-invite') confirmText = "Send Review Invite SMS to Customer?";

        if (!window.confirm(confirmText)) return;
        
        fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, fields: record.fields })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            alert('SMS sent successfully!');
        })
        .catch(err => alert('Error sending SMS: ' + err.message));
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '40px' }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px' }}>Operator Dispatch Dashboard</h1>
                        <div style={{fontSize: '14px', marginTop: '2px'}}>Logged in as Admin</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <a href="/stats.html" className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center' }}>
                        Business Stats
                    </a>
                    <button onClick={openCreateModal} className="btn" style={{ background: 'var(--amber)', color: 'var(--navy-ink)', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
                        + New Manual Booking
                    </button>
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
                            const isAwaitingPayment = status === 'Awaiting Payment';
                            
                            return (
                                <div key={id} className="job-card" style={{opacity: isPending ? 1 : 0.6}}>
                                    <div className="job-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="job-ref">{fields['Booking Ref']}</div>
                                            <div className={`badge ${isPending || isAwaitingPayment ? 'badge-pending' : 'badge-accepted'}`}>
                                                {status}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => openEditModal(record)}
                                                style={{ background: 'transparent', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteJob(id)}
                                                style={{ background: 'transparent', color: '#e53e3e', border: '1px solid #e53e3e', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Delete
                                            </button>
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
                                        {fields['Customer Email'] && (
                                            <div className="detail">
                                                <span>Email</span>
                                                <strong>{fields['Customer Email']}</strong>
                                            </div>
                                        )}
                                        <div className="detail">
                                            <span>Bags & Pax</span>
                                            <strong>{fields['Passengers']} Pax, {fields['Luggage'] || 0} Bags</strong>
                                        </div>
                                        <div className="detail">
                                            <span>Trip Type & Airport</span>
                                            <strong>
                                                {fields['Trip Type'] === 'return' ? 'Return' : `One Way (${fields['Oneway Direction'] === 'from' ? 'From' : 'To'} Airport)`} 
                                                {' - '}
                                                {fields['Airport'] === 'Manchester' ? 'Manchester' : 'Liverpool'}
                                            </strong>
                                        </div>
                                        <div className="detail">
                                            <span>Date & Time</span>
                                            <strong>{fields['Outbound Date']} @ {fields['Outbound Time']}</strong>
                                        </div>
                                        <div className="detail">
                                            <span>Pickup</span>
                                            <strong>{fields['Home Address']}</strong>
                                        </div>
                                        {fields['VIP Upgrades'] && (
                                            <div className="detail" style={{ background: '#fffbf0', padding: '8px', borderRadius: '6px', border: '1px solid var(--amber)' }}>
                                                <span style={{ color: 'var(--amber-deep)' }}>✨ VIP Upgrades</span>
                                                <strong style={{ color: 'var(--navy)' }}>{fields['VIP Upgrades']}</strong>
                                            </div>
                                        )}
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
                                        {fields['Trip Type'] === 'return' && (
                                            <>
                                                <div className="detail">
                                                    <span>Return Date & Time</span>
                                                    <strong>{fields['Return Date']} @ {fields['Return Time']}</strong>
                                                </div>
                                                {fields['Return Flight'] && (
                                                    <div className="detail">
                                                        <span>Return Flight</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <strong>{fields['Return Flight']}</strong>
                                                            <a 
                                                                href={`https://www.flightradar24.com/data/flights/${fields['Return Flight'].replace(/\s/g, '').toLowerCase()}`} 
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ fontSize: '11px', background: 'rgba(230, 178, 75, 0.2)', color: 'var(--amber-deep)', padding: '2px 8px', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold' }}
                                                            >
                                                                Track Live
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {fields['Notes'] && (
                                            <div className="detail" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                <span>Notes</span>
                                                <strong style={{ whiteSpace: 'pre-wrap' }}>{fields['Notes']}</strong>
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
                                                    type="number" 
                                                    placeholder="Price (£)..." 
                                                    value={prices[id] || ''}
                                                    onChange={e => handlePriceChange(id, e.target.value)}
                                                    style={{ flex: '1 1 100px' }}
                                                />
                                                <input 
                                                    type="url" 
                                                    placeholder="Paste Revolut Payment Link..." 
                                                    value={paymentLinks[id] || ''}
                                                    onChange={e => handlePaymentLinkChange(id, e.target.value)}
                                                    style={{ flex: '2 1 200px' }}
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
                                    ) : isAwaitingPayment ? (
                                        <div className="job-actions" style={{background: '#fffbf0', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--amber)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600, color: 'var(--amber-deep)'}}>Awaiting Payment</span>
                                            <span style={{fontSize: '14px'}}>Driver: {fields['Driver Name']} {fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                            {fields['Payment Link'] && <span style={{fontSize: '14px', color: 'var(--muted)'}}>Payment Link: <a href={fields['Payment Link']} target="_blank" rel="noreferrer" style={{color: 'var(--navy)'}}>{fields['Payment Link']}</a></span>}
                                            <button 
                                                onClick={() => handleAcknowledgePayment(id)}
                                                disabled={acknowledgingId === id}
                                                style={{ padding: '10px', width: '100%', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '4px' }}
                                            >
                                                {acknowledgingId === id ? '...' : 'Acknowledge Payment & Confirm Booking'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="job-actions" style={{background: 'var(--cream)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600}}>Driver: {fields['Driver Name']} {fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                            {fields['Payment Link'] && <span style={{fontSize: '14px', color: 'var(--muted)'}}>Payment Link: <a href={fields['Payment Link']} target="_blank" rel="noreferrer" style={{color: 'var(--navy)'}}>{fields['Payment Link']}</a></span>}
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                <button onClick={() => handleDirectSMS(record, 'resend-driver')} style={{ flex: 1, padding: '8px 4px', background: 'white', border: '1px solid var(--amber)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: 'var(--amber-deep)', fontWeight: 'bold' }}>
                                                    Resend Driver Info
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'driver-on-way')} style={{ flex: 1, padding: '8px 4px', background: 'white', border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                                                    Backup: Send 'On Way'
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'driver-arrived')} style={{ flex: 1, padding: '8px 4px', background: 'white', border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                                                    Backup: Send 'Arrived'
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'send-review-invite')} style={{ flex: 1, padding: '8px 4px', background: 'white', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>
                                                    Send Review Invite
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {editingJob && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginTop: 0 }}>{editingJob === 'new' ? 'New Manual Booking' : 'Edit Booking'}</h2>
                        <form onSubmit={handleSaveBooking} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Customer Name</label>
                                    <input type="text" value={editForm['Customer Name'] || ''} onChange={e => setEditForm({...editForm, 'Customer Name': e.target.value})} required style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Phone</label>
                                    <input type="text" value={editForm['Customer Phone'] || ''} onChange={e => setEditForm({...editForm, 'Customer Phone': e.target.value})} required style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Email</label>
                                    <input type="email" value={editForm['Customer Email'] || ''} onChange={e => setEditForm({...editForm, 'Customer Email': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                            </div>
                            
                            <div>
                                <label>Pickup Address</label>
                                <input type="text" value={editForm['Home Address'] || ''} onChange={e => setEditForm({...editForm, 'Home Address': e.target.value})} required style={{width:'100%', padding:'8px'}} />
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Airport</label>
                                    <select value={editForm['Airport'] || 'LJLA'} onChange={e => setEditForm({...editForm, 'Airport': e.target.value})} style={{width:'100%', padding:'8px'}}>
                                        <option value="LJLA">Liverpool John Lennon</option>
                                        <option value="Manchester">Manchester</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Trip Type</label>
                                    <select value={editForm['Trip Type'] || 'oneway'} onChange={e => setEditForm({...editForm, 'Trip Type': e.target.value})} style={{width:'100%', padding:'8px'}}>
                                        <option value="oneway">One Way</option>
                                        <option value="return">Return</option>
                                    </select>
                                </div>
                                {editForm['Trip Type'] === 'oneway' && (
                                    <div style={{ flex: 1 }}>
                                        <label>Direction</label>
                                        <select value={editForm['Oneway Direction'] || 'to'} onChange={e => setEditForm({...editForm, 'Oneway Direction': e.target.value})} style={{width:'100%', padding:'8px'}}>
                                            <option value="to">To Airport</option>
                                            <option value="from">From Airport</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Outbound Date</label>
                                    <input type="date" value={editForm['Outbound Date'] || ''} onChange={e => setEditForm({...editForm, 'Outbound Date': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Outbound Time</label>
                                    <input type="time" value={editForm['Outbound Time'] || ''} onChange={e => setEditForm({...editForm, 'Outbound Time': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Outbound Flight</label>
                                    <input type="text" value={editForm['Outbound Flight'] || ''} onChange={e => setEditForm({...editForm, 'Outbound Flight': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Return Date</label>
                                    <input type="date" value={editForm['Return Date'] || ''} onChange={e => setEditForm({...editForm, 'Return Date': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Return Time</label>
                                    <input type="time" value={editForm['Return Time'] || ''} onChange={e => setEditForm({...editForm, 'Return Time': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Return Flight</label>
                                    <input type="text" value={editForm['Return Flight'] || ''} onChange={e => setEditForm({...editForm, 'Return Flight': e.target.value})} style={{width:'100%', padding:'8px'}} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Passengers</label>
                                    <input type="number" value={editForm['Passengers'] || 1} onChange={e => setEditForm({...editForm, 'Passengers': parseInt(e.target.value)})} style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Luggage</label>
                                    <input type="number" value={editForm['Luggage'] || 0} onChange={e => setEditForm({...editForm, 'Luggage': parseInt(e.target.value)})} style={{width:'100%', padding:'8px'}} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Total Price (£)</label>
                                    <input type="number" value={editForm['Total Price'] || 0} onChange={e => setEditForm({...editForm, 'Total Price': parseInt(e.target.value)})} required style={{width:'100%', padding:'8px'}} />
                                </div>
                            </div>

                            <div>
                                <label>Notes</label>
                                <textarea value={editForm['Notes'] || ''} onChange={e => setEditForm({...editForm, 'Notes': e.target.value})} style={{width:'100%', padding:'8px', minHeight: '80px', fontFamily: 'inherit', borderRadius: '4px', border: '1px solid var(--line)'}} />
                            </div>



                            {editingJob !== 'new' && (
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: 'var(--navy-ink)' }}>Communication</h4>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button type="button" onClick={() => handleResendSMS('resend-customer')} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                            Resend Customer SMS
                                        </button>
                                        <button type="button" onClick={() => handleResendSMS('resend-driver')} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                            Resend Driver SMS
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setEditingJob(null)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={isSavingEdit} style={{ padding: '10px 20px', background: 'var(--amber)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {isSavingEdit ? 'Saving...' : 'Save Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminApp />);
