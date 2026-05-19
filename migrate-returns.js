require('dotenv').config({ path: '.env.local' });
const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appzmLNDAsk6m06Ae'; 
const TABLE_NAME = 'Bookings';

async function migrate() {
    try {
        console.log('Fetching return jobs...');
        let offset = '';
        let recordsToProcess = [];
        do {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent("{Trip Type} = 'return'")}
${offset ? '&offset=' + offset : ''}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            const data = await res.json();
            if (data.error) {
                throw new Error(JSON.stringify(data.error));
            }
            recordsToProcess.push(...data.records);
            offset = data.offset;
        } while (offset);
        
        console.log(`Found ${recordsToProcess.length} return jobs.`);
        
        let count = 0;
        for (const record of recordsToProcess) {
            const f = record.fields;
            if (['Completed', 'Archived', 'Cancelled', 'Declined'].includes(f['Status'])) {
                console.log(`Skipping ${f['Booking Ref']} as it is ${f['Status']}`);
                continue;
            }
            
            console.log(`Migrating ${f['Booking Ref']}...`);
            
            const originalPrice = parseFloat(f['Customer Price']) || 0;
            const originalPaid = parseFloat(f['Amount Paid']) || 0;
            const originalOperatorPaid = parseFloat(f['Operator Paid']) || 0;
            const originalDriverPaid = parseFloat(f['Driver Paid']) || 0;
            
            const baseFieldsOut = { ...f };
            delete baseFieldsOut['Return Date'];
            delete baseFieldsOut['Return Time'];
            delete baseFieldsOut['Return Flight'];
            
            baseFieldsOut['Booking Ref'] = f['Booking Ref'] + '-OUT';
            baseFieldsOut['Trip Type'] = 'oneway';
            baseFieldsOut['Oneway Direction'] = 'to'; // From home to airport
            baseFieldsOut['Customer Price'] = (originalPrice / 2);
            baseFieldsOut['Amount Paid'] = (originalPaid / 2);
            baseFieldsOut['Operator Paid'] = (originalOperatorPaid / 2);
            baseFieldsOut['Driver Paid'] = (originalDriverPaid / 2);

            const baseFieldsRet = { ...f };
            delete baseFieldsRet['Return Date'];
            delete baseFieldsRet['Return Time'];
            delete baseFieldsRet['Return Flight'];
            
            baseFieldsRet['Booking Ref'] = f['Booking Ref'] + '-RET';
            baseFieldsRet['Trip Type'] = 'oneway';
            baseFieldsRet['Oneway Direction'] = 'from'; // From airport to home
            baseFieldsRet['Outbound Date'] = f['Return Date'];
            baseFieldsRet['Outbound Time'] = f['Return Time'];
            baseFieldsRet['Outbound Flight'] = f['Return Flight'];
            baseFieldsRet['Customer Price'] = (originalPrice / 2);
            baseFieldsRet['Amount Paid'] = (originalPaid / 2);
            baseFieldsRet['Operator Paid'] = (originalOperatorPaid / 2);
            baseFieldsRet['Driver Paid'] = (originalDriverPaid / 2);
            
            // Create the new records
            const createRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: [
                        { fields: baseFieldsOut },
                        { fields: baseFieldsRet }
                    ]
                })
            });
            const createData = await createRes.json();
            if (createData.error) {
                console.error(`Error creating records for ${f['Booking Ref']}:`, createData.error);
                continue;
            }
            
            // Archive the original
            const archiveRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    records: [
                        { id: record.id, fields: { 'Status': 'Archived' } }
                    ]
                })
            });
            const archiveData = await archiveRes.json();
            if (archiveData.error) {
                console.error(`Error archiving original record ${record.id}:`, archiveData.error);
            }
            
            console.log(`Successfully split ${f['Booking Ref']}`);
            count++;
        }
        
        console.log(`Migration complete. Processed ${count} jobs.`);
        
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
