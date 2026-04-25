const https = require('https');

const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appzmLNDAsk6m06Ae';
const TABLE_ID = 'tblgM0WSDVJUbbjS2';

if (!AIRTABLE_API_KEY) {
    console.error("Missing Airtable API Key");
    process.exit(1);
}

const headers = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
};

function apiRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.airtable.com',
            path: path,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data || '{}'));
                } else {
                    reject(`HTTP ${res.statusCode}: ${data}`);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function updateAirtable() {
    try {
        console.log("Renaming table to 'Drivers'...");
        try {
            await apiRequest('PATCH', `/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}`, {
                name: "Drivers"
            });
            console.log("Table renamed successfully.");
        } catch (e) {
            console.log("Note: Could not rename table (maybe it's already renamed or missing schema write permissions). Error:", e);
        }

        console.log("Fetching table fields...");
        const metaRes = await apiRequest('GET', `/v0/meta/bases/${BASE_ID}/tables`);
        const table = metaRes.tables.find(t => t.id === TABLE_ID);
        
        if (!table) {
            throw new Error("Table not found in metadata");
        }

        const usernameField = table.fields.find(f => f.name === 'Username');
        if (usernameField) {
            console.log(`Renaming field 'Username' (ID: ${usernameField.id}) to 'Name'...`);
            try {
                await apiRequest('PATCH', `/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields/${usernameField.id}`, {
                    name: "Name"
                });
                console.log("Field renamed to 'Name'.");
            } catch (e) {
                console.log("Note: Could not rename Username field.", e);
            }
        }

        const phoneField = table.fields.find(f => f.name === 'Phone');
        if (!phoneField) {
            console.log("Creating 'Phone' field...");
            try {
                await apiRequest('POST', `/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`, {
                    name: "Phone",
                    type: "phoneNumber"
                });
                console.log("'Phone' field created.");
            } catch (e) {
                console.log("Note: Could not create Phone field. Trying as singleLineText...");
                try {
                    await apiRequest('POST', `/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`, {
                        name: "Phone",
                        type: "singleLineText"
                    });
                    console.log("'Phone' field created as singleLineText.");
                } catch (e2) {
                    console.log("Failed to create Phone field:", e2);
                }
            }
        }

        console.log("Adding drivers to the table...");
        const driversToAdd = [
            { fields: { "Name": "Roy Medlam", "Phone": "07746 899644" } },
            { fields: { "Name": "Test Driver (Graham)", "Phone": "07398 233859" } }
        ];

        // Fetch existing records to avoid duplicates
        const recordsRes = await apiRequest('GET', `/v0/${BASE_ID}/${TABLE_ID}`);
        const existingRecords = recordsRes.records || [];
        
        for (const driver of driversToAdd) {
            const exists = existingRecords.some(r => r.fields['Name'] === driver.fields['Name'] || r.fields['Username'] === driver.fields['Name']);
            if (!exists) {
                await apiRequest('POST', `/v0/${BASE_ID}/${TABLE_ID}`, driver);
                console.log(`Added driver: ${driver.fields['Name']}`);
            } else {
                console.log(`Driver already exists: ${driver.fields['Name']}`);
            }
        }

        console.log("All done!");

    } catch (err) {
        console.error("Error during Airtable update:", err);
    }
}

updateAirtable();
