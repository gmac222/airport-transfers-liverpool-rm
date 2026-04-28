module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const driverName = (req.query.driver || '').trim();
    if (!driverName) {
        return res.status(400).json({ error: 'Missing driver name' });
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const BOOKINGS_TABLE = 'tblAIQuXsh9MPtsSC';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    try {
        const safeName = driverName.replace(/'/g, "\\'");
        // Match driver, exclude completed/archived statuses
        const formula = `AND({Driver Name}='${safeName}', NOT({Status}='Completed'), NOT({Status}='Archived'))`;
        const url = `https://api.airtable.com/v0/${BASE_ID}/${BOOKINGS_TABLE}?filterByFormula=` + encodeURIComponent(formula) + '&pageSize=100';

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });

        const data = await response.json();

        if (data.error) {
            console.error('Airtable error:', data.error);
            return res.status(500).json({ error: data.error.message || 'Airtable error' });
        }

        const records = data.records || [];

        // Sort by Outbound Date + Time ascending (soonest first)
        records.sort((a, b) => {
            const aDate = (a.fields['Outbound Date'] || '') + ' ' + (a.fields['Outbound Time'] || '');
            const bDate = (b.fields['Outbound Date'] || '') + ' ' + (b.fields['Outbound Time'] || '');
            return aDate.localeCompare(bDate);
        });

        return res.status(200).json({ jobs: records });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error while fetching jobs' });
    }
};
