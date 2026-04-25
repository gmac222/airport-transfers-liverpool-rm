const { useState, useEffect } = React;

function AdminApp() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const [driverNames, setDriverNames] = useState({});

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
        fetchBookings();
    }, []);

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

    return (
        <div>
            <div className="header">
                <h1>Operator Dispatch Dashboard</h1>
                <div style={{fontSize: '14px'}}>Logged in as Admin</div>
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
