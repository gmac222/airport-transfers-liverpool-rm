module.exports = async (req, res) => {
    // CORS headers for local testing and Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_ID = 'tblAIQuXsh9MPtsSC';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured on the server.' });
    }

    // GET Request: Fetch Booking by Ref
    if (req.method === 'GET') {
        const { ref } = req.query;
        if (!ref) {
            return res.status(400).json({ error: 'Missing booking reference (ref)' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=` + encodeURIComponent(`{Booking Ref}='${ref}'`);
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                }
            });

            const data = await response.json();

            if (!data.records || data.records.length === 0) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            return res.status(200).json({ booking: data.records[0] });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to fetch booking' });
        }
    }

    // PATCH Request: Update Booking Status
    if (req.method === 'PATCH') {
        const { id, fields } = req.body;
        
        if (!id || !fields) {
            return res.status(400).json({ error: 'Missing record id or fields' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`;
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields })
            });

            const data = await response.json();

            // SMS is now handled by the n8n webhook triggered from the frontend

            return res.status(200).json({ booking: data });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to update booking' });
        }
    }
    // DELETE Request: Delete Booking
    if (req.method === 'DELETE') {
        const { id } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Missing record id' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`;
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                }
            });

            const data = await response.json();

            if (data.deleted) {
                return res.status(200).json({ success: true, deleted: true });
            } else {
                return res.status(400).json({ error: 'Failed to delete record' });
            }
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to delete booking' });
        }
    }


    // GET Request for Admin to fetch all pending/accepted bookings
    if (req.method === 'POST' && req.query.action === 'list') {
        try {
            // Sort by Created Time desc
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?sort%5B0%5D%5Bfield%5D=Submitted+At&sort%5B0%5D%5Bdirection%5D=desc`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                }
            });

            const data = await response.json();
            return res.status(200).json({ bookings: data.records || [] });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to list bookings' });
        }
    }

    // POST Request: Create Manual Booking
    if (req.method === 'POST' && req.query.action === 'create') {
        const { fields } = req.body;
        
        if (!fields) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records: [{ fields }] })
            });

            const data = await response.json();

            return res.status(200).json({ booking: data.records[0] });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to create booking' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
