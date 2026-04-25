module.exports = async (req, res) => {
    // CORS headers for local testing and Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Missing username or password' });
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_ID = 'tblgM0WSDVJUbbjS2'; // Admins table

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    try {
        const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=AND({Name}='${username}', {Password}='${password}')`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`
            }
        });

        const data = await response.json();

        if (!data.records || data.records.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        return res.status(200).json({ success: true, token: "admin-auth-ok" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
};
