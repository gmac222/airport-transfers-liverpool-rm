// Drivers API. Drivers belong to a single operator and are only visible
// to that operator. Admin sees everything.
//
// GET    /api/drivers?operator=Foo    -> drivers owned by 'Foo'
// GET    /api/drivers                 -> all drivers (admin / unscoped)
// POST   /api/drivers                 body: { name, phone, username, password, vehicleType, vehicleRegistration, badgeNumber, operator }
// PATCH  /api/drivers                 body: { id, fields, operator }       (operator must match Driver.Operator unless absent)
// DELETE /api/drivers                 body: { id, operator }                (same)
//
// The `operator` parameter on PATCH/DELETE is a soft tenancy check —
// the only callers are our own portals, but it stops a logged-in
// operator from accidentally mutating another operator's drivers via
// a stale browser session.

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_ID = 'tblgM0WSDVJUbbjS2';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    const fetchDriver = async (id) => {
        const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });
        if (!r.ok) return null;
        return r.json();
    };

    if (req.method === 'GET') {
        try {
            const operator = (req.query.operator || '').toString().trim();
            let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
            if (operator) {
                const safe = operator.replace(/'/g, "\\'");
                url += '?filterByFormula=' + encodeURIComponent(`{Operator}='${safe}'`);
            }
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
            const data = await response.json();
            if (!data.records) return res.status(200).json({ drivers: [] });

            const drivers = data.records.map(record => ({
                id: record.id,
                name: record.fields['Name'] || record.fields['Username'] || 'Unnamed Driver',
                phone: record.fields['Phone'] || '',
                username: record.fields['Username'] || '',
                vehicleType: record.fields['Vehicle Type'] || '',
                vehicleRegistration: record.fields['Vehicle Registration'] || '',
                badgeNumber: record.fields['Badge Number'] || '',
                operator: record.fields['Operator'] || ''
            }));
            return res.status(200).json({ drivers });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error while fetching drivers' });
        }
    }

    if (req.method === 'POST') {
        const { name, phone, username, password, vehicleType, vehicleRegistration, badgeNumber, operator } = req.body;
        if (!name) return res.status(400).json({ error: 'Driver name is required' });
        if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

        try {
            const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    records: [{
                        fields: {
                            'Name': name,
                            'Phone': phone || '',
                            'Username': username,
                            'Password': password,
                            'Vehicle Type': vehicleType || '',
                            'Vehicle Registration': vehicleRegistration || '',
                            'Badge Number': badgeNumber || '',
                            'Operator': operator || ''
                        }
                    }]
                })
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                const msg = (data.error && (data.error.message || data.error.type)) || `Airtable ${response.status}`;
                console.error('Airtable add driver failed:', JSON.stringify(data));
                return res.status(response.status || 500).json({ error: msg });
            }
            return res.status(201).json({ success: true, driver: data.records[0] });
        } catch (error) {
            console.error('add driver exception:', error);
            return res.status(500).json({ error: error.message || 'Internal server error while adding driver' });
        }
    }

    if (req.method === 'PATCH') {
        const { id, fields, operator } = req.body || {};
        if (!id || !fields) return res.status(400).json({ error: 'Missing driver id or fields' });
        try {
            // Tenancy guard: operator caller can only edit their own drivers.
            if (operator) {
                const existing = await fetchDriver(id);
                if (!existing) return res.status(404).json({ error: 'Driver not found' });
                const ownedBy = existing.fields?.['Operator'] || '';
                if (ownedBy && ownedBy !== operator) {
                    return res.status(403).json({ error: 'Driver belongs to a different operator' });
                }
            }
            const allowed = ['Name', 'Phone', 'Username', 'Password', 'Vehicle Type', 'Vehicle Registration', 'Badge Number', 'Operator'];
            const safeFields = {};
            for (const k of allowed) if (fields[k] !== undefined) safeFields[k] = fields[k];
            const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: safeFields })
            });
            const data = await r.json();
            if (!r.ok) {
                const msg = (data.error && (data.error.message || data.error.type)) || `Airtable ${r.status}`;
                return res.status(r.status).json({ error: msg });
            }
            return res.status(200).json({ success: true, driver: data });
        } catch (err) {
            console.error('drivers PATCH error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === 'DELETE') {
        const { id, operator } = req.body || {};
        if (!id) return res.status(400).json({ error: 'Missing driver id' });
        try {
            if (operator) {
                const existing = await fetchDriver(id);
                if (!existing) return res.status(404).json({ error: 'Driver not found' });
                const ownedBy = existing.fields?.['Operator'] || '';
                if (ownedBy && ownedBy !== operator) {
                    return res.status(403).json({ error: 'Driver belongs to a different operator' });
                }
            }
            const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Delete failed' });
            return res.status(200).json({ success: true, deleted: id });
        } catch (err) {
            console.error('drivers DELETE error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
