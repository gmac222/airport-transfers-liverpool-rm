const { useState, useEffect } = React;

function PortalApp() {
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Extract 'ref' from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');

        if (!ref) {
            setError("No booking reference provided in the URL.");
            setLoading(false);
            return;
        }

        // Fetch booking from our new Vercel Serverless Function
        fetch(`/api/booking?ref=${ref}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
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
                <a href="/" className="brand">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="40" height="40" rx="12" fill="#0E2747"/>
                        <path d="M12 28L20 12L28 28" stroke="#E6B24B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M15 22H25" stroke="#E6B24B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div className="brand-text">
                        <span className="rm">Airport Transfers</span>
                        <span className="tf">Liverpool</span>
                    </div>
                </a>
                <div className="portal-card">
                    <div className="loading">Loading your booking details...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="wrap">
                <div className="portal-card">
                    <div className="portal-header">
                        <h1>Booking Error</h1>
                    </div>
                    <div className="portal-content" style={{textAlign: 'center'}}>
                        <p style={{color: 'red', marginBottom: '20px'}}>{error}</p>
                        <a href="/" className="btn btn-primary">Return to Homepage</a>
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
            <a href="/" className="brand">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="40" height="40" rx="12" fill="#0E2747"/>
                    <path d="M12 28L20 12L28 28" stroke="#E6B24B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M15 22H25" stroke="#E6B24B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="brand-text">
                    <span className="rm">Airport Transfers</span>
                    <span className="tf">Liverpool</span>
                </div>
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
                                <span style={{fontSize: '13px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase'}}>Your Driver</span>
                                <strong style={{display: 'block', fontSize: '18px', color: 'var(--navy-ink)'}}>{driverName}</strong>
                                {fields['Driver Phone'] && (
                                    <div style={{fontSize: '14px', color: 'var(--muted)', marginTop: '4px'}}>
                                        📞 <a href={`tel:${fields['Driver Phone']}`} style={{color: 'var(--navy-ink)', textDecoration: 'none', fontWeight: 500}}>{fields['Driver Phone']}</a>
                                        <span style={{display: 'block', fontSize: '12px', marginTop: '2px'}}>(For emergencies only)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {status === 'Accepted' && fields['Payment Link'] && (
                        <div style={{marginTop: '20px'}}>
                            <a href={fields['Payment Link']} target="_blank" className="btn btn-primary" style={{width: '100%', textAlign: 'center', display: 'block'}}>
                                Pay to Confirm Booking
                            </a>
                            <p style={{fontSize: '13px', color: 'var(--muted)', textAlign: 'center', marginTop: '10px'}}>
                                Secure payment via Revolut
                            </p>
                        </div>
                    )}

                    {status === 'Pending' && (
                        <div style={{marginTop: '20px', padding: '16px', background: 'rgba(14, 39, 71, 0.04)', borderRadius: '12px', fontSize: '14px', color: 'var(--muted)'}}>
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
