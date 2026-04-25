const { useState, useEffect } = React;

function PortalApp() {
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inputRef, setInputRef] = useState('');

    useEffect(() => {
        // Extract 'ref' from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        let ref = urlParams.get('ref');

        // If no ref in URL, check localStorage
        if (!ref) {
            ref = localStorage.getItem('bookingRef');
        }

        // If still no ref, show the lookup form
        if (!ref) {
            setLoading(false);
            return;
        }

        // Save ref to localStorage for future visits (so the PWA "remembers" them)
        localStorage.setItem('bookingRef', ref);

        // Fetch booking from our new Vercel Serverless Function
        fetch(`/api/booking?ref=${ref}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    localStorage.removeItem('bookingRef'); // Clear invalid ref
                    setError(data.error);
                } else {
                    setBooking(data.booking);
                }
                setLoading(false);
            })
            .catch(err => {
                setError("Failed to connect to the server.");
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="wrap">
                <a href="/" className="brand" style={{ display: 'flex', justifyContent: 'center' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                </a>
                <div className="portal-card">
                    <div className="loading">
                        <div className="spinner"></div>
                        <span>Authenticating booking...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="wrap">
                <a href="/" className="brand" style={{ display: 'flex', justifyContent: 'center' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                </a>
                <div className="portal-card">
                    <div className="portal-header">
                        <h1>Booking Error</h1>
                    </div>
                    <div className="portal-content" style={{textAlign: 'center'}}>
                        <p style={{color: '#ef4444', marginBottom: '20px', fontWeight: 500}}>{error}</p>
                        <a href="/portal.html" className="btn btn-primary">Try Another Reference</a>
                    </div>
                </div>
            </div>
        );
    }

    // If no loading, no error, and no booking, we show the lookup form
    if (!loading && !booking && !error) {
        return (
            <div className="wrap">
                <a href="/" className="brand" style={{ display: 'flex', justifyContent: 'center' }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
                </a>
                <div className="portal-card">
                    <div className="portal-header">
                        <h1>Track Your Booking</h1>
                        <p>Enter your booking reference to view details</p>
                    </div>
                    <div className="portal-content" style={{textAlign: 'center'}}>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (inputRef.trim()) {
                                window.location.href = `?ref=${inputRef.trim().toUpperCase()}`;
                            }
                        }}>
                            <input 
                                type="text" 
                                placeholder="e.g. B-123456" 
                                value={inputRef}
                                onChange={(e) => setInputRef(e.target.value)}
                                style={{
                                    width: '100%', 
                                    padding: '14px', 
                                    borderRadius: '8px', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    marginBottom: '20px',
                                    fontSize: '16px',
                                    textAlign: 'center',
                                    textTransform: 'uppercase'
                                }}
                                required
                            />
                            <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Look Up Booking</button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    const { fields } = booking;
    const status = fields['Status'] || 'Pending';
    const driverName = fields['Driver Name'];

    return (
        <div className="wrap">
            <a href="/" className="brand" style={{ display: 'flex', justifyContent: 'center' }}>
                <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '60px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
            </a>
            
            <div className="portal-card">
                <div className="portal-header">
                    <h1>Booking {fields['Booking Ref']}</h1>
                    <p>Passenger: {fields['Customer Name']}</p>
                </div>
                
                <div className="portal-content">
                    {status === 'Pending' ? (
                        <div className="status-badge status-pending">
                            <div className="status-pulse"></div>
                            Awaiting Driver Assignment
                        </div>
                    ) : (
                        <div className="status-badge status-accepted">
                            <div className="status-pulse"></div>
                            Driver Assigned
                        </div>
                    )}

                    <div className="grid-details">
                        <div className="detail-item">
                            <span>Airport</span>
                            <strong>{fields['Airport']}</strong>
                        </div>
                        <div className="detail-item">
                            <span>Outbound Date & Time</span>
                            <strong>{fields['Outbound Date']} at {fields['Outbound Time']}</strong>
                        </div>
                        <div className="detail-item">
                            <span>Pickup Location</span>
                            <strong>{fields['Home Address']}</strong>
                        </div>
                        <div className="detail-item">
                            <span>Passengers / Luggage</span>
                            <strong>{fields['Passengers']} Pax / {fields['Luggage']} Bags</strong>
                        </div>
                    </div>

                    {status === 'Accepted' && driverName && (
                        <div className="driver-card">
                            <div className="avatar">👨‍✈️</div>
                            <div>
                                <span style={{fontSize: '12px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'}}>Your Driver</span>
                                <strong style={{display: 'block', fontSize: '18px', color: '#fff', fontWeight: 600, marginTop: '2px'}}>{driverName}</strong>
                                {fields['Driver Phone'] && (
                                    <div style={{fontSize: '14px', color: 'var(--muted)', marginTop: '8px'}}>
                                        📞 <a href={`tel:${fields['Driver Phone']}`} style={{color: '#fff', textDecoration: 'none', fontWeight: 500}}>{fields['Driver Phone']}</a>
                                        <span style={{display: 'block', fontSize: '12px', marginTop: '4px', opacity: 0.7}}>(For emergencies only)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {status === 'Accepted' && fields['Payment Link'] && (
                        <div style={{
                            marginTop: '30px', 
                            padding: '24px', 
                            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.02))', 
                            borderRadius: '20px', 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.15)',
                            textAlign: 'center'
                        }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#fff', fontWeight: '600' }}>Complete Your Booking</h3>
                            <a href={fields['Payment Link']} target="_blank" className="btn btn-primary" style={{width: '100%', textAlign: 'center', display: 'flex', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', boxShadow: '0 10px 20px -10px rgba(16, 185, 129, 0.5)'}}>
                                Pay to Confirm Booking
                            </a>
                            <p style={{fontSize: '13px', color: 'var(--muted)', textAlign: 'center', marginTop: '16px', marginBottom: '0'}}>
                                Secure payment via Revolut
                            </p>
                        </div>
                    )}

                    {status === 'Pending' && (
                        <div style={{marginTop: '30px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6}}>
                            We have received your booking and are currently matching you with one of our professional drivers. You will receive an SMS as soon as a driver is confirmed!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PortalApp />);
