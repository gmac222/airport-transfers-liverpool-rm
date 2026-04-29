const { useState, useEffect } = React;

const fmtUKDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw);
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB');
};

function PortalApp() {
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inputRef, setInputRef] = useState('');
    const [declining, setDeclining] = useState(false);
    const [accepting, setAccepting] = useState(false);

    const handleAccept = async () => {
        if (!booking) return;
        setAccepting(true);
        try {
            const res = await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: booking.id, fields: { Status: 'Awaiting Payment' } })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Refetch the booking to pick up any operator-side changes
            const ref = booking.fields['Booking Ref'];
            const refresh = await fetch(`/api/booking?ref=${ref}`).then(r => r.json());
            if (refresh.booking) setBooking(refresh.booking);
            else setBooking({ ...booking, fields: { ...booking.fields, Status: 'Awaiting Payment' } });
        } catch (err) {
            alert('Could not accept the quote: ' + err.message + '\n\nPlease call us on 07746 899644.');
        } finally {
            setAccepting(false);
        }
    };

    const handleDecline = async () => {
        if (!booking) return;
        const confirmed = window.confirm("Decline this booking? We won't allocate a driver and you won't be charged. This can't be undone — you'd need to make a new booking.");
        if (!confirmed) return;
        setDeclining(true);
        try {
            const res = await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: booking.id, fields: { Status: 'Declined' } })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setBooking({ ...booking, fields: { ...booking.fields, Status: 'Declined' } });
        } catch (err) {
            alert('Could not decline booking: ' + err.message + '\n\nPlease call us instead.');
        } finally {
            setDeclining(false);
        }
    };

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
                    {(() => {
                        const labelMap = {
                            'Pending': 'Pricing Your Trip',
                            'Awaiting Confirmation': 'Awaiting Your Confirmation',
                            'Awaiting Payment': 'Awaiting Payment',
                            'Accepted': 'Driver Assigned',
                            'Declined': 'Booking Declined'
                        };
                        const label = labelMap[status] || status;
                        const cls = (status === 'Pending' || status === 'Awaiting Confirmation' || status === 'Awaiting Payment')
                            ? 'status-badge status-pending'
                            : status === 'Declined'
                                ? 'status-badge'
                                : 'status-badge status-accepted';
                        return (
                            <div className={cls} style={status === 'Declined' ? {background: 'rgba(229,62,62,0.15)', color: '#fca5a5', border: '1px solid rgba(229,62,62,0.3)'} : undefined}>
                                {status !== 'Declined' && <div className="status-pulse"></div>}
                                {label}
                            </div>
                        );
                    })()}

                    <div className="grid-details">
                        <div className="detail-item">
                            <span>Airport</span>
                            <strong>{fields['Airport']}</strong>
                        </div>
                        <div className="detail-item">
                            <span>Outbound Date & Time</span>
                            <strong>{fmtUKDate(fields['Outbound Date'])} at {fields['Outbound Time']}</strong>
                        </div>
                        <div className="detail-item">
                            <span>Pickup Location</span>
                            <strong>{fields['Home Address']}</strong>
                        </div>
                        <div className="detail-item">
                            <span>Passengers / Luggage</span>
                            <strong>{fields['Passengers']} Pax / {fields['Luggage']} Bags</strong>
                        </div>
                        {fields['Total Price'] && (
                            <div className="detail-item">
                                <span>Total Price</span>
                                <strong>£{fields['Total Price']}</strong>
                            </div>
                        )}
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

                    {status === 'Awaiting Confirmation' && (
                        <div style={{
                            marginTop: '32px',
                            padding: '32px 24px',
                            background: 'linear-gradient(145deg, rgba(230, 178, 75, 0.15), rgba(230, 178, 75, 0.05))',
                            borderRadius: '24px',
                            border: '1px solid rgba(230, 178, 75, 0.3)',
                            boxShadow: '0 20px 40px -10px rgba(230, 178, 75, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#fff', fontWeight: 700 }}>
                                {fields['Total Price'] ? `Your price: £${fields['Total Price']}` : 'Confirm your booking'}
                            </h3>
                            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                                Happy with this? Tap accept and we'll allocate a driver and send you a payment link. Otherwise, decline and we'll release your slot — no charge either way.
                            </p>
                            <button
                                onClick={handleAccept}
                                disabled={accepting || declining}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: 'var(--amber)',
                                    color: 'var(--navy-ink)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    cursor: accepting ? 'wait' : 'pointer',
                                    fontFamily: 'inherit',
                                    boxShadow: '0 10px 20px -5px rgba(230, 178, 75, 0.4)'
                                }}>
                                {accepting ? 'Accepting…' : `Accept${fields['Total Price'] ? ` £${fields['Total Price']}` : ''} & Continue`}
                            </button>
                            <button
                                onClick={handleDecline}
                                disabled={declining || accepting}
                                style={{
                                    marginTop: '12px',
                                    width: '100%',
                                    padding: '12px 16px',
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.7)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '10px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: declining ? 'wait' : 'pointer',
                                    fontFamily: 'inherit'
                                }}>
                                {declining ? 'Declining…' : "No thanks — decline this booking"}
                            </button>
                            <p style={{fontSize: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: '12px', marginBottom: 0}}>
                                You won't be charged. A driver is only allocated after payment.
                            </p>
                        </div>
                    )}

                    {status === 'Awaiting Payment' && !fields['Payment Link'] && (
                        <div style={{marginTop: '30px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center'}}>
                            Thanks for accepting! We're allocating a driver and preparing your secure payment link — you'll get an SMS within a few minutes.
                        </div>
                    )}

                    {status === 'Awaiting Payment' && fields['Payment Link'] && (
                        <div className="payment-card" style={{
                            marginTop: '32px',
                            padding: '32px 24px',
                            background: 'linear-gradient(145deg, rgba(230, 178, 75, 0.15), rgba(230, 178, 75, 0.05))',
                            borderRadius: '24px',
                            border: '1px solid rgba(230, 178, 75, 0.3)',
                            boxShadow: '0 20px 40px -10px rgba(230, 178, 75, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--amber)' }}></div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#fff', fontWeight: '700' }}>Confirm Your Booking</h3>
                            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                                {fields['Total Price']
                                    ? `Total price: £${fields['Total Price']}. Pay now to lock in your transfer — we'll allocate your driver and send their details as soon as payment clears.`
                                    : `Pay now to lock in your transfer — we'll allocate your driver and send their details as soon as payment clears.`}
                            </p>
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    const raw = fields['Payment Link'] || '';
                                    const urlMatch = raw.match(/https?:\/\/[^\s]+/);
                                    const url = urlMatch ? urlMatch[0] : (raw.startsWith('http') ? raw : `https://${raw}`);
                                    window.location.href = url;
                                }}
                                className="btn btn-primary"
                                style={{
                                    width: '100%',
                                    textAlign: 'center',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    background: 'var(--amber)',
                                    color: 'var(--navy-ink)',
                                    fontSize: '16px',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    fontWeight: '700',
                                    boxShadow: '0 10px 20px -5px rgba(230, 178, 75, 0.4)',
                                    transition: 'all 0.3s ease'
                                }}>
                                Complete Payment Now
                            </a>
                            <p style={{fontSize: '13px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '16px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                                <span style={{opacity: 0.7}}>🔒</span> Secure, encrypted checkout
                            </p>
                        </div>
                    )}

                    {status === 'Declined' && (
                        <div style={{marginTop: '30px', padding: '24px', background: 'rgba(229, 62, 62, 0.08)', border: '1px solid rgba(229, 62, 62, 0.25)', borderRadius: '16px', fontSize: '15px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, textAlign: 'center'}}>
                            <div style={{fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '6px'}}>Booking Declined</div>
                            You declined this quote, so we haven't allocated a driver and you haven't been charged. If this was a mistake or you'd like a fresh quote, please <a href="/" style={{color: 'var(--amber)', textDecoration: 'underline'}}>make a new booking</a> or call us.
                        </div>
                    )}

                    {status === 'Pending' && (
                        <div style={{marginTop: '30px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6}}>
                            We've received your booking. Our dispatch team is finalising your price and will text you a quote shortly to accept or decline.
                        </div>
                    )}
                </div>
            </div>

            <div style={{textAlign: 'center', marginTop: '20px', padding: '14px', fontSize: '14px', color: 'rgba(255,255,255,0.7)'}}>
                Need to speak to us? <a href="tel:07746899644" style={{color: 'var(--amber)', fontWeight: 600, textDecoration: 'none'}}>📞 07746 899644</a>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PortalApp />);
