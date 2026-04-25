module.exports = async (req, res) => {
    // CORS headers for local testing and Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_ID = 'tblgM0WSDVJUbbjS2'; // Formerly Admins, now Drivers

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    if (req.method === 'GET') {
        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                }
            });

            const data = await response.json();

            if (!data.records) {
                return res.status(200).json({ drivers: [] });
            }

            // Map Airtable records into a cleaner array
            const drivers = data.records.map(record => ({
                id: record.id,
                name: record.fields['Name'] || record.fields['Username'] || 'Unnamed Driver',
                phone: record.fields['Phone'] || ''
            }));

            return res.status(200).json({ drivers });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error while fetching drivers' });
        }
    }

    if (req.method === 'POST') {
        const { name, phone } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Driver name is required' });
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
                    records: [
                        {
                            fields: {
                                'Name': name,
                                'Phone': phone || ''
                            }
                        }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message || 'Failed to add driver');

            return res.status(201).json({ success: true, driver: data.records[0] });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Internal server error while adding driver' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
