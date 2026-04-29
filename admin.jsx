const { useState, useEffect } = React;

// UK date helper. Accepts an Airtable ISO date ('2026-04-30'), a full
// ISO timestamp, or null. Returns DD/MM/YYYY or '—'.
const fmtUKDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw);
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB');
};

// Mobile-first single-job card. Shown on /admin.html?ref=ATL-XXXX (the
// SMS deep-link) so graham/roy can act on a job without wading through
// the table on a phone.
function FocusedJobCard({
    bookingRef, booking, loading, operators, driversList,
    priceDraftCustomer, priceDraftOperator,
    setPriceDraftCustomer, setPriceDraftOperator,
    priceSavingId, priceSavedFlash, commitPrice,
    paymentLinkDraft, setPaymentLinkDraft,
    paymentLinkSavingId, paymentLinkSavedFlash, commitPaymentLink,
    handleReassignDriver, handleReassignReturnDriver, handleReassignSingle,
    handleSendQuote, sendingQuote,
    isSuper, handleAcknowledgePayment, acknowledgingId,
    onClose, onLogout
}) {
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '20px' }}>
                <div className="card" style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ color: 'var(--muted)' }}>Loading booking {bookingRef}…</div>
                </div>
            </div>
        );
    }
    if (!booking) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '20px' }}>
                <div className="card" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
                    <h2 style={{ margin: '0 0 6px 0', fontFamily: 'Lexend' }}>Booking not found</h2>
                    <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>We couldn't find a booking with reference <strong>{bookingRef}</strong>.</p>
                    <button onClick={onClose} style={{ padding: '10px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Open full admin</button>
                </div>
            </div>
        );
    }
    const f = booking.fields;
    const isReturn = f['Trip Type'] === 'return';
    const cpRaw = f['Customer Price'];
    const opRaw = f['Operator Price'];
    const cpDraft = priceDraftCustomer[booking.id];
    const opDraft = priceDraftOperator[booking.id];
    const cpValue = cpDraft !== undefined ? cpDraft : (cpRaw != null ? String(cpRaw) : '');
    const opValue = opDraft !== undefined ? opDraft : (opRaw != null ? String(opRaw) : '');
    const flashed = !!priceSavedFlash[booking.id];
    const cpClass = `price-cell${flashed ? ' saved' : (cpRaw == null && cpDraft === undefined ? ' empty' : '')}`;
    const opClass = `price-cell${flashed ? ' saved' : (opRaw == null && opDraft === undefined ? ' empty' : '')}`;
    const profit = (Number(cpRaw) || 0) - (Number(opRaw) || 0);
    const hasBothPrices = cpRaw != null && opRaw != null;
    const profitCls = !hasBothPrices ? 'zero' : profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero';
    const status = f['Status'] || 'Pending';
    const currentOp = f['Operator'] || '';

    const detail = (label, value) => (
        <div style={{ paddingBottom: '8px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--navy-ink)', wordBreak: 'break-word' }}>{value || <span style={{color:'#9ca3af'}}>—</span>}</div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: '40px' }}>
            <div className="header" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src="./assets/logo.png" alt="RM" style={{ height: '28px' }} />
                    <strong style={{ fontSize: '15px' }}>{f['Booking Ref']}</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>All jobs</button>
                    <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Log out</button>
                </div>
            </div>

            <div style={{ maxWidth: '560px', margin: '16px auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Status pill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                        fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 700,
                        background: status === 'Accepted' ? '#dcfce7' : status === 'Declined' ? '#fee2e2' : '#fef3c7',
                        color: status === 'Accepted' ? '#166534' : status === 'Declined' ? '#b91c1c' : '#92400e'
                    }}>{status}</span>
                    <a href={`tel:${f['Customer Phone']}`} style={{ fontSize: '13px', color: 'var(--navy)', textDecoration: 'none', fontWeight: 600 }}>📞 Call customer</a>
                </div>

                {/* Pricing — the headline action */}
                <div className="card" style={{ padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontFamily: 'Lexend', fontSize: '16px' }}>💷 Pricing</h3>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>Customer Price</div>
                            <label className={cpClass} style={{ width: '100%' }}>
                                <span className="currency">£</span>
                                <input
                                    type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                                    value={cpValue}
                                    disabled={priceSavingId === booking.id}
                                    onChange={e => setPriceDraftCustomer(prev => ({ ...prev, [booking.id]: e.target.value }))}
                                    onBlur={e => {
                                        const v = e.target.value;
                                        const old = cpRaw != null ? String(cpRaw) : '';
                                        if (v !== old) commitPrice(booking.id, 'Customer Price', v);
                                        setPriceDraftCustomer(prev => { const n = { ...prev }; delete n[booking.id]; return n; });
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                />
                            </label>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>Operator Price</div>
                            <label className={opClass} style={{ width: '100%' }}>
                                <span className="currency">£</span>
                                <input
                                    type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                                    value={opValue}
                                    disabled={priceSavingId === booking.id}
                                    onChange={e => setPriceDraftOperator(prev => ({ ...prev, [booking.id]: e.target.value }))}
                                    onBlur={e => {
                                        const v = e.target.value;
                                        const old = opRaw != null ? String(opRaw) : '';
                                        if (v !== old) commitPrice(booking.id, 'Operator Price', v);
                                        setPriceDraftOperator(prev => { const n = { ...prev }; delete n[booking.id]; return n; });
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                />
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Profit</span>
                            <span className={`profit-pill ${profitCls}`}>{hasBothPrices ? `£${profit.toFixed(2)}` : '–'}</span>
                        </div>
                        {(() => {
                            const plRaw = f['Payment Link'];
                            const plDraft = paymentLinkDraft[booking.id];
                            const plValue = plDraft !== undefined ? plDraft : (plRaw || '');
                            const plFlashed = !!paymentLinkSavedFlash[booking.id];
                            const plFilled = plRaw && String(plRaw).trim();
                            const plBorder = plFlashed ? '#16a34a' : (plFilled ? 'var(--amber)' : '#fca5a5');
                            const plBg = plFlashed ? '#dcfce7' : (plFilled ? '#fffbeb' : '#fef2f2');
                            return (
                                <div style={{ marginTop: '4px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--amber-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>Payment Link (Revolut, etc.)</div>
                                    <input
                                        type="url"
                                        inputMode="url"
                                        placeholder="Paste payment link here…"
                                        value={plValue}
                                        disabled={paymentLinkSavingId === booking.id}
                                        onChange={e => setPaymentLinkDraft(prev => ({ ...prev, [booking.id]: e.target.value }))}
                                        onBlur={e => {
                                            const v = e.target.value;
                                            const old = plRaw || '';
                                            if (v !== old) commitPaymentLink(booking.id, v);
                                            setPaymentLinkDraft(prev => { const n = { ...prev }; delete n[booking.id]; return n; });
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: `2px solid ${plBorder}`,
                                            background: plBg,
                                            borderRadius: '8px',
                                            fontFamily: 'inherit',
                                            fontSize: '14px',
                                            color: 'var(--navy-ink)',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {(() => {
                        const sentAlready = status !== 'Pending';
                        const canSend = !sentAlready && cpRaw != null && Number(cpRaw) > 0 && priceSavingId !== booking.id;
                        return (
                            <button
                                onClick={() => handleSendQuote(booking)}
                                disabled={!canSend || sendingQuote}
                                style={{
                                    marginTop: '14px',
                                    width: '100%',
                                    padding: '14px',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    fontSize: '15px',
                                    cursor: canSend && !sendingQuote ? 'pointer' : 'not-allowed',
                                    background: canSend ? 'var(--amber)' : '#e5e7eb',
                                    color: canSend ? 'var(--navy-ink)' : '#6b7280',
                                    fontFamily: 'inherit'
                                }}>
                                {sendingQuote
                                    ? 'Sending quote…'
                                    : sentAlready
                                        ? `Quote already sent (${status})`
                                        : cpRaw == null || Number(cpRaw) <= 0
                                            ? 'Enter Customer Price first'
                                            : `Send Quote to Customer — £${Number(cpRaw).toFixed(2)}`}
                            </button>
                        );
                    })()}

                    {isSuper && status === 'Awaiting Payment' && (
                        <button
                            onClick={() => handleAcknowledgePayment(booking)}
                            disabled={acknowledgingId === booking.id}
                            style={{
                                marginTop: '10px',
                                width: '100%',
                                padding: '14px',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '15px',
                                cursor: acknowledgingId === booking.id ? 'wait' : 'pointer',
                                background: acknowledgingId === booking.id ? '#a7f3d0' : '#10b981',
                                color: 'white',
                                fontFamily: 'inherit'
                            }}>
                            {acknowledgingId === booking.id
                                ? 'Acknowledging…'
                                : `✓ Acknowledge Payment & Send Driver Details${(f['Customer Price'] || f['Total Price']) ? ` (£${f['Customer Price'] || f['Total Price']})` : ''}`}
                        </button>
                    )}
                </div>

                {/* Trip details */}
                <div className="card" style={{ padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontFamily: 'Lexend', fontSize: '16px' }}>🧳 Trip</h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {detail('Customer', `${f['Customer Name'] || ''} · ${f['Customer Phone'] || ''}`)}
                        {detail('Trip Type', isReturn ? 'Return' : `One Way (${f['Oneway Direction'] === 'from' ? 'From' : 'To'} airport)`)}
                        {detail('Airport', f['Airport'])}
                        {detail('Outbound', `${fmtUKDate(f['Outbound Date'])} ${f['Outbound Time'] || ''}`.trim())}
                        {f['Outbound Flight'] && detail('Flight', f['Outbound Flight'])}
                        {isReturn && detail('Return', `${fmtUKDate(f['Return Date'])} ${f['Return Time'] || ''}`.trim())}
                        {detail('Pickup', f['Home Address'])}
                        {detail('Pax / Bags', `${f['Passengers'] || 0} pax · ${f['Luggage'] || 0} bags`)}
                        {f['Notes'] && detail('Notes', f['Notes'])}
                    </div>
                </div>

                {/* Assignment — admin only routes to an operator. The
                    operator chooses the driver in their own portal. */}
                <div className="card" style={{ padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontFamily: 'Lexend', fontSize: '16px' }}>🏷️ Operator</h3>
                    <select value={currentOp} onChange={e => handleReassignSingle(booking.id, e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid var(--line)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '15px' }}>
                        <option value="">Unassigned</option>
                        {operators.map(op => <option key={op.id} value={op.name}>{op.name}</option>)}
                    </select>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                        The operator allocates a driver from their own dispatch portal.
                    </div>
                </div>

                <a
                    href={`/operator.html?ref=${encodeURIComponent(f['Booking Ref'])}`}
                    style={{ display: 'block', textAlign: 'center', padding: '14px', background: 'var(--amber)', color: 'var(--navy-ink)', textDecoration: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '15px' }}>
                    Open in Dispatch Portal →
                </a>
            </div>
        </div>
    );
}

function AdminApp() {
    const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('adminLoggedIn') === 'true');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [operators, setOperators] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('jobs'); // jobs | operators
    const [jobsSearch, setJobsSearch] = useState('');

    // If the URL carries ?ref=ATL-XXXX (an SMS deep-link), focus on that
    // single job in a mobile-friendly card view.
    const initialFocusRef = (() => {
        try { return new URLSearchParams(window.location.search).get('ref') || ''; }
        catch (e) { return ''; }
    })();
    const [focusRef, setFocusRef] = useState(initialFocusRef);

    // New operator form
    const [newOp, setNewOp] = useState({ name: '', username: '', password: '', phone: '', email: '' });
    const [isAdding, setIsAdding] = useState(false);

    // Job assignment
    const [assignOperator, setAssignOperator] = useState('RM Transfers');
    const [isAssigning, setIsAssigning] = useState(false);

    // Drivers list
    const [driversList, setDriversList] = useState([]);

    // Price editing
    const [editingPriceId, setEditingPriceId] = useState(null);
    const [costPriceVal, setCostPriceVal] = useState('');
    const [opPriceVal, setOpPriceVal] = useState('');
    const [isSavingPrice, setIsSavingPrice] = useState(false);

    // Inline price drafts (per booking id) — what the user has typed in the
    // always-visible price boxes but hasn't yet committed. Empty string means
    // "show whatever Airtable has". A trailing flag tracks per-row save state.
    const [priceDraftCustomer, setPriceDraftCustomer] = useState({});
    const [priceDraftOperator, setPriceDraftOperator] = useState({});
    const [priceSavingId, setPriceSavingId] = useState(null);
    const [priceSavedFlash, setPriceSavedFlash] = useState({});

    // Send-quote state for the focused job card
    const [sendingQuote, setSendingQuote] = useState(false);

    // Acknowledge-payment (super admin only)
    const [acknowledgingId, setAcknowledgingId] = useState(null);
    const handleAcknowledgePayment = async (record) => {
        const f = record.fields;
        if (!f['Driver Name'] || !f['Driver Phone']) {
            return alert('No driver allocated yet — the operator needs to allocate a driver in the operator portal before payment can be acknowledged. The customer SMS includes the driver details.');
        }
        if (!window.confirm(`Acknowledge payment of £${f['Customer Price'] || f['Total Price'] || '?'} from ${f['Customer Name'] || 'customer'}?\n\nThis sets the booking to Accepted and sends the customer the driver details.`)) return;
        setAcknowledgingId(record.id);
        try {
            const patchRes = await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: record.id, fields: { Status: 'Accepted' } })
            });
            const patchData = await patchRes.json();
            if (patchData.error) throw new Error(patchData.error);

            const smsRes = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send-confirmation', fields: f })
            });
            const smsData = await smsRes.json();
            if (smsData.error) alert('Booking marked Accepted but confirmation SMS failed: ' + smsData.error);

            fetchBookings();
        } catch (err) {
            alert('Could not acknowledge payment: ' + err.message);
        } finally {
            setAcknowledgingId(null);
        }
    };

    // Payment link drafts (per booking id) — same blur-to-save pattern as prices
    const [paymentLinkDraft, setPaymentLinkDraft] = useState({});
    const [paymentLinkSavingId, setPaymentLinkSavingId] = useState(null);
    const [paymentLinkSavedFlash, setPaymentLinkSavedFlash] = useState({});

    const commitPaymentLink = async (bookingId, rawValue) => {
        const value = (rawValue ?? '').toString().trim();
        setPaymentLinkSavingId(bookingId);
        try {
            const res = await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookingId, fields: { 'Payment Link': value } })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setPaymentLinkSavedFlash(prev => ({ ...prev, [bookingId]: Date.now() }));
            setTimeout(() => setPaymentLinkSavedFlash(prev => { const n = { ...prev }; delete n[bookingId]; return n; }), 1500);
            fetchBookings();
        } catch (err) {
            alert('Could not save Payment Link: ' + err.message);
        } finally {
            setPaymentLinkSavingId(null);
        }
    };

    const handleSendQuote = async (record) => {
        const f = record.fields;
        const cp = f['Customer Price'];
        if (cp == null || Number(cp) <= 0) {
            return alert('Enter a Customer Price before sending the quote.');
        }
        if (!f['Customer Phone']) {
            return alert('No customer phone number on this booking.');
        }
        if (!window.confirm(`Send quote of £${Number(cp).toFixed(2)} to ${f['Customer Name'] || 'the customer'} (${f['Customer Phone']})?`)) return;

        setSendingQuote(true);
        try {
            // 1. Move status forward
            const patchRes = await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: record.id,
                    fields: {
                        'Status': 'Awaiting Confirmation',
                        // Mirror Customer Price into Total Price so any legacy
                        // code paths reading Total Price keep working.
                        'Total Price': Number(cp)
                    }
                })
            });
            const patchData = await patchRes.json();
            if (patchData.error) throw new Error(patchData.error);

            // 2. Fire the SMS
            const smsRes = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send-price-quote',
                    fields: {
                        'Booking Ref': f['Booking Ref'],
                        'Customer Name': f['Customer Name'],
                        'Customer Phone': f['Customer Phone'],
                        'Customer Price': Number(cp),
                        'Total Price': Number(cp)
                    }
                })
            });
            const smsData = await smsRes.json();
            if (smsData.error) throw new Error('Quote saved but SMS failed: ' + smsData.error);

            fetchBookings();
            alert(`Quote of £${Number(cp).toFixed(2)} sent to ${f['Customer Name'] || 'customer'}.`);
        } catch (err) {
            alert('Could not send quote: ' + err.message);
        } finally {
            setSendingQuote(false);
        }
    };

    const commitPrice = async (bookingId, field, rawValue) => {
        // field is 'Customer Price' or 'Operator Price'
        const trimmed = (rawValue ?? '').toString().trim();
        const parsed = trimmed === '' ? null : parseFloat(trimmed);
        if (parsed !== null && !Number.isFinite(parsed)) return; // ignore garbage

        // Build the patch. When the user enters a Customer Price and the
        // Operator Price is still empty, default Operator Price to the same
        // figure (the admin can then change it). This keeps Profit at £0
        // until they explicitly mark the operator down.
        const patchFields = { [field]: parsed };
        if (field === 'Customer Price' && parsed != null) {
            const booking = bookings.find(x => x.id === bookingId);
            const existingOp = booking && booking.fields['Operator Price'];
            if (existingOp == null) patchFields['Operator Price'] = parsed;
        }

        setPriceSavingId(bookingId);
        try {
            const res = await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookingId, fields: patchFields })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setPriceSavedFlash(prev => ({ ...prev, [bookingId]: Date.now() }));
            setTimeout(() => setPriceSavedFlash(prev => { const n = { ...prev }; delete n[bookingId]; return n; }), 1500);
            fetchBookings();
        } catch (err) {
            alert('Could not save ' + field + ': ' + err.message);
        } finally {
            setPriceSavingId(null);
        }
    };

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
            if (data.token) localStorage.setItem('adminToken', data.token);
            if (data.isSuperAdmin) localStorage.setItem('adminIsSuper', 'true');
            else localStorage.removeItem('adminIsSuper');
            if (data.adminName) localStorage.setItem('adminName', data.adminName);
            setIsLoggedIn(true);
        })
        .catch(err => setLoginError(err.message))
        .finally(() => setIsLoggingIn(false));
    };

    const handleLogout = () => {
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminIsSuper');
        localStorage.removeItem('adminName');
        setIsLoggedIn(false);
    };

    const fetchOperators = () => {
        fetch('/api/operators')
            .then(r => r.json())
            .then(data => setOperators(data.operators || []))
            .catch(err => console.error('Failed to fetch operators:', err));
    };

    const fetchDrivers = () => {
        fetch('/api/drivers')
            .then(r => r.json())
            .then(data => setDriversList(data.drivers || []))
            .catch(err => console.error('Failed to fetch drivers:', err));
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
            fetchDrivers();
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

    const handleReassignDriver = async (bookingId, driverName) => {
        const matched = driversList.find(d => d.name === driverName);
        const fields = {
            'Driver Name': driverName || '',
            'Driver Phone': matched ? matched.phone : ''
        };
        try {
            await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookingId, fields })
            });
            fetchBookings();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleReassignReturnDriver = async (bookingId, driverName) => {
        const matched = driversList.find(d => d.name === driverName);
        const fields = {
            'Return Driver Name': driverName || '',
            'Return Driver Phone': matched ? matched.phone : ''
        };
        try {
            await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookingId, fields })
            });
            fetchBookings();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const startEditPrice = (b) => {
        setEditingPriceId(b.id);
        setCostPriceVal(b.fields['Customer Price'] ?? '');
        setOpPriceVal(b.fields['Operator Price'] ?? '');
    };

    const handleSavePrice = async (bookingId) => {
        setIsSavingPrice(true);
        try {
            await fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookingId, fields: {
                    'Customer Price': costPriceVal !== '' ? parseFloat(costPriceVal) : null,
                    'Operator Price': opPriceVal !== '' ? parseFloat(opPriceVal) : null
                }})
            });
            setEditingPriceId(null);
            fetchBookings();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsSavingPrice(false);
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
    const isSuper = (typeof localStorage !== 'undefined') && localStorage.getItem('adminIsSuper') === 'true';

    // Default the Operator on freshly-arrived bookings to "RM Transfers"
    // until we have other operators routinely receiving work. Admin can
    // change the Operator dropdown afterwards. Driver assignment is the
    // operator's job, not admin's, so we don't seed Driver Name here.
    const DEFAULT_OPERATOR = 'RM Transfers';
    const defaultsAppliedRef = React.useRef(new Set());
    useEffect(() => {
        if (!isLoggedIn || loading || activeBookings.length === 0) return;
        for (const b of activeBookings) {
            if (defaultsAppliedRef.current.has(b.id)) continue;
            const f = b.fields;
            const status = f['Status'] || 'Pending';
            if (status !== 'Pending') {
                defaultsAppliedRef.current.add(b.id);
                continue;
            }
            if (f['Operator']) {
                defaultsAppliedRef.current.add(b.id);
                continue;
            }
            defaultsAppliedRef.current.add(b.id);
            fetch('/api/booking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: b.id, fields: { 'Operator': DEFAULT_OPERATOR } })
            })
            .then(r => r.json())
            .then(d => { if (!d.error) fetchBookings(); })
            .catch(err => console.error('Default seed failed for', b.id, err));
        }
    }, [isLoggedIn, loading, activeBookings]);

    // ─── SMS deep-link: single-job card view ───────────────────────
    if (focusRef) {
        const focusBooking = bookings.find(b => (b.fields['Booking Ref'] || '').toLowerCase() === focusRef.toLowerCase());
        return (
            <FocusedJobCard
                bookingRef={focusRef}
                booking={focusBooking}
                loading={loading}
                operators={operators}
                driversList={driversList}
                priceDraftCustomer={priceDraftCustomer}
                priceDraftOperator={priceDraftOperator}
                setPriceDraftCustomer={setPriceDraftCustomer}
                setPriceDraftOperator={setPriceDraftOperator}
                priceSavingId={priceSavingId}
                priceSavedFlash={priceSavedFlash}
                commitPrice={commitPrice}
                paymentLinkDraft={paymentLinkDraft}
                setPaymentLinkDraft={setPaymentLinkDraft}
                paymentLinkSavingId={paymentLinkSavingId}
                paymentLinkSavedFlash={paymentLinkSavedFlash}
                commitPaymentLink={commitPaymentLink}
                handleReassignDriver={handleReassignDriver}
                handleReassignReturnDriver={handleReassignReturnDriver}
                handleReassignSingle={handleReassignSingle}
                handleSendQuote={handleSendQuote}
                sendingQuote={sendingQuote}
                isSuper={isSuper}
                handleAcknowledgePayment={handleAcknowledgePayment}
                acknowledgingId={acknowledgingId}
                onClose={() => {
                    setFocusRef('');
                    // Drop the ref from the URL without a reload
                    try {
                        const u = new URL(window.location.href);
                        u.searchParams.delete('ref');
                        window.history.replaceState({}, '', u.toString());
                    } catch (e) {}
                }}
                onLogout={handleLogout}
            />
        );
    }

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
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {localStorage.getItem('adminIsSuper') === 'true' && (
                        <a href="/superadmin.html" style={{ background: 'var(--amber)', color: 'var(--navy-ink)', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, fontSize: '14px' }}>💰 Finance</a>
                    )}
                    <a href="/stats.html" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>Stats</a>
                    {operators.length <= 1 ? (
                        <a href={operators.length === 1 ? `/operator.html?as=${encodeURIComponent(operators[0].username || operators[0].name)}` : '/operator.html'} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px' }}>Operator Portal →</a>
                    ) : (
                        <select
                            onChange={e => {
                                const v = e.target.value;
                                if (!v) return;
                                window.location.href = `/operator.html?as=${encodeURIComponent(v)}`;
                            }}
                            defaultValue=""
                            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer' }}>
                            <option value="" disabled style={{ color: 'var(--navy-ink)' }}>Operator Portal →</option>
                            {operators.map(op => (
                                <option key={op.id} value={op.username || op.name} style={{ color: 'var(--navy-ink)' }}>
                                    {op.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Log Out</button>
                </div>
            </div>

            <div className="wrap">
                {/* Tab controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <button onClick={() => setView('jobs')} style={{ padding: '10px 20px', borderRadius: '8px', border: view === 'jobs' ? '2px solid var(--navy)' : '1px solid var(--line)', background: view === 'jobs' ? 'var(--navy)' : 'white', color: view === 'jobs' ? 'white' : 'var(--ink)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>
                        Job Assignments {unassignedCount > 0 && <span style={{ background: '#e53e3e', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '12px', marginLeft: '6px' }}>{unassignedCount}</span>}
                    </button>
                    <button onClick={() => setView('operators')} style={{ padding: '10px 20px', borderRadius: '8px', border: view === 'operators' ? '2px solid var(--navy)' : '1px solid var(--line)', background: view === 'operators' ? 'var(--navy)' : 'white', color: view === 'operators' ? 'white' : 'var(--ink)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>
                        Manage Operators ({operators.length})
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
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                <h2 style={{ fontFamily: 'Lexend', fontSize: '18px', margin: 0 }}>Active Bookings ({activeBookings.length})</h2>
                                <input
                                    type="search"
                                    value={jobsSearch}
                                    onChange={e => setJobsSearch(e.target.value)}
                                    placeholder="Search ref, customer, phone, driver, operator…"
                                    style={{ flex: '0 1 320px', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px' }}
                                />
                            </div>
                            {loading ? (
                                <div className="loading">Loading...</div>
                            ) : (() => {
                                const filtered = activeBookings
                                    .filter(b => {
                                        const q = jobsSearch.trim().toLowerCase();
                                        if (!q) return true;
                                        const f = b.fields;
                                        return [
                                            f['Booking Ref'], f['Customer Name'], f['Customer Phone'],
                                            f['Driver Name'], f['Return Driver Name'], f['Operator'],
                                            f['Customer Email'], f['Home Address'], f['Status']
                                        ].some(v => v && String(v).toLowerCase().includes(q));
                                    })
                                    .sort((a, b) => {
                                        const da = new Date(a.fields['Submitted At'] || 0).getTime();
                                        const db = new Date(b.fields['Submitted At'] || 0).getTime();
                                        return db - da;
                                    });
                                if (filtered.length === 0) {
                                    return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>{jobsSearch.trim() ? `No bookings match "${jobsSearch}".` : 'No active bookings.'}</div>;
                                }
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        {filtered.map(b => {
                                            const f = b.fields;
                                            const currentOp = f['Operator'] || '';
                                            const cpRaw = f['Customer Price'];
                                            const opRaw = f['Operator Price'];
                                            const cpDraft = priceDraftCustomer[b.id];
                                            const opDraft = priceDraftOperator[b.id];
                                            const cpValue = cpDraft !== undefined ? cpDraft : (cpRaw != null ? String(cpRaw) : '');
                                            const opValue = opDraft !== undefined ? opDraft : (opRaw != null ? String(opRaw) : '');
                                            const flashed = !!priceSavedFlash[b.id];
                                            const cpClass = `price-cell${flashed ? ' saved' : (cpRaw == null && cpDraft === undefined ? ' empty' : '')}`;
                                            const opClass = `price-cell${flashed ? ' saved' : (opRaw == null && opDraft === undefined ? ' empty' : '')}`;
                                            const profit = (Number(cpRaw) || 0) - (Number(opRaw) || 0);
                                            const hasBoth = cpRaw != null && opRaw != null;
                                            const profitCls = !hasBoth ? 'zero' : profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'zero';
                                            const plRaw = f['Payment Link'];
                                            const plDraft = paymentLinkDraft[b.id];
                                            const plValue = plDraft !== undefined ? plDraft : (plRaw || '');
                                            const plFlashed = !!paymentLinkSavedFlash[b.id];
                                            const plFilled = plRaw && String(plRaw).trim();
                                            const plBorder = plFlashed ? '#16a34a' : (plFilled ? 'var(--amber)' : '#fca5a5');
                                            const plBg = plFlashed ? '#dcfce7' : (plFilled ? '#fffbeb' : '#fef2f2');
                                            const status = f['Status'] || 'Pending';
                                            const sentAlready = status !== 'Pending';
                                            const canSend = !sentAlready && cpRaw != null && Number(cpRaw) > 0 && priceSavingId !== b.id;
                                            return (
                                                <div key={b.id} style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'white' }}>
                                                    {/* Top row: ref + customer + status + open in dispatch */}
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
                                                            <strong style={{ fontSize: '16px', fontFamily: 'Lexend' }}>{f['Booking Ref']}</strong>
                                                            <span style={{ color: 'var(--navy-ink)' }}>{f['Customer Name']}</span>
                                                            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{fmtUKDate(f['Outbound Date'])} {f['Outbound Time'] || ''}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '999px', fontWeight: 700, background: status === 'Accepted' ? '#dcfce7' : status === 'Declined' ? '#fee2e2' : '#fef3c7', color: status === 'Accepted' ? '#166534' : status === 'Declined' ? '#b91c1c' : '#92400e' }}>{status}</span>
                                                            <a href={`/operator.html?ref=${encodeURIComponent(f['Booking Ref'])}`} style={{ fontSize: '12px', color: 'var(--navy)', textDecoration: 'none', fontWeight: 600 }}>Dispatch →</a>
                                                        </div>
                                                    </div>

                                                    {/* Pricing grid */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>Customer £</div>
                                                            <label className={cpClass} style={{ width: '100%' }}>
                                                                <span className="currency">£</span>
                                                                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={cpValue} disabled={priceSavingId === b.id}
                                                                    onChange={e => setPriceDraftCustomer(prev => ({ ...prev, [b.id]: e.target.value }))}
                                                                    onBlur={e => { const v = e.target.value; const old = cpRaw != null ? String(cpRaw) : ''; if (v !== old) commitPrice(b.id, 'Customer Price', v); setPriceDraftCustomer(prev => { const n = { ...prev }; delete n[b.id]; return n; }); }}
                                                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} />
                                                            </label>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>Operator £</div>
                                                            <label className={opClass} style={{ width: '100%' }}>
                                                                <span className="currency">£</span>
                                                                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={opValue} disabled={priceSavingId === b.id}
                                                                    onChange={e => setPriceDraftOperator(prev => ({ ...prev, [b.id]: e.target.value }))}
                                                                    onBlur={e => { const v = e.target.value; const old = opRaw != null ? String(opRaw) : ''; if (v !== old) commitPrice(b.id, 'Operator Price', v); setPriceDraftOperator(prev => { const n = { ...prev }; delete n[b.id]; return n; }); }}
                                                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} />
                                                            </label>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Profit</div>
                                                            <span className={`profit-pill ${profitCls}`} style={{ display: 'inline-block', padding: '8px 12px', fontSize: '15px' }}>{hasBoth ? `£${profit.toFixed(2)}` : '–'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Payment link full-width */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber-deep)', textTransform: 'uppercase', marginBottom: '4px' }}>Payment Link</div>
                                                        <input type="url" inputMode="url" placeholder="Paste payment link…" value={plValue} disabled={paymentLinkSavingId === b.id}
                                                            onChange={e => setPaymentLinkDraft(prev => ({ ...prev, [b.id]: e.target.value }))}
                                                            onBlur={e => { const v = e.target.value; const old = plRaw || ''; if (v !== old) commitPaymentLink(b.id, v); setPaymentLinkDraft(prev => { const n = { ...prev }; delete n[b.id]; return n; }); }}
                                                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                                            style={{ width: '100%', padding: '10px 12px', border: `2px solid ${plBorder}`, background: plBg, borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', color: 'var(--navy-ink)', outline: 'none', boxSizing: 'border-box' }} />
                                                    </div>

                                                    {/* Operator routing — admin only assigns the operator. */}
                                                    <div style={{ marginBottom: '14px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Operator</div>
                                                        <select value={currentOp} onChange={e => handleReassignSingle(b.id, e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', fontWeight: currentOp ? 600 : 400, color: currentOp ? 'var(--navy-ink)' : '#e53e3e' }}>
                                                            <option value="">Unassigned</option>
                                                            {operators.map(op => <option key={op.id} value={op.name}>{op.name}</option>)}
                                                        </select>
                                                        {f['Driver Name'] && (
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                                                                Driver allocated by operator: <strong style={{ color: 'var(--navy-ink)' }}>{f['Driver Name']}</strong>
                                                                {f['Driver Phone'] ? ` (${f['Driver Phone']})` : ''}
                                                                {f['Trip Type'] === 'return' && f['Return Driver Name'] && f['Return Driver Name'] !== f['Driver Name'] && <> · Return: <strong style={{ color: '#7c3aed' }}>{f['Return Driver Name']}</strong></>}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Send Quote */}
                                                    <button onClick={() => handleSendQuote(b)} disabled={!canSend || sendingQuote}
                                                        style={{ width: '100%', padding: '12px', background: canSend ? 'var(--amber)' : '#e5e7eb', color: canSend ? 'var(--navy-ink)' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: canSend && !sendingQuote ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                                                        {sendingQuote ? 'Sending quote…' : sentAlready ? `Quote already sent (${status})` : cpRaw == null || Number(cpRaw) <= 0 ? 'Enter Customer Price first' : `Send Quote to Customer — £${Number(cpRaw).toFixed(2)}`}
                                                    </button>

                                                    {/* Acknowledge Payment — super admin only, shown once status is Awaiting Payment */}
                                                    {isSuper && status === 'Awaiting Payment' && (
                                                        <button onClick={() => handleAcknowledgePayment(b)} disabled={acknowledgingId === b.id}
                                                            style={{ width: '100%', padding: '12px', marginTop: '10px', background: acknowledgingId === b.id ? '#a7f3d0' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: acknowledgingId === b.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                                                            {acknowledgingId === b.id ? 'Acknowledging…' : `✓ Acknowledge Payment & Send Driver Details${(f['Customer Price'] || f['Total Price']) ? ` (£${f['Customer Price'] || f['Total Price']})` : ''}`}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AdminApp />);
