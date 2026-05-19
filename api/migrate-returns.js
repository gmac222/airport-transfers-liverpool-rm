export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae'; 
    const TABLE_NAME = 'Bookings';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is missing' });
    }

    try {
        console.log('Fetching return jobs...');
        let offset = '';
        let recordsToProcess = [];
        do {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=${encodeURIComponent("{Trip Type} = 'return'")}${offset ? '&offset=' + offset : ''}`;
            const atRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
            });
            const data = await atRes.json();
            if (data.error) {
                throw new Error(JSON.stringify(data.error));
            }
            recordsToProcess.push(...data.records);
            offset = data.offset;
        } while (offset);
        
        let count = 0;
        let logs = [];
        
        for (const record of recordsToProcess) {
            const f = record.fields;
            if (['Completed', 'Archived', 'Cancelled', 'Declined'].includes(f['Status'])) {
                logs.push(`Skipping ${f['Booking Ref']} as it is ${f['Status']}`);
                continue;
            }
            
            logs.push(`Migrating ${f['Booking Ref']}...`);
            
            const originalPrice = parseFloat(f['Customer Price']) || 0;
            const originalPaid = parseFloat(f['Amount Paid']) || 0;
            const originalOperatorPaid = parseFloat(f['Operator Paid']) || 0;
            const originalDriverPaid = parseFloat(f['Driver Paid']) || 0;
            
            const allowedFields = [
                'Customer Name', 'Customer Phone', 'Customer Email', 'Home Address',
                'Airport Name', 'Airport', 'Passengers', 'Luggage', 'Notes', 'Status',
                'Submitted At', 'Payment Status', 'Operator', 'Driver Name', 'Driver Phone',
                'Stripe Session ID', 'Dispatched To Operator'
            ];
            
            const baseF = {};
            for (const key of allowedFields) {
                if (f[key] !== undefined) baseF[key] = f[key];
            }
            
            const baseFieldsOut = { ...baseF };
            baseFieldsOut['Booking Ref'] = f['Booking Ref'] + '-OUT';
            baseFieldsOut['Trip Type'] = 'oneway';
            baseFieldsOut['Oneway Direction'] = 'to'; 
            baseFieldsOut['Outbound Date'] = f['Outbound Date'];
            baseFieldsOut['Outbound Time'] = f['Outbound Time'];
            baseFieldsOut['Outbound Flight'] = f['Outbound Flight'];
            baseFieldsOut['Customer Price'] = originalPrice / 2;
            baseFieldsOut['Amount Paid'] = originalPaid / 2;
            baseFieldsOut['Operator Paid'] = originalOperatorPaid / 2;
            baseFieldsOut['Driver Paid'] = originalDriverPaid / 2;

            const baseFieldsRet = { ...baseF };
            baseFieldsRet['Booking Ref'] = f['Booking Ref'] + '-RET';
            baseFieldsRet['Trip Type'] = 'oneway';
            baseFieldsRet['Oneway Direction'] = 'from'; 
            baseFieldsRet['Outbound Date'] = f['Return Date'];
            baseFieldsRet['Outbound Time'] = f['Return Time'];
            baseFieldsRet['Outbound Flight'] = f['Return Flight'];
            baseFieldsRet['Customer Price'] = originalPrice / 2;
            baseFieldsRet['Amount Paid'] = originalPaid / 2;
            baseFieldsRet['Operator Paid'] = originalOperatorPaid / 2;
            baseFieldsRet['Driver Paid'] = originalDriverPaid / 2;
            
            // Create the new records
            let payloadRecords = [
                { fields: baseFieldsOut },
                { fields: baseFieldsRet }
            ];
            
            let createRes, createData;
            let droppedFields = [];
            
            for (let attempt = 0; attempt < 10; attempt++) {
                createRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        records: payloadRecords,
                        typecast: true
                    })
                });
                
                const responseText = await createRes.text();
                
                if (createRes.ok) {
                    createData = JSON.parse(responseText);
                    break;
                }
                
                try {
                    createData = JSON.parse(responseText);
                } catch(e) {
                    createData = { error: { message: responseText } };
                }
                
                const errMsg = (createData.error && (createData.error.message || createData.error.type)) || '';
                const unknownMatch = errMsg.match(/unknown field name[:]?\s*\\?"([^"\\]+)\\?"/i);
                
                if (!unknownMatch) break;
                
                const badNameLower = unknownMatch[1].toLowerCase();
                let found = false;
                
                for (let rec of payloadRecords) {
                    const realKey = Object.keys(rec.fields).find(k => k.toLowerCase() === badNameLower);
                    if (realKey) {
                        delete rec.fields[realKey];
                        if (!droppedFields.includes(realKey)) droppedFields.push(realKey);
                        found = true;
                    }
                }
                
                if (!found) break;
            }
            
            if (droppedFields.length) {
                logs.push(`Dropped unknown fields for ${f['Booking Ref']}: ${droppedFields.join(', ')}`);
            }

            if (!createRes || !createRes.ok || createData.error) {
                logs.push(`Error creating records for ${f['Booking Ref']}: ${JSON.stringify(createData.error || 'Unknown error')}`);
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
                logs.push(`Error archiving original record ${record.id}: ${JSON.stringify(archiveData.error)}`);
            }
            
            logs.push(`Successfully split ${f['Booking Ref']}`);
            count++;
        }
        
        res.status(200).json({ success: true, count, logs });
        
    } catch (err) {
        res.status(500).json({ error: 'Migration failed', details: err.message });
    }
}
