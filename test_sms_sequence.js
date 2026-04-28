const https = require('https');

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "SET_YOUR_PAT_HERE";
const BASE_ID = "appzmLNDAsk6m06Ae";
const TABLE_ID = "tblAIQuXsh9MPtsSC";
const BOOKING_REF = "ATL-9WTWNV92";

function fetchBooking() {
    return new Promise((resolve, reject) => {
        const u = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
        u.searchParams.set('filterByFormula', `{Booking Ref}="${BOOKING_REF}"`);
        https.get(u.toString(), {
            headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
        }, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                const p = JSON.parse(d);
                if (p.records && p.records.length > 0) resolve(p.records[0]);
                else reject(new Error('Booking not found: ' + d.substring(0, 300)));
            });
        }).on('error', reject);
    });
}

function callSmsApi(action, fields) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ action, fields });
        const options = {
            method: 'POST',
            hostname: 'airporttaxitransfersliverpool.co.uk',
            path: '/api/sms',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                console.log(`  Status: ${res.statusCode}`);
                try {
                    const parsed = JSON.parse(d);
                    console.log(`  Response:`, JSON.stringify(parsed).substring(0, 300));
                    resolve(parsed);
                } catch {
                    console.log(`  Raw:`, d.substring(0, 200));
                    resolve(d);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    const step = process.argv[2] || 'info';

    console.log(`\n========================================`);
    console.log(`  SMS Sequence Test: ${BOOKING_REF}`);
    console.log(`  Simulating: 24 hours before pickup`);
    console.log(`========================================\n`);

    console.log('Fetching booking from Airtable...');
    const record = await fetchBooking();
    const fields = record.fields;
    
    console.log(`Customer:  ${fields['Customer Name']} (${fields['Customer Phone']})`);
    console.log(`Trip:      ${fields['Trip Type']} | ${fields['Airport Name'] || 'N/A'}`);
    console.log(`Outbound:  ${fields['Outbound Date']} at ${fields['Outbound Time']}`);
    console.log(`Driver:    ${fields['Driver Name']} (${fields['Driver Phone']})`);
    console.log(`Status:    ${fields['Status']}`);
    console.log('');

    // === SMS SEQUENCE (simulating timeline) ===
    // 1. Reminder (24h before)
    // 2. Driver on the way (pickup day)
    // 3. Driver arrived (at location)
    // 4. After completion → review invite

    if (step === 'info') {
        console.log('Steps available (pass as argument):');
        console.log('  1 or reminder        → 24h reminder SMS');
        console.log('  2 or driver-on-way   → Driver on the way SMS');
        console.log('  3 or driver-arrived  → Driver arrived SMS');
        console.log('  4 or review          → Trustpilot review invite SMS');
        console.log('  all                  → Run full sequence (3s between each)');
        return;
    }

    if (step === '1' || step === 'reminder' || step === 'all') {
        console.log('━━━ STEP 1: 24-Hour Reminder SMS ━━━');
        console.log(`  → "Your booking is scheduled for ${fields['Outbound Date']} at ${fields['Outbound Time']}"`);
        await callSmsApi('reminder', fields);
        console.log('');
    }

    if (step === '2' || step === 'driver-on-way' || step === 'all') {
        if (step === 'all') { console.log('  ⏳ Waiting 5s...\n'); await wait(5000); }
        console.log('━━━ STEP 2: Driver On The Way SMS ━━━');
        console.log(`  → "${fields['Driver Name']} is on the way!"`);
        await callSmsApi('driver-on-way', fields);
        console.log('');
    }

    if (step === '3' || step === 'driver-arrived' || step === 'all') {
        if (step === 'all') { console.log('  ⏳ Waiting 5s...\n'); await wait(5000); }
        console.log('━━━ STEP 3: Driver Arrived SMS ━━━');
        console.log(`  → "${fields['Driver Name']} is waiting outside."`);
        await callSmsApi('driver-arrived', fields);
        console.log('');
    }

    if (step === '4' || step === 'review' || step === 'all') {
        if (step === 'all') { console.log('  ⏳ Waiting 5s...\n'); await wait(5000); }
        console.log('━━━ STEP 4: Trustpilot Review Invite SMS ━━━');
        console.log(`  → "Thank you for traveling with RM Transfers!"`);
        await callSmsApi('send-review-invite', fields);
        console.log('');
    }

    console.log('========== Sequence Complete ==========');
}

main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
