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

    const { username, password, portal } = req.body;

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
        return res.status(400).json({ error: 'Missing username or password' });
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    try {
        // Determine which table to check based on portal type
        if (portal === 'driver') {
            // Driver login – check Drivers table
            const TABLE_ID = 'tblgM0WSDVJUbbjS2';
            const formula = `AND(LOWER({Username})='${cleanUsername.toLowerCase()}', {Password}='${cleanPassword}')`;
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=` + encodeURIComponent(formula);
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            const data = await response.json();

            if (!data.records || data.records.length === 0) {
                return res.status(401).json({ error: 'Invalid driver username or password' });
            }

            const record = data.records[0];
            return res.status(200).json({
                success: true,
                token: 'driver-auth-ok',
                role: 'driver',
                driverName: record.fields['Name'] || cleanUsername
            });
        }

        if (portal === 'operator') {
            // Operator login – check Operators table.
            // Special case: a super admin can SSO into any operator portal
            // without the operator's password by passing portal='operator',
            // password='__sso__', plus a header X-Admin-SSO with the admin's
            // username. We re-verify the admin against the Admins table to
            // make sure they're flagged Is Super Admin = true.
            const TABLE_ID = 'Operators';

            if (cleanPassword === '__sso__') {
                const adminUser = (req.headers['x-admin-sso'] || '').toString().trim().toLowerCase();
                if (!adminUser) return res.status(401).json({ error: 'SSO requires admin credentials' });
                const adminFormula = `AND(LOWER({Name})='${adminUser}', {Is Super Admin}=TRUE())`;
                const adminUrl = `https://api.airtable.com/v0/${BASE_ID}/Admins?filterByFormula=` + encodeURIComponent(adminFormula);
                const adminRes = await fetch(adminUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
                const adminData = await adminRes.json();
                if (!adminData.records || adminData.records.length === 0) {
                    return res.status(403).json({ error: 'SSO denied — not a super admin' });
                }
                const opFormula = `LOWER({Username})='${cleanUsername.toLowerCase()}'`;
                const opUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=` + encodeURIComponent(opFormula);
                const opRes = await fetch(opUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
                const opData = await opRes.json();
                if (!opData.records || opData.records.length === 0) {
                    return res.status(404).json({ error: 'Operator not found' });
                }
                const opRec = opData.records[0];
                return res.status(200).json({
                    success: true,
                    token: 'operator-auth-ok',
                    role: 'operator',
                    operatorName: opRec.fields['Name'] || cleanUsername,
                    operatorId: opRec.id,
                    impersonatedBy: adminUser
                });
            }

            const formula = `AND(LOWER({Username})='${cleanUsername.toLowerCase()}', {Password}='${cleanPassword}')`;
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=` + encodeURIComponent(formula);
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });

            const data = await response.json();

            if (!data.records || data.records.length === 0) {
                return res.status(401).json({ error: 'Invalid operator username or password' });
            }

            const record = data.records[0];
            return res.status(200).json({
                success: true,
                token: 'operator-auth-ok',
                role: 'operator',
                operatorName: record.fields['Name'] || cleanUsername,
                operatorId: record.id
            });
        }

        // Admin login – check Admins table (existing behaviour)
        const TABLE_ID = 'Admins';
        const formula = `AND(LOWER({Name})='${cleanUsername.toLowerCase()}', {Password}='${cleanPassword}')`;
        const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=` + encodeURIComponent(formula);
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });

        const data = await response.json();

        if (!data.records || data.records.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const adminRec = data.records[0];
        const isSuperAdmin = adminRec.fields['Is Super Admin'] === true;
        return res.status(200).json({
            success: true,
            token: "admin-auth-ok",
            role: 'admin',
            isSuperAdmin,
            adminName: adminRec.fields['Name'] || cleanUsername
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error during login' });
    }
};
