module.exports = async (req, res) => {
    // CORS headers
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
    const TABLE_ID = 'Operators';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    // GET – list operators (optionally ?name=Foo for a single record)
    if (req.method === 'GET') {
        try {
            const name = (req.query.name || '').toString().trim();
            let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
            if (name) {
                const safe = name.replace(/'/g, "\\'");
                url += '?filterByFormula=' + encodeURIComponent(`{Name}='${safe}'`);
            }
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            const data = await response.json();

            if (!data.records) {
                return res.status(200).json({ operators: [] });
            }

            const operators = data.records.map(record => ({
                id: record.id,
                name: record.fields['Name'] || 'Unnamed',
                username: record.fields['Username'] || '',
                phone: record.fields['Phone'] || '',
                email: record.fields['Email'] || '',
                defaultDriver: record.fields['Default Driver'] || ''
            }));

            return res.status(200).json({ operators });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error while fetching operators' });
        }
    }

    // PATCH – update an operator (operator self-service via the portal)
    if (req.method === 'PATCH') {
        const { id, fields } = req.body || {};
        if (!id || !fields) {
            return res.status(400).json({ error: 'Missing operator id or fields' });
        }
        try {
            const allowed = ['Name', 'Phone', 'Email', 'Default Driver'];
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
            return res.status(200).json({ success: true, operator: data });
        } catch (err) {
            console.error('operators PATCH error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    // POST – create a new operator
    if (req.method === 'POST') {
        const { name, username, password, phone, email } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ error: 'Name, username and password are required' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: [{
                        fields: {
                            'Name': name,
                            'Username': username,
                            'Password': password,
                            'Phone': phone || '',
                            'Email': email || ''
                        }
                    }]
                })
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                const msg = (data.error && (data.error.message || data.error.type)) || `Airtable ${response.status}`;
                console.error('Airtable add operator failed:', JSON.stringify(data));
                return res.status(response.status || 500).json({ error: msg });
            }

            return res.status(201).json({ success: true, operator: data.records[0] });
        } catch (error) {
            console.error('add operator exception:', error);
            return res.status(500).json({ error: error.message || 'Internal server error while adding operator' });
        }
    }

    // DELETE – remove an operator
    if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Operator ID is required' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            if (!response.ok) {
                return res.status(response.status).json({ error: `Airtable ${response.status}` });
            }

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('delete operator exception:', error);
            return res.status(500).json({ error: error.message || 'Internal server error while deleting operator' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
