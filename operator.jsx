const { useState, useEffect } = React;

// Operators don't deal with money. Translate the underlying booking status
// (which uses admin-side language like 'Awaiting Payment') into a label
// that's relevant to a dispatch operator.
const operatorStatusLabel = (status) => {
    switch (status) {
        case 'Pending': return 'Pending Quote';
        case 'Awaiting Confirmation': return 'Awaiting Customer';
        case 'Awaiting Payment':
            return 'Awaiting Allocation';
        case 'Accepted': return 'Confirmed';
        case 'Declined': return 'Declined';
        case 'Completed': return 'Completed';
        default: return status || 'Pending';
    }
};

// UK date helper — see admin.jsx for canonical version.
const fmtUKDate = (raw) => {
    if (!raw) return '—';
    const s = String(raw);
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB');
};

function AdminApp() {
    // If admin is opening this portal with ?as=<operator>, treat the previous
    // session as stale and force a fresh SSO. Without this, an admin who
    // just visited RM Transfers's portal will see RM Transfers's jobs for a
    // moment when they then click into Graham Operator's, because the
    // localStorage from the previous session leaks through during the SSO
    // round-trip.
    const _ssoTarget = (() => {
        try { return new URLSearchParams(window.location.search).get('as') || ''; }
        catch (e) { return ''; }
    })();
    const _ssoIsAdmin = (typeof localStorage !== 'undefined') && localStorage.getItem('adminIsSuper') === 'true';
    if (_ssoTarget && _ssoIsAdmin) {
        // Wipe operator session synchronously before render so the filter
        // can't briefly show the previous operator's jobs.
        localStorage.removeItem('operatorLoggedIn');
        localStorage.removeItem('operatorName');
    }

    const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('operatorLoggedIn') === 'true');
    const [operatorName, setOperatorName] = useState(localStorage.getItem('operatorName') || '');
    const [username, setUsername] = useState(() => {
        // Admin can deep-link with ?as=<username> to pre-fill the login.
        try { return new URLSearchParams(window.location.search).get('as') || ''; }
        catch (e) { return ''; }
    });
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [bookings, setBookings] = useState([]);
    const [searchQuery, setSearchQuery] = useState(new URLSearchParams(window.location.search).get('ref') || '');
    const [viewMode, setViewMode] = useState('active');
    const [activeFilter, setActiveFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const [driversList, setDriversList] = useState([{ name: "Select a driver...", phone: "" }, { name: "Custom Driver", phone: "" }]);

    const [editingJob, setEditingJob] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [newDriverName, setNewDriverName] = useState('');
    const [newDriverPhone, setNewDriverPhone] = useState('');
    const [newDriverUsername, setNewDriverUsername] = useState('');
    const [newDriverPassword, setNewDriverPassword] = useState('');
    const [newDriverVehicleType, setNewDriverVehicleType] = useState('');
    const [newDriverVehicleReg, setNewDriverVehicleReg] = useState('');
    const [newDriverBadge, setNewDriverBadge] = useState('');
    const [isAddingDriver, setIsAddingDriver] = useState(false);
    const [showAddDriver, setShowAddDriver] = useState(false);

    const [driverNames, setDriverNames] = useState({});
    const [driverPhones, setDriverPhones] = useState({});
    const [returnDriverNames, setReturnDriverNames] = useState({});
    const [returnDriverPhones, setReturnDriverPhones] = useState({});
    const [selectedDriver, setSelectedDriver] = useState(null);

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoggingIn(true);
        setLoginError('');

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, portal: 'operator' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            localStorage.setItem('operatorLoggedIn', 'true');
            localStorage.setItem('operatorName', data.operatorName || username);
            setOperatorName(data.operatorName || username);
            setIsLoggedIn(true);
        })
        .catch(err => setLoginError(err.message))
        .finally(() => setIsLoggingIn(false));
    };

    // Admin SSO: if ?as=<operatorUsername> is present AND the user is a
    // logged-in super admin, swap us into that operator's view without a
    // password. The synchronous wipe at the top of AdminApp ensures we
    // never render with the previous operator's name.
    useEffect(() => {
        if (!_ssoTarget) return;
        const adminUser = localStorage.getItem('adminName');
        if (!adminUser || !_ssoIsAdmin) return;

        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-SSO': adminUser },
            body: JSON.stringify({ username: _ssoTarget, password: '__sso__', portal: 'operator' })
        })
        .then(r => r.json())
        .then(data => {
            if (data.error || !data.success) {
                setLoginError(data.error || 'Admin SSO failed');
                return;
            }
            localStorage.setItem('operatorLoggedIn', 'true');
            localStorage.setItem('operatorName', data.operatorName || _ssoTarget);
            setOperatorName(data.operatorName || _ssoTarget);
            setIsLoggedIn(true);
            try {
                const u = new URL(window.location.href);
                u.searchParams.delete('as');
                window.history.replaceState({}, '', u.toString());
            } catch (e) {}
        })
        .catch(err => setLoginError('Admin SSO error: ' + err.message));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('operatorLoggedIn');
        localStorage.removeItem('operatorName');
        setOperatorName('');
        setIsLoggedIn(false);
    };

    const fetchBookings = () => {
        fetch('/api/booking?action=list&view=operator', { method: 'POST' })
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

    // Fetch THIS operator's drivers only. Pulled out so add/edit/delete
    // can refresh the list.
    const fetchDrivers = () => {
        if (!operatorName) return;
        fetch('/api/drivers?operator=' + encodeURIComponent(operatorName))
            .then(res => res.json())
            .then(data => {
                const fetched = data.drivers || [];
                setDriversList([
                    { name: "Select a driver...", phone: "" },
                    ...fetched,
                    { name: "Custom Driver", phone: "" }
                ]);
            })
            .catch(err => console.error("Failed to fetch drivers:", err));
    };

    useEffect(() => {
        if (isLoggedIn) fetchBookings();
    }, [isLoggedIn]);

    useEffect(() => {
        if (isLoggedIn && operatorName) fetchDrivers();
    }, [isLoggedIn, operatorName]);

    // Deep-link from new-booking SMS (?ref=ATL-XXXX). Once bookings have
    // loaded, scroll the matching card into view and briefly highlight it.
    useEffect(() => {
        if (!isLoggedIn || loading || !bookings.length) return;
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (!ref) return;
        const match = bookings.find(b => (b.fields['Booking Ref'] || '').toLowerCase() === ref.toLowerCase());
        if (!match) return;
        // Wait a tick for the filtered list to render
        setTimeout(() => {
            const el = document.getElementById('job-' + match.id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.style.transition = 'box-shadow 0.4s ease';
                el.style.boxShadow = '0 0 0 3px var(--amber)';
                setTimeout(() => { el.style.boxShadow = ''; }, 2500);
            }
        }, 200);
    }, [isLoggedIn, loading, bookings]);

    // Calendar Effect
    useEffect(() => {
        if (viewMode === 'calendar' && !loading) {
            const calendarEl = document.getElementById('calendar');
            if (calendarEl) {
                // Phone-first defaults. Below 768px we open a vertical
                // agenda (listWeek) and trim the toolbar; tablets/desktops
                // get the time-grid week view we always had.
                const isMobile = window.matchMedia('(max-width: 767px)').matches;
                const initialView = isMobile ? 'listWeek' : 'timeGridWeek';
                const headerToolbar = isMobile
                    ? { left: 'prev,next', center: 'title', right: 'today' }
                    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' };
                const footerToolbar = isMobile
                    ? { center: 'listWeek,dayGridMonth' }
                    : false;

                const calendar = new window.FullCalendar.Calendar(calendarEl, {
                    initialView,
                    headerToolbar,
                    footerToolbar,
                    titleFormat: isMobile ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'long' },
                    height: 'auto',
                    expandRows: true,
                    dayMaxEvents: isMobile ? 2 : true,
                    nowIndicator: true,
                    listDayFormat: { weekday: 'short', day: 'numeric', month: 'short' },
                    listDaySideFormat: false,
                    events: bookings.filter(b => b.fields['Status'] === 'Accepted' || b.fields['Status'] === 'Completed').flatMap(b => {
                        const status = b.fields['Status'] || 'Pending';
                        let color = 'var(--amber-deep)'; // Pending
                        if (status === 'Completed' || status === 'Accepted') color = '#10b981'; // Green
                        else if (status === 'Awaiting Payment') color = '#f59e0b'; // Amber
                        else if (status === 'Cancelled') color = '#e53e3e'; // Red
                        
                        const evs = [];
                        
                        if (b.fields['Outbound Date']) {
                            evs.push({
                                id: b.id + '-outbound',
                                title: `OUTBOUND: ${b.fields['Booking Ref']}`,
                                start: b.fields['Outbound Date'] + 'T' + (b.fields['Outbound Time'] || '00:00:00'),
                                color: color,
                                extendedProps: { record: b, tripPart: 'Outbound' }
                            });
                        }

                        if (b.fields['Trip Type'] === 'return' && b.fields['Return Date']) {
                            evs.push({
                                id: b.id + '-return',
                                title: `RETURN: ${b.fields['Booking Ref']}`,
                                start: b.fields['Return Date'] + 'T' + (b.fields['Return Time'] || '00:00:00'),
                                color: color,
                                extendedProps: { record: b, tripPart: 'Return' }
                            });
                        }
                        return evs;
                    }),
                    eventContent: function(arg) {
                        const record = arg.event.extendedProps.record;
                        const part = arg.event.extendedProps.tripPart;
                        const f = record.fields;
                        const isList = arg.view && arg.view.type && arg.view.type.startsWith('list');

                        const timeStr = arg.timeText || (arg.event.start ? arg.event.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '');
                        const flight = part === 'Outbound' ? f['Outbound Flight'] : f['Return Flight'];
                        const outDir = f['Oneway Direction'] === 'from' ? 'From' : 'To';
                        const retDir = f['Oneway Direction'] === 'from' ? 'To' : 'From';
                        const direction = part === 'Outbound' ? outDir : retDir;
                        const airport = f['Airport'] === 'Manchester' ? 'MAN' : 'LPL';
                        const customer = f['Customer Name'] || 'Customer';

                        if (isList) {
                            // Wider, comfier rendering for the list/agenda view used on phones.
                            return { html: `
                                <div style="padding: 4px 0; line-height: 1.45; cursor: pointer;">
                                    <div style="font-weight: 700; font-size: 14px; color: var(--navy-ink);">${f['Booking Ref']} · <span style="color: var(--muted); font-weight: 600;">${part}</span></div>
                                    <div style="font-size: 13px;">${customer} <span style="color: var(--muted);">(${f['Passengers']}pax ${f['Luggage'] || 0}bags)</span></div>
                                    <div style="font-size: 12px; color: var(--muted);">${direction} ${airport}${flight ? ` · ✈️ ${flight}` : ''}</div>
                                    <div style="font-size: 12px; color: var(--muted);">${f['Driver Name'] ? `🚗 ${f['Driver Name']}` : '🚗 <em>Unassigned</em>'}${part === 'Return' && f['Return Driver Name'] ? ` · 🔄 ${f['Return Driver Name']}` : ''}</div>
                                </div>
                            ` };
                        }

                        // Compact rendering for grid views (desktop).
                        return { html: `
                            <div style="font-size: 11px; padding: 3px 5px; line-height: 1.4; color: white; white-space: normal; overflow: hidden; cursor: pointer;">
                                <strong>${timeStr} | ${f['Booking Ref']}</strong><br/>
                                <strong>${customer}</strong> (${f['Passengers']}pax ${f['Luggage'] || 0}bags)<br/>
                                <strong>${part.toUpperCase()}</strong>: ${direction} ${airport}<br/>
                                ${flight ? `✈️ ${flight}<br/>` : ''}
                                ${f['Driver Name'] ? `🚗 ${f['Driver Name']}` : '🚗 <i>Unassigned</i>'}
                                ${part === 'Return' && f['Return Driver Name'] ? `<br/>🔄 Ret: ${f['Return Driver Name']}` : ''}
                            </div>
                        ` };
                    },
                    eventClick: function(info) {
                        openEditModal(info.event.extendedProps.record);
                    }
                });
                calendar.render();

                // Swap to the appropriate default view on viewport changes
                // so a tablet rotated to portrait still gets the agenda.
                const onResize = () => {
                    const nowMobile = window.matchMedia('(max-width: 767px)').matches;
                    const target = nowMobile ? 'listWeek' : 'timeGridWeek';
                    if (calendar.view && calendar.view.type !== target && (calendar.view.type === 'listWeek' || calendar.view.type === 'timeGridWeek')) {
                        calendar.changeView(target);
                    }
                };
                window.addEventListener('resize', onResize);

                return () => {
                    window.removeEventListener('resize', onResize);
                    calendar.destroy();
                };
            }
        }
    }, [viewMode, bookings, loading]);

    // Per-driver edit/delete state
    const [editingDriverId, setEditingDriverId] = useState(null);
    const [driverEditForm, setDriverEditForm] = useState({});
    const [isSavingDriver, setIsSavingDriver] = useState(false);

    const openEditDriverModal = (driver) => {
        setEditingDriverId(driver.id);
        setDriverEditForm({
            'Name': driver.name || '',
            'Phone': driver.phone || '',
            'Username': driver.username || '',
            'Vehicle Type': driver.vehicleType || '',
            'Vehicle Registration': driver.vehicleRegistration || '',
            'Badge Number': driver.badgeNumber || ''
        });
    };
    const closeEditDriverModal = () => {
        setEditingDriverId(null);
        setDriverEditForm({});
    };
    const handleSaveDriver = async (e) => {
        e.preventDefault();
        if (!editingDriverId) return;
        setIsSavingDriver(true);
        try {
            const res = await fetch('/api/drivers', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingDriverId, fields: driverEditForm, operator: operatorName })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            closeEditDriverModal();
            fetchDrivers();
        } catch (err) {
            alert('Could not update driver: ' + err.message);
        } finally {
            setIsSavingDriver(false);
        }
    };

    const handleDeleteDriver = async (driver) => {
        if (!window.confirm(`Permanently delete driver ${driver.name}? They will no longer be able to log in to the driver portal.`)) return;
        try {
            const res = await fetch('/api/drivers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: driver.id, operator: operatorName })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchDrivers();
        } catch (err) {
            alert('Could not delete driver: ' + err.message);
        }
    };

    const handleAddDriver = async (e) => {
        e.preventDefault();
        if (!newDriverName.trim()) return alert("Driver name is required.");
        if (!newDriverUsername.trim() || !newDriverPassword.trim()) {
            return alert("Username and password are required for portal login.");
        }
        if (!operatorName) return alert('Cannot add driver: not logged in as an operator.');

        setIsAddingDriver(true);
        try {
            const res = await fetch('/api/drivers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newDriverName.trim(),
                    phone: newDriverPhone.trim(),
                    username: newDriverUsername.trim(),
                    password: newDriverPassword.trim(),
                    vehicleType: newDriverVehicleType.trim(),
                    vehicleRegistration: newDriverVehicleReg.trim(),
                    badgeNumber: newDriverBadge.trim(),
                    operator: operatorName
                })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            fetchDrivers();

            setNewDriverName('');
            setNewDriverPhone('');
            setNewDriverUsername('');
            setNewDriverPassword('');
            setNewDriverVehicleType('');
            setNewDriverVehicleReg('');
            setNewDriverBadge('');
            setShowAddDriver(false);
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

    const handleReturnDriverSelection = (id, e) => {
        const selectedName = e.target.value;
        setReturnDriverNames(prev => ({ ...prev, [id]: selectedName }));
        
        const foundDriver = driversList.find(d => d.name === selectedName);
        if (foundDriver && foundDriver.phone) {
            setReturnDriverPhones(prev => ({ ...prev, [id]: foundDriver.phone }));
        }
    };

    const handleDriverNameChange = (id, name) => {
        setDriverNames(prev => ({ ...prev, [id]: name }));
    };

    const handleDriverPhoneChange = (id, phone) => {
        setDriverPhones(prev => ({ ...prev, [id]: phone }));
    };

    const handleReturnDriverNameChange = (id, name) => {
        setReturnDriverNames(prev => ({ ...prev, [id]: name }));
    };

    const handleReturnDriverPhoneChange = (id, phone) => {
        setReturnDriverPhones(prev => ({ ...prev, [id]: phone }));
    };

    // Operator allocates a driver to a booking that's been routed to them.
    // Quoting and payment are owned by the admin portal.
    const handleAssignDriver = (id) => {
        const driverName = driverNames[id];
        const driverPhone = driverPhones[id];
        const booking = bookings.find(b => b.id === id);

        if (!driverName || driverName.trim() === '') return alert('Please enter a driver name');
        if (!driverPhone || driverPhone.trim() === '') return alert('Please enter a driver phone number');

        setAssigningId(id);

        const isReturn = booking && booking.fields['Trip Type'] === 'return';
        const assignFields = {
            'Driver Name': driverName.trim(),
            'Driver Phone': driverPhone.trim()
        };
        if (isReturn) {
            const retName = returnDriverNames[id];
            const retPhone = returnDriverPhones[id];
            if (retName && retName.trim()) {
                assignFields['Return Driver Name'] = retName.trim();
                assignFields['Return Driver Phone'] = retPhone ? retPhone.trim() : '';
            }
        }

        fetch('/api/booking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, fields: assignFields })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            fetchBookings();
        })
        .catch(err => alert('Error assigning driver: ' + err.message))
        .finally(() => setAssigningId(null));
    };

    // openCreateModal lived here previously. New manual bookings are now
    // created from the admin portal — operators only edit existing jobs.

    const openEditModal = (record) => {
        setEditingJob(record.id);
        setEditForm({ ...record.fields });
    };

    const handleSaveBooking = (e) => {
        e.preventDefault();
        setIsSavingEdit(true);
        // Operator only edits existing jobs — manual booking creation lives
        // on the admin portal. Flag the booking so admin sees the change.
        const fieldsWithFlag = { ...editForm, 'Edited By Operator': true };
        fetch('/api/booking', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingJob, fields: fieldsWithFlag })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            setEditingJob(null);
            fetchBookings();
        })
        .catch(err => alert('Error updating booking: ' + err.message))
        .finally(() => setIsSavingEdit(false));
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
        if (action === 'send-confirmation') confirmText = "Resend driver details (name + phone) to customer?";

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

    const handleCloseJob = (record) => {
        if (!window.confirm("Are you sure you want to close this job and send the review invite?")) return;
        
        fetch('/api/driver-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: record.fields['Booking Ref'], action: 'close-job' })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            alert('Job closed and archived successfully!');
            fetchBookings();
        })
        .catch(err => alert('Error closing job: ' + err.message));
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

    // Filter bookings to this operator. A booking is visible to the
    // operator either when admin has explicitly dispatched it, OR once
    // payment has been acknowledged (Accepted/Completed/Archived) — at
    // which point the operator unambiguously owns it and needs to act.
    // Pre-payment bookings stay hidden until admin clicks Dispatch.
    const operatorBookings = operatorName ? bookings.filter(b => {
        const assignedOp = b.fields['Operator'] || '';
        if (assignedOp !== operatorName) return false;
        const status = b.fields['Status'] || '';
        const isPostPayment = status === 'Accepted' || status === 'Completed' || status === 'Archived';
        return b.fields['Dispatched To Operator'] === true || isPostPayment;
    }) : [];

    const filteredBookings = operatorBookings.filter(b => {
        const status = b.fields['Status'] || 'Pending';
        const isArchive = status === 'Archived' || status === 'Cancelled';
        
        if (viewMode === 'active' && isArchive) return false;
        if (viewMode === 'archive' && !isArchive) return false;

        if (viewMode === 'active' && activeFilter !== 'all') {
            if (activeFilter === 'enquiries' && status !== 'Pending') return false;
            if (activeFilter === 'awaiting_payment' && status !== 'Awaiting Payment') return false;
            if (activeFilter === 'paid' && status !== 'Accepted') return false;
            if (activeFilter === 'completed' && status !== 'Completed') return false;
        }

        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const ref = (b.fields['Booking Ref'] || '').toLowerCase();
        const name = (b.fields['Customer Name'] || '').toLowerCase();
        const phone = (b.fields['Customer Phone'] || '').toLowerCase();
        return ref.includes(query) || name.includes(query) || phone.includes(query);
    }).sort((a, b) => {
        const dateStrA = a.fields['Outbound Date'] || '9999-12-31';
        const timeStrA = a.fields['Outbound Time'] || '23:59';
        const dateStrB = b.fields['Outbound Date'] || '9999-12-31';
        const timeStrB = b.fields['Outbound Time'] || '23:59';
        
        const dateTimeA = new Date(`${dateStrA}T${timeStrA}`);
        const dateTimeB = new Date(`${dateStrB}T${timeStrB}`);
        
        if (viewMode === 'archive') {
            return dateTimeB - dateTimeA;
        }
        return dateTimeA - dateTimeB;
    });

    // ── Stats View — strictly scoped to this operator's own bookings.
    // Operators only see Operator Price (their fee), never Customer Price
    // or Profit, since those are admin-side numbers.
    const renderOperatorStats = () => {
        const num = (raw) => {
            if (typeof raw === 'number') return raw;
            if (raw == null) return 0;
            const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
            return Number.isFinite(n) ? n : 0;
        };
        const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });
        const now = new Date();

        // operatorBookings is computed above and only contains jobs that
        // belong to this operator (and are dispatched / post-payment).
        const my = operatorBookings;
        let earned = 0; let earnedJobs = 0;
        let upcoming = 0; let upcomingJobs = 0;
        let pendingDispatch = 0; let awaitingAllocation = 0; let completed = 0;
        const byMonth = {};
        const byDriver = {};
        const byAirport = {};

        for (const b of my) {
            const f = b.fields;
            const fee = num(f['Operator Price']);
            const status = f['Status'] || '';
            const tripDate = f['Outbound Date'] ? new Date(f['Outbound Date']) : null;
            const isPaid = status === 'Accepted' || status === 'Completed' || status === 'Archived';
            const isFuture = tripDate && tripDate > now;

            if (isPaid) {
                earnedJobs++;
                earned += fee;
                if (isFuture) {
                    upcomingJobs++;
                    upcoming += fee;
                }
            }
            if (status === 'Awaiting Payment') awaitingAllocation++;
            if (status === 'Pending' || status === 'Awaiting Confirmation') pendingDispatch++;
            if (status === 'Completed' || status === 'Archived') completed++;

            const monthKey = (f['Outbound Date'] || '').slice(0, 7) || 'unknown';
            if (!byMonth[monthKey]) byMonth[monthKey] = { jobs: 0, earned: 0 };
            byMonth[monthKey].jobs += 1;
            byMonth[monthKey].earned += fee;

            const drv = f['Driver Name'] || 'Unassigned';
            if (!byDriver[drv]) byDriver[drv] = { jobs: 0, earned: 0 };
            byDriver[drv].jobs += 1;
            byDriver[drv].earned += fee;

            const ap = f['Airport'] || 'Unknown';
            if (!byAirport[ap]) byAirport[ap] = { jobs: 0, earned: 0 };
            byAirport[ap].jobs += 1;
            byAirport[ap].earned += fee;
        }

        const aov = earnedJobs ? earned / earnedJobs : 0;
        const sortedMonths = Object.entries(byMonth).filter(([k]) => k !== 'unknown').sort();
        const sortedDrivers = Object.entries(byDriver).filter(([k]) => k !== 'Unassigned').sort((a, b) => b[1].earned - a[1].earned).slice(0, 10);
        const sortedAirports = Object.entries(byAirport).sort((a, b) => b[1].earned - a[1].earned);

        const card = { background: 'white', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
        const label = { fontSize: '12px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '6px' };
        const value = { fontFamily: 'Lexend, sans-serif', fontSize: '26px', fontWeight: 700, color: 'var(--navy-ink)', lineHeight: 1.1 };
        const sub = { fontSize: '12px', color: 'var(--muted)', marginTop: '6px' };
        const cell = { padding: '10px 12px', borderBottom: '1px solid var(--line)' };
        const right = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'rgba(14, 39, 71, 0.04)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--muted)' }}>
                    Stats below cover only jobs assigned to <strong style={{color: 'var(--navy-ink)'}}>{operatorName || 'you'}</strong>.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div style={card}>
                        <div style={label}>Total Earned</div>
                        <div style={value}>{fmt(earned)}</div>
                        <div style={sub}>{earnedJobs} paid jobs</div>
                    </div>
                    <div style={card}>
                        <div style={label}>Upcoming</div>
                        <div style={value}>{fmt(upcoming)}</div>
                        <div style={sub}>{upcomingJobs} jobs ahead</div>
                    </div>
                    <div style={card}>
                        <div style={label}>Avg per Job</div>
                        <div style={value}>{fmt(aov)}</div>
                        <div style={sub}>Across paid jobs</div>
                    </div>
                    <div style={card}>
                        <div style={label}>Pipeline</div>
                        <div style={{ ...value, fontSize: '20px', lineHeight: 1.4 }}>
                            {pendingDispatch}<span style={{fontSize:'12px', color:'var(--muted)', fontWeight:400}}> pending</span><br/>
                            {awaitingAllocation}<span style={{fontSize:'12px', color:'var(--muted)', fontWeight:400}}> awaiting allocation</span>
                        </div>
                        <div style={sub}>{completed} completed</div>
                    </div>
                </div>

                <div style={card}>
                    <h3 style={{ margin: '0 0 8px 0', fontFamily: 'Lexend', fontSize: '15px' }}>Earnings by Month</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '320px' }}>
                            <thead>
                                <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
                                    <th style={{ ...cell, textAlign: 'left' }}>Month</th>
                                    <th style={right}>Jobs</th>
                                    <th style={right}>Earned</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedMonths.length === 0 && (
                                    <tr><td colSpan="3" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No data yet.</td></tr>
                                )}
                                {sortedMonths.map(([k, s]) => (
                                    <tr key={k}>
                                        <td style={cell}>{k}</td>
                                        <td style={right}>{s.jobs}</td>
                                        <td style={right}>{fmt(s.earned)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={card}>
                    <h3 style={{ margin: '0 0 8px 0', fontFamily: 'Lexend', fontSize: '15px' }}>Top Drivers</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '320px' }}>
                            <thead>
                                <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
                                    <th style={{ ...cell, textAlign: 'left' }}>Driver</th>
                                    <th style={right}>Jobs</th>
                                    <th style={right}>Earned</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDrivers.length === 0 && (
                                    <tr><td colSpan="3" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No driver data yet.</td></tr>
                                )}
                                {sortedDrivers.map(([name, s]) => (
                                    <tr key={name}>
                                        <td style={cell}>{name}</td>
                                        <td style={right}>{s.jobs}</td>
                                        <td style={right}>{fmt(s.earned)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={card}>
                    <h3 style={{ margin: '0 0 8px 0', fontFamily: 'Lexend', fontSize: '15px' }}>By Airport</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '320px' }}>
                            <thead>
                                <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
                                    <th style={{ ...cell, textAlign: 'left' }}>Airport</th>
                                    <th style={right}>Jobs</th>
                                    <th style={right}>Earned</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAirports.length === 0 && (
                                    <tr><td colSpan="3" style={{...cell, color: 'var(--muted)', textAlign: 'center'}}>No data yet.</td></tr>
                                )}
                                {sortedAirports.map(([name, s]) => (
                                    <tr key={name}>
                                        <td style={cell}>{name}</td>
                                        <td style={right}>{s.jobs}</td>
                                        <td style={right}>{fmt(s.earned)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // ── Drivers View ──────────────────────────────────────────────────────
    const renderDriversView = () => {
        // The operator only manages their own drivers. Build the entries
        // straight from driversList (already scoped server-side to this
        // operator) and join in jobs from operatorBookings.
        const myDrivers = driversList.filter(d => d.name !== 'Select a driver...' && d.name !== 'Custom Driver');
        const driverJobMap = {};
        myDrivers.forEach(d => {
            driverJobMap[d.name] = {
                phone: d.phone || '',
                jobs: [],
                record: d
            };
        });
        operatorBookings.forEach(b => {
            const dName = b.fields['Driver Name'];
            if (!dName || !driverJobMap[dName]) return;
            driverJobMap[dName].jobs.push(b);
            if (!driverJobMap[dName].phone && b.fields['Driver Phone']) {
                driverJobMap[dName].phone = b.fields['Driver Phone'];
            }
        });

        const driverEntries = Object.entries(driverJobMap).sort((a, b) => a[0].localeCompare(b[0]));

        const statusColor = (s) => {
            if (s === 'Pending') return '#f59e0b';
            if (s === 'Awaiting Payment') return '#f59e0b';
            if (s === 'Accepted') return '#10b981';
            if (s === 'Completed') return '#3b82f6';
            if (s === 'Archived') return '#9ca3af';
            if (s === 'Cancelled') return '#e53e3e';
            return '#6b7280';
        };

        // If a driver is selected, show their jobs
        if (selectedDriver && driverJobMap[selectedDriver]) {
            const driverData = driverJobMap[selectedDriver];
            const activeJobs = driverData.jobs.filter(b => !['Archived', 'Cancelled'].includes(b.fields['Status']));
            const archivedJobs = driverData.jobs.filter(b => ['Archived', 'Cancelled'].includes(b.fields['Status']));

            return (
                <div>
                    <button 
                        onClick={() => setSelectedDriver(null)} 
                        style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        ← Back to All Drivers
                    </button>

                    <div style={{ background: 'var(--navy)', color: 'white', padding: '20px 24px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '22px' }}>🚗 {selectedDriver}</h2>
                            {driverData.phone && <div style={{ marginTop: '4px', fontSize: '14px', opacity: 0.8 }}>📞 {driverData.phone}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700 }}>{activeJobs.length}</div>
                                <div style={{ opacity: 0.7 }}>Active</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 700 }}>{driverData.jobs.length}</div>
                                <div style={{ opacity: 0.7 }}>Total</div>
                            </div>
                        </div>
                    </div>

                    {activeJobs.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--navy-ink)' }}>Active Jobs</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                {activeJobs.sort((a, b) => new Date(a.fields['Outbound Date'] + 'T' + (a.fields['Outbound Time'] || '00:00')) - new Date(b.fields['Outbound Date'] + 'T' + (b.fields['Outbound Time'] || '00:00'))).map(b => (
                                    <div key={b.id} style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px', borderLeft: `4px solid ${statusColor(b.fields['Status'])}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <strong style={{ fontSize: '15px' }}>{b.fields['Booking Ref']}</strong>
                                                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: statusColor(b.fields['Status']), color: 'white', fontWeight: 600 }}>{b.fields['Status']}</span>
                                            </div>
                                            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{fmtUKDate(b.fields['Outbound Date'])} @ {b.fields['Outbound Time']}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px' }}>
                                            <div><span style={{ color: 'var(--muted)' }}>Customer:</span> <strong>{b.fields['Customer Name']}</strong></div>
                                            <div><span style={{ color: 'var(--muted)' }}>Phone:</span> {b.fields['Customer Phone']}</div>
                                            <div><span style={{ color: 'var(--muted)' }}>Pickup:</span> {b.fields['Home Address']}</div>
                                            <div><span style={{ color: 'var(--muted)' }}>Airport:</span> {b.fields['Airport'] === 'Manchester' ? 'Manchester' : 'Liverpool'}</div>
                                            <div><span style={{ color: 'var(--muted)' }}>Flight:</span> {b.fields['Outbound Flight'] || 'N/A'}</div>
                                            <div><span style={{ color: 'var(--muted)' }}>Your fee:</span> {b.fields['Operator Price'] != null ? `£${b.fields['Operator Price']}` : <em style={{ color: '#9ca3af' }}>—</em>}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {archivedJobs.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--muted)' }}>Past Jobs ({archivedJobs.length})</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {archivedJobs.sort((a, b) => new Date(b.fields['Outbound Date'] + 'T' + (b.fields['Outbound Time'] || '00:00')) - new Date(a.fields['Outbound Date'] + 'T' + (a.fields['Outbound Time'] || '00:00'))).map(b => (
                                    <div key={b.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', opacity: 0.7, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                                        <div>
                                            <strong>{b.fields['Booking Ref']}</strong> — {b.fields['Customer Name']}
                                        </div>
                                        <div style={{ color: 'var(--muted)' }}>{fmtUKDate(b.fields['Outbound Date'])}{b.fields['Operator Price'] != null ? ` | £${b.fields['Operator Price']}` : ''}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {driverData.jobs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '15px' }}>
                            No jobs assigned to this driver yet.
                        </div>
                    )}
                </div>
            );
        }

        // Pre-compute the per-driver row data so both layouts share it.
        const rows = driverEntries.map(([name, data]) => {
            const activeJobs = data.jobs.filter(b => !['Archived', 'Cancelled'].includes(b.fields['Status']));
            const upcoming = activeJobs
                .filter(b => b.fields['Outbound Date'])
                .sort((a, b) => new Date(a.fields['Outbound Date'] + 'T' + (a.fields['Outbound Time'] || '00:00')) - new Date(b.fields['Outbound Date'] + 'T' + (b.fields['Outbound Time'] || '00:00')))[0];
            return { name, data, activeJobs, upcoming };
        });

        // Overview: drivers as cards (mobile) or table (>=768px). The
        // mobile-card / desktop-table swap is driven by the .drivers-table
        // / .drivers-cards CSS rules in operator.html.
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--navy-ink)' }}>Driver Overview</h2>
                    <button
                        type="button"
                        onClick={() => setShowAddDriver(true)}
                        style={{ padding: '10px 16px', background: 'var(--amber)', color: 'var(--navy-ink)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Add Driver
                    </button>
                </div>

                {/* Mobile-friendly card list (hidden on tablet+) */}
                <div className="drivers-cards" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {rows.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', background: 'white', border: '1px solid var(--line)', borderRadius: '12px' }}>
                            You haven't added any drivers yet. Tap <strong>+ Add Driver</strong> above.
                        </div>
                    )}
                    {rows.map(({ name, data, activeJobs, upcoming }) => (
                        <div key={name} style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--navy-ink)' }}>{name}</div>
                                    {data.phone && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>📞 {data.phone}</div>}
                                </div>
                                <span style={{ background: activeJobs.length > 0 ? '#dcfce7' : '#f3f4f6', color: activeJobs.length > 0 ? '#166534' : '#9ca3af', padding: '3px 10px', borderRadius: '999px', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {activeJobs.length} active · {data.jobs.length} total
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {upcoming ? (
                                    <>Next: <strong style={{ color: 'var(--navy-ink)' }}>{upcoming.fields['Booking Ref']}</strong> · {fmtUKDate(upcoming.fields['Outbound Date'])} @ {upcoming.fields['Outbound Time']}</>
                                ) : (
                                    <em>No upcoming jobs</em>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                <button onClick={() => setSelectedDriver(name)} style={{ flex: '1 1 100px', padding: '10px', background: 'white', color: 'var(--amber-deep)', border: '1px solid var(--amber)', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>View jobs</button>
                                {data.record && data.record.id && (
                                    <>
                                        <button onClick={() => openEditDriverModal(data.record)} style={{ flex: '1 1 80px', padding: '10px', background: 'white', color: 'var(--navy-ink)', border: '1px solid var(--line)', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                                        <button onClick={() => handleDeleteDriver(data.record)} style={{ flex: '1 1 80px', padding: '10px', background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop summary table (hidden on phones) */}
                <div className="drivers-table" style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--line)', overflow: 'hidden', marginBottom: '32px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: 'var(--navy)', color: 'white', textAlign: 'left' }}>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Driver</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Phone</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Active</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Total</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Next Job</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Manage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(({ name, data, activeJobs, upcoming }, i) => (
                                <tr key={name} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                    <td style={{ padding: '12px 16px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setSelectedDriver(name)}>{name} <span style={{ color: 'var(--amber-deep)', fontWeight: 400, fontSize: '11px' }}>view jobs →</span></td>
                                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{data.phone || '–'}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{ background: activeJobs.length > 0 ? '#dcfce7' : '#f3f4f6', color: activeJobs.length > 0 ? '#166534' : '#9ca3af', padding: '2px 10px', borderRadius: '12px', fontWeight: 600, fontSize: '13px' }}>{activeJobs.length}</span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>{data.jobs.length}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                        {upcoming ? (
                                            <span><strong>{upcoming.fields['Booking Ref']}</strong> — {fmtUKDate(upcoming.fields['Outbound Date'])} @ {upcoming.fields['Outbound Time']}</span>
                                        ) : (
                                            <span style={{ color: '#9ca3af' }}>No upcoming jobs</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {data.record && data.record.id && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); openEditDriverModal(data.record); }} style={{ background: 'transparent', color: 'var(--amber-deep)', border: '1px solid var(--amber)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', marginRight: '6px' }}>Edit</button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteDriver(data.record); }} style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>Delete</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>You haven't added any drivers yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Upcoming jobs across all drivers - next 7 days */}
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--navy-ink)' }}>Upcoming Jobs (All Drivers)</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {bookings
                        .filter(b => {
                            const status = b.fields['Status'];
                            if (['Archived', 'Cancelled'].includes(status)) return false;
                            if (!b.fields['Driver Name']) return false;
                            return true;
                        })
                        .sort((a, b) => new Date(a.fields['Outbound Date'] + 'T' + (a.fields['Outbound Time'] || '00:00')) - new Date(b.fields['Outbound Date'] + 'T' + (b.fields['Outbound Time'] || '00:00')))
                        .slice(0, 20)
                        .map(b => (
                            <div key={b.id} style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderLeft: `4px solid ${statusColor(b.fields['Status'])}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                                    <strong>{fmtUKDate(b.fields['Outbound Date'])} @ {b.fields['Outbound Time']}</strong>
                                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: statusColor(b.fields['Status']), color: 'white', fontWeight: 600 }}>{b.fields['Status']}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px', flexWrap: 'wrap' }}>
                                    <span><strong>{b.fields['Booking Ref']}</strong></span>
                                    <span>{b.fields['Customer Name']}</span>
                                    <span style={{ color: 'var(--muted)' }}>{b.fields['Home Address']?.substring(0, 30)}...</span>
                                    <span style={{ background: 'rgba(230,178,75,0.15)', color: 'var(--amber-deep)', padding: '2px 10px', borderRadius: '12px', fontWeight: 700, fontSize: '12px' }}>
                                        🚗 {b.fields['Driver Name']}
                                    </span>
                                </div>
                            </div>
                        ))
                    }
                    {bookings.filter(b => !['Archived', 'Cancelled'].includes(b.fields['Status']) && b.fields['Driver Name']).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '14px' }}>
                            No upcoming jobs with assigned drivers.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <img src="./assets/logo.png" alt="RM Transfers" style={{ height: '32px', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ margin: 0, lineHeight: 1.15 }}>Operator Dispatch</h1>
                        <div style={{fontSize: '12px', marginTop: '2px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>Logged in as {operatorName || 'Operator'}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleLogout}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                    >
                        Log Out
                    </button>
                </div>
            </div>
            
            <div className="wrap">
                <div style={{ marginBottom: '24px' }}>
                    <div className="segmented-control">
                        <button 
                            onClick={() => setViewMode('active')} 
                            className={`segmented-btn ${viewMode === 'active' ? 'active' : ''}`}
                        >
                            Active Jobs
                        </button>
                        <button 
                            onClick={() => setViewMode('calendar')} 
                            className={`segmented-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                        >
                            Calendar
                        </button>
                        <button 
                            onClick={() => setViewMode('archive')} 
                            className={`segmented-btn ${viewMode === 'archive' ? 'active' : ''}`}
                        >
                            Archive
                        </button>
                        <button
                            onClick={() => { setViewMode('drivers'); setSelectedDriver(null); }}
                            className={`segmented-btn ${viewMode === 'drivers' ? 'active' : ''}`}
                        >
                            Drivers
                        </button>
                        <button
                            onClick={() => setViewMode('stats')}
                            className={`segmented-btn ${viewMode === 'stats' ? 'active' : ''}`}
                        >
                            Stats
                        </button>
                    </div>
                </div>

                {viewMode === 'active' && (
                    <div style={{ marginBottom: '24px' }}>
                        <div className="filter-control">
                            <span style={{fontWeight: '600', marginRight: '8px', color: 'var(--navy-ink)', fontSize: '14px'}}>Filter:</span>
                            <button 
                                onClick={() => setActiveFilter('all')} 
                                className={`filter-btn filter-all ${activeFilter === 'all' ? 'active' : ''}`}
                            >
                                All Active
                            </button>
                            <button 
                                onClick={() => setActiveFilter('enquiries')} 
                                className={`filter-btn filter-enquiries ${activeFilter === 'enquiries' ? 'active' : ''}`}
                            >
                                Enquiries
                            </button>
                            <button
                                onClick={() => setActiveFilter('awaiting_payment')}
                                className={`filter-btn filter-awaiting ${activeFilter === 'awaiting_payment' ? 'active' : ''}`}
                            >
                                Awaiting Allocation
                            </button>
                            <button 
                                onClick={() => setActiveFilter('paid')} 
                                className={`filter-btn filter-paid ${activeFilter === 'paid' ? 'active' : ''}`}
                            >
                                Paid
                            </button>
                            <button 
                                onClick={() => setActiveFilter('completed')} 
                                className={`filter-btn filter-completed ${activeFilter === 'completed' ? 'active' : ''}`}
                            >
                                Completed (Review Pending)
                            </button>
                        </div>
                    </div>
                )}

                {viewMode !== 'calendar' && (
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                            <input
                                type="text"
                                placeholder="Search by ref, name, or phone..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', minWidth: 0, padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }}
                            />
                        </div>
                        {viewMode === 'drivers' && (
                            <button
                                type="button"
                                onClick={() => setShowAddDriver(true)}
                                style={{ padding: '12px 18px', background: 'var(--amber)', color: 'var(--navy-ink)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                + Add Driver
                            </button>
                        )}
                    </div>
                )}

                {error && <div style={{color: 'red', marginBottom: '20px'}}>{error}</div>}
                
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : viewMode === 'drivers' ? (
                    renderDriversView()
                ) : viewMode === 'calendar' ? (
                    <div id="calendar" className="calendar-shell"></div>
                ) : viewMode === 'stats' ? (
                    renderOperatorStats()
                ) : (
                    <div className="jobs-list">
                        {filteredBookings.map(record => {
                            const { id, fields } = record;
                            const status = fields['Status'] || 'Pending';
                            const isPending = status === 'Pending';
                            const isAwaitingConfirmation = status === 'Awaiting Confirmation';
                            const isAwaitingPayment = status === 'Awaiting Payment';
                            const isDeclined = status === 'Declined';
                            const isCompleted = status === 'Completed';
                            
                            return (
                                <div key={id} id={`job-${id}`} className="job-card" style={{opacity: isPending || isAwaitingConfirmation || isAwaitingPayment ? 1 : 0.6}}>
                                    <div className="job-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="job-ref">{fields['Booking Ref']}</div>
                                            <div className={`badge ${isPending || isAwaitingPayment ? 'badge-pending' : 'badge-accepted'}`}>
                                                {operatorStatusLabel(status)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => openEditModal(record)}
                                                style={{ background: 'transparent', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                            >
                                                Edit
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
                                            <strong>{fmtUKDate(fields['Outbound Date'])} @ {fields['Outbound Time']}</strong>
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
                                            <React.Fragment>
                                                <div className="detail">
                                                    <span>Return Date & Time</span>
                                                    <strong>{fmtUKDate(fields['Return Date'])} @ {fields['Return Time']}</strong>
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
                                            </React.Fragment>
                                        )}
                                        {fields['Notes'] && (
                                            <div className="detail" style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                <span>Notes</span>
                                                <strong style={{ whiteSpace: 'pre-wrap' }}>{fields['Notes']}</strong>
                                            </div>
                                        )}
                                    </div>

                                    {isPending ? (
                                        <div className="job-actions" style={{background: '#f9fafb', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '6px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600}}>⏳ Pending Quote</span>
                                            <span style={{fontSize: '13px', color: 'var(--muted)'}}>
                                                Admin is quoting the customer. You'll be asked to allocate a driver once the customer accepts.
                                            </span>
                                        </div>
                                    ) : isAwaitingConfirmation ? (
                                        <div className="job-actions" style={{background: '#fefce8', padding: '10px 14px', borderRadius: '8px', border: '1px solid #facc15', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600, color: '#a16207'}}>⏳ Awaiting customer confirmation</span>
                                            <span style={{fontSize: '13px', color: 'var(--muted)'}}>
                                                Admin has quoted the customer. You'll be asked to allocate a driver once the customer accepts.
                                            </span>
                                        </div>
                                    ) : isAwaitingPayment ? (
                                        <div className="job-actions" style={{ flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy-ink)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {fields['Driver Name']
                                                    ? '✓ Driver Allocated'
                                                    : `🚗 Allocate Driver${fields['Trip Type'] === 'return' ? ' (Outbound)' : ''}`}
                                            </div>

                                            {!fields['Driver Name'] && (
                                                <>
                                                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                                        Booking has been routed to you. Allocate a driver to confirm the job.
                                                    </div>
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
                                                    </div>

                                                    {fields['Trip Type'] === 'return' && (
                                                        <>
                                                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                                                                🔄 Return Driver
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                                <select
                                                                    value={returnDriverNames[id] || ''}
                                                                    onChange={e => handleReturnDriverSelection(id, e)}
                                                                    style={{ flex: '1 1 200px', padding: '10px', borderRadius: '6px', border: '1px solid #c4b5fd', fontFamily: 'inherit', background: '#faf5ff' }}
                                                                >
                                                                    <option value="">Same as outbound driver</option>
                                                                    {driversList.filter(d => d.name !== 'Select a driver...').map((d, index) => (
                                                                        <option key={index} value={d.name}>{d.name}</option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    type="tel"
                                                                    placeholder="Return Driver Phone..."
                                                                    value={returnDriverPhones[id] || ''}
                                                                    onChange={e => handleReturnDriverPhoneChange(id, e.target.value)}
                                                                    style={{ flex: '1 1 150px' }}
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    <button
                                                        onClick={() => handleAssignDriver(id)}
                                                        disabled={assigningId === id}
                                                        style={{ padding: '12px', width: '100%' }}
                                                    >
                                                        {assigningId === id ? '...' : 'Allocate Driver'}
                                                    </button>
                                                </>
                                            )}

                                            {fields['Driver Name'] && (
                                                <div style={{background: '#fffbf0', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--amber)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                                    <span style={{fontSize: '14px'}}>Outbound Driver: {fields['Driver Name']} {fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                                    {fields['Trip Type'] === 'return' && (
                                                        <span style={{fontSize: '14px', color: '#7c3aed'}}>Return Driver: {fields['Return Driver Name'] || fields['Driver Name']} {fields['Return Driver Phone'] ? `(${fields['Return Driver Phone']})` : fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                                    )}
                                                    <div style={{ padding: '10px', background: '#f3f4f6', borderRadius: '6px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '4px' }}>
                                                        Driver allocated. The job will be confirmed by admin.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : isDeclined ? (
                                        <div className="job-actions" style={{background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600, color: '#b91c1c'}}>❌ Customer Declined</span>
                                            <span style={{fontSize: '13px', color: 'var(--muted)'}}>
                                                The customer declined this booking. No driver was allocated.
                                            </span>
                                        </div>
                                    ) : isCompleted ? (
                                        <div className="job-actions" style={{background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #10b981', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600, color: '#047857'}}>Job Completed (Review Pending)</span>
                                            <span style={{fontSize: '14px'}}>Driver: {fields['Driver Name']} {fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                            <button 
                                                onClick={() => handleCloseJob(record)}
                                                style={{ padding: '10px', width: '100%', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '4px' }}
                                            >
                                                Close Job & Send Review Invite
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="job-actions" style={{background: 'var(--cream)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                            <span style={{fontSize: '14px', fontWeight: 600}}>Driver: {fields['Driver Name']} {fields['Driver Phone'] ? `(${fields['Driver Phone']})` : ''}</span>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                <button onClick={() => handleDirectSMS(record, 'send-confirmation')} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: 'white', border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#047857', fontWeight: 'bold' }}>
                                                    Resend Driver Details to Customer
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'resend-driver')} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: 'white', border: '1px solid var(--amber)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: 'var(--amber-deep)', fontWeight: 'bold' }}>
                                                    Resend Job to Driver
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'send-24h-reminders')} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: 'white', border: '1px solid #f59e0b', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>
                                                    Send 24h Reminder
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'driver-on-way')} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: 'white', border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                                                    Backup: Send 'On Way'
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'driver-arrived')} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: 'white', border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>
                                                    Backup: Send 'Arrived'
                                                </button>
                                                <button onClick={() => handleDirectSMS(record, 'send-review-invite')} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: 'white', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#3b82f6', fontWeight: 'bold' }}>
                                                    Send Review Invite
                                                </button>
                                                <button onClick={() => handleCloseJob(record)} style={{ flex: '1 1 130px', minWidth: 0, padding: '10px 8px', background: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: 'white', fontWeight: 'bold' }}>
                                                    Close Job (Archive)
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
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '10px', fontSize: '18px', fontFamily: 'Lexend' }}>Edit Booking</h2>
                        <form onSubmit={handleSaveBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Customer Name</label>
                                    <input type="text" value={editForm['Customer Name'] || ''} onChange={e => setEditForm({...editForm, 'Customer Name': e.target.value})} required style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Phone</label>
                                    <input type="text" value={editForm['Customer Phone'] || ''} onChange={e => setEditForm({...editForm, 'Customer Phone': e.target.value})} required style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Email</label>
                                    <input type="email" value={editForm['Customer Email'] || ''} onChange={e => setEditForm({...editForm, 'Customer Email': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                            </div>
                            
                            <div>
                                <label>Pickup Address</label>
                                <input type="text" value={editForm['Home Address'] || ''} onChange={e => setEditForm({...editForm, 'Home Address': e.target.value})} required style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Airport</label>
                                    <select value={editForm['Airport'] || 'LJLA'} onChange={e => setEditForm({...editForm, 'Airport': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}}>
                                        <option value="LJLA">Liverpool John Lennon</option>
                                        <option value="Manchester">Manchester</option>
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Trip Type</label>
                                    <select value={editForm['Trip Type'] || 'oneway'} onChange={e => setEditForm({...editForm, 'Trip Type': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}}>
                                        <option value="oneway">One Way</option>
                                        <option value="return">Return</option>
                                    </select>
                                </div>
                                {editForm['Trip Type'] === 'oneway' && (
                                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                        <label>Direction</label>
                                        <select value={editForm['Oneway Direction'] || 'to'} onChange={e => setEditForm({...editForm, 'Oneway Direction': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}}>
                                            <option value="to">To Airport</option>
                                            <option value="from">From Airport</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Outbound Date</label>
                                    <input type="date" value={editForm['Outbound Date'] || ''} onChange={e => setEditForm({...editForm, 'Outbound Date': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Outbound Time</label>
                                    <input type="time" value={editForm['Outbound Time'] || ''} onChange={e => setEditForm({...editForm, 'Outbound Time': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Outbound Flight</label>
                                    <input type="text" value={editForm['Outbound Flight'] || ''} onChange={e => setEditForm({...editForm, 'Outbound Flight': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Return Date</label>
                                    <input type="date" value={editForm['Return Date'] || ''} onChange={e => setEditForm({...editForm, 'Return Date': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Return Time</label>
                                    <input type="time" value={editForm['Return Time'] || ''} onChange={e => setEditForm({...editForm, 'Return Time': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Return Flight</label>
                                    <input type="text" value={editForm['Return Flight'] || ''} onChange={e => setEditForm({...editForm, 'Return Flight': e.target.value})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Passengers</label>
                                    <input type="number" value={editForm['Passengers'] || 1} onChange={e => setEditForm({...editForm, 'Passengers': parseInt(e.target.value)})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Luggage</label>
                                    <input type="number" value={editForm['Luggage'] || 0} onChange={e => setEditForm({...editForm, 'Luggage': parseInt(e.target.value)})} style={{width:'100%', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'6px', fontSize:'16px', fontFamily:'inherit', boxSizing:'border-box'}} />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                    <label>Operator Price (£) <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>Set by admin</span></label>
                                    <input type="number" value={editForm['Operator Price'] || 0} readOnly style={{width:'100%', padding:'8px', background: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280'}} />
                                </div>
                            </div>

                            <div>
                                <label>Notes</label>
                                <textarea value={editForm['Notes'] || ''} onChange={e => setEditForm({...editForm, 'Notes': e.target.value})} style={{width:'100%', padding:'8px', minHeight: '80px', fontFamily: 'inherit', borderRadius: '4px', border: '1px solid var(--line)'}} />
                            </div>

                            <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>{editForm['Trip Type'] === 'return' ? 'Outbound Driver' : 'Driver Assignment'}</h4>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'end' }}>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Assigned Driver</label>
                                        <select value={editForm['Driver Name'] || ''} onChange={e => {
                                            const selectedName = e.target.value;
                                            const matchedDriver = driversList.find(d => d.name === selectedName);
                                            setEditForm({
                                                ...editForm,
                                                'Driver Name': selectedName,
                                                'Driver Phone': matchedDriver ? matchedDriver.phone : editForm['Driver Phone'] || ''
                                            });
                                        }} style={{width:'100%', padding:'8px', borderRadius: '6px', border: '1px solid #d1d5db'}}>
                                            <option value="">No driver assigned</option>
                                            {driversList.filter(d => d.name !== 'Select a driver...' && d.name !== 'Custom Driver').map(d => (
                                                <option key={d.name} value={d.name}>{d.name}</option>
                                            ))}
                                            <option value="__custom__">Custom Driver</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Driver Phone</label>
                                        <input type="text" value={editForm['Driver Phone'] || ''} onChange={e => setEditForm({...editForm, 'Driver Phone': e.target.value})} placeholder="07..." style={{width:'100%', padding:'8px', borderRadius: '6px', border: '1px solid #d1d5db'}} />
                                    </div>
                                </div>
                                {editForm['Driver Name'] === '__custom__' && (
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Custom Driver Name</label>
                                        <input type="text" value="" onChange={e => setEditForm({...editForm, 'Driver Name': e.target.value})} placeholder="Enter driver name" style={{width:'100%', padding:'8px', borderRadius: '6px', border: '1px solid #d1d5db'}} />
                                    </div>
                                )}
                                {editForm['Driver Name'] && editForm['Driver Name'] !== '__custom__' && (
                                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#166534' }}>
                                        This driver will see this job in their portal at <strong>/driver-portal.html</strong>
                                    </p>
                                )}
                            </div>

                            {/* Return Driver — only for return trips */}
                            {editForm['Trip Type'] === 'return' && (
                                <div style={{ background: '#faf5ff', padding: '15px', borderRadius: '8px', border: '1px solid #c4b5fd' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#7c3aed' }}>🔄 Return Driver</h4>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'end' }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={{ fontSize: '13px', fontWeight: 600 }}>Return Driver</label>
                                            <select value={editForm['Return Driver Name'] || ''} onChange={e => {
                                                const selectedName = e.target.value;
                                                const matchedDriver = driversList.find(d => d.name === selectedName);
                                                setEditForm({
                                                    ...editForm,
                                                    'Return Driver Name': selectedName,
                                                    'Return Driver Phone': matchedDriver ? matchedDriver.phone : editForm['Return Driver Phone'] || ''
                                                });
                                            }} style={{width:'100%', padding:'8px', borderRadius: '6px', border: '1px solid #c4b5fd', background: 'white'}}>
                                                <option value="">Same as outbound driver</option>
                                                {driversList.filter(d => d.name !== 'Select a driver...' && d.name !== 'Custom Driver').map(d => (
                                                    <option key={d.name} value={d.name}>{d.name}</option>
                                                ))}
                                                <option value="__custom__">Custom Driver</option>
                                            </select>
                                        </div>
                                        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                            <label style={{ fontSize: '13px', fontWeight: 600 }}>Return Driver Phone</label>
                                            <input type="text" value={editForm['Return Driver Phone'] || ''} onChange={e => setEditForm({...editForm, 'Return Driver Phone': e.target.value})} placeholder="07..." style={{width:'100%', padding:'8px', borderRadius: '6px', border: '1px solid #c4b5fd'}} />
                                        </div>
                                    </div>
                                    {editForm['Return Driver Name'] === '__custom__' && (
                                        <div style={{ marginTop: '10px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 600 }}>Custom Return Driver Name</label>
                                            <input type="text" onChange={e => setEditForm({...editForm, 'Return Driver Name': e.target.value})} placeholder="Enter driver name" style={{width:'100%', padding:'8px', borderRadius: '6px', border: '1px solid #c4b5fd'}} />
                                        </div>
                                    )}
                                    {editForm['Return Driver Name'] && editForm['Return Driver Name'] !== '__custom__' && (
                                        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#7c3aed' }}>
                                            Return driver will see this job in their portal
                                        </p>
                                    )}
                                </div>
                            )}

                            {editingJob !== 'new' && (
                                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: 'var(--navy-ink)' }}>Communication</h4>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button type="button" onClick={() => handleResendSMS('resend-customer')} style={{ flex: '1 1 140px', minWidth: 0, padding: '10px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                            Resend Customer SMS
                                        </button>
                                        <button type="button" onClick={() => handleResendSMS('resend-driver')} style={{ flex: '1 1 140px', minWidth: 0, padding: '10px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
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

            {showAddDriver && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h2 style={{ margin: 0, fontFamily: 'Lexend', fontSize: '18px' }}>Add Driver</h2>
                            <button onClick={() => setShowAddDriver(false)} style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
                        </div>
                        <form onSubmit={handleAddDriver} className="add-driver-form" style={{ display: 'grid', gap: '10px' }}>
                            <input type="text" placeholder="Driver Name" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} required style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            <input type="tel" placeholder="Phone Number" value={newDriverPhone} onChange={e => setNewDriverPhone(e.target.value)} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            <input type="text" placeholder="Portal Username" value={newDriverUsername} onChange={e => setNewDriverUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" required style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            <input type="text" placeholder="Portal Password" value={newDriverPassword} onChange={e => setNewDriverPassword(e.target.value)} required style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            <input type="text" placeholder="Vehicle Type (e.g. Mercedes V-Class)" value={newDriverVehicleType} onChange={e => setNewDriverVehicleType(e.target.value)} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            <input type="text" placeholder="Vehicle Registration" value={newDriverVehicleReg} onChange={e => setNewDriverVehicleReg(e.target.value.toUpperCase())} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', textTransform: 'uppercase', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            <input type="text" placeholder="Driver Badge Number" value={newDriverBadge} onChange={e => setNewDriverBadge(e.target.value)} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box', gridColumn: '1 / -1' }} />
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button type="button" onClick={() => setShowAddDriver(false)} style={{ padding: '10px 16px', background: 'white', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                                <button type="submit" disabled={isAddingDriver} style={{ padding: '10px 18px', background: 'var(--amber)', color: 'var(--navy-ink)', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: isAddingDriver ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                                    {isAddingDriver ? 'Adding…' : 'Add Driver'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingDriverId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '12px' }}>
                    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h2 style={{ margin: 0, fontFamily: 'Lexend', fontSize: '18px' }}>Edit Driver</h2>
                            <button onClick={closeEditDriverModal} style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
                        </div>
                        <form onSubmit={handleSaveDriver} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Name</label>
                                <input type="text" value={driverEditForm['Name'] || ''} onChange={e => setDriverEditForm({ ...driverEditForm, 'Name': e.target.value })} required style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Phone</label>
                                <input type="tel" value={driverEditForm['Phone'] || ''} onChange={e => setDriverEditForm({ ...driverEditForm, 'Phone': e.target.value })} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Portal Username</label>
                                <input type="text" value={driverEditForm['Username'] || ''} onChange={e => setDriverEditForm({ ...driverEditForm, 'Username': e.target.value })} autoCapitalize="none" autoCorrect="off" style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Vehicle Type</label>
                                <input type="text" value={driverEditForm['Vehicle Type'] || ''} onChange={e => setDriverEditForm({ ...driverEditForm, 'Vehicle Type': e.target.value })} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Vehicle Registration</label>
                                <input type="text" value={driverEditForm['Vehicle Registration'] || ''} onChange={e => setDriverEditForm({ ...driverEditForm, 'Vehicle Registration': e.target.value.toUpperCase() })} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', textTransform: 'uppercase', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Driver Badge Number</label>
                                <input type="text" value={driverEditForm['Badge Number'] || ''} onChange={e => setDriverEditForm({ ...driverEditForm, 'Badge Number': e.target.value })} style={{ width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '16px', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                                <button type="button" onClick={closeEditDriverModal} style={{ padding: '10px 16px', background: 'white', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                                <button type="submit" disabled={isSavingDriver} style={{ padding: '10px 18px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: isSavingDriver ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                                    {isSavingDriver ? 'Saving…' : 'Save Changes'}
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
