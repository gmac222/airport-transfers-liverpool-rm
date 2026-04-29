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
                body: JSON.stringify({ fields, typecast: true })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Airtable error:', data);
                return res.status(response.status).json({ error: data.error?.message || 'Failed to update Airtable' });
            }

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

    // PATCH – update specific fields on a booking
    if (req.method === 'PATCH') {
        const { id, fields } = req.body;
        if (!id || !fields) {
            return res.status(400).json({ error: 'Missing booking id or fields' });
        }

        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`;

            // ─── Step 1: Fetch the EXISTING record so we can detect driver
            // changes and recompute Profit when either price changes.
            let oldRecord = {};
            const priceTouched = fields['Customer Price'] !== undefined ||
                                 fields['Operator Price'] !== undefined ||
                                 fields['Total Price'] !== undefined;
            if (fields['Driver Name'] !== undefined || fields['Return Driver Name'] !== undefined || fields['Status'] !== undefined || priceTouched) {
                try {
                    const existingRes = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
                    });
                    if (existingRes.ok) {
                        const existingData = await existingRes.json();
                        oldRecord = existingData.fields || {};
                    }
                } catch (fetchErr) {
                    console.error('Failed to fetch existing record (non-blocking):', fetchErr);
                }
            }

            // Recompute Profit whenever either price is touched. Falls back to
            // the existing record's value if only one side is in this PATCH.
            if (priceTouched) {
                const num = (v) => {
                    if (v === null || v === undefined || v === '') return 0;
                    const n = Number(v);
                    return Number.isFinite(n) ? n : 0;
                };
                const customer = fields['Customer Price'] !== undefined
                    ? num(fields['Customer Price'])
                    : num(oldRecord['Customer Price'] ?? oldRecord['Total Price']);
                const operator = fields['Operator Price'] !== undefined
                    ? num(fields['Operator Price'])
                    : num(oldRecord['Operator Price']);
                fields['Profit'] = customer - operator;
            }

            // ─── Step 2: Apply the update ─────────────────────────────────────
            // If Airtable rejects an unknown field (e.g. a column that hasn't
            // been added to the base yet), drop it and retry instead of failing
            // the whole assignment. Up to a few retries in case multiple
            // unknown fields are present.
            const patchAirtable = async (fieldsToSend) => {
                const r = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fields: fieldsToSend, typecast: true })
                });
                const j = await r.json();
                return { r, j };
            };

            let attemptFields = { ...fields };
            const droppedFields = [];
            let response, data;
            for (let attempt = 0; attempt < 6; attempt++) {
                ({ r: response, j: data } = await patchAirtable(attemptFields));
                if (response.ok) break;

                const errMsg = (data.error && (data.error.message || data.error.type)) || '';
                const unknownMatch = errMsg.match(/unknown field name[:]?\s*"([^"]+)"/i);
                if (!unknownMatch) break; // not an unknown-field error, give up

                const badNameLower = unknownMatch[1].toLowerCase();
                const realKey = Object.keys(attemptFields).find(k => k.toLowerCase() === badNameLower);
                if (!realKey) break; // can't locate the offender, give up
                droppedFields.push(realKey);
                delete attemptFields[realKey];
                if (Object.keys(attemptFields).length === 0) break;
            }

            if (!response.ok) {
                const msg = (data.error && (data.error.message || data.error.type)) || `Airtable ${response.status}`;
                return res.status(response.status).json({ error: msg });
            }
            if (droppedFields.length) {
                console.warn('Airtable PATCH succeeded after dropping unknown fields:', droppedFields);
            }
            // Reflect the actually-saved fields downstream (so SMS logic doesn't
            // try to use a value that wasn't persisted).
            for (const f of droppedFields) {
                delete fields[f];
            }

            const rec = data.fields || {};
            const CLICKSEND_AUTH = 'Basic Z3JhaGFtLm0uMjIyQGdtYWlsLmNvbTo2MzREMTAyQi0zMDRFLUI0QTUtQUQzQS1COTRFNDk1QjQ1OEM=';

            // Helper: format phone to E.164
            const formatPhone = (raw) => {
                if (!raw) return null;
                const cleaned = raw.replace(/\s+/g, '');
                if (cleaned.startsWith('+')) return cleaned;
                if (cleaned.startsWith('0')) return '+44' + cleaned.slice(1);
                return '+44' + cleaned;
            };

            // Helper: ISO -> DD/MM/YYYY for SMS bodies
            const fmtUKDate = (raw) => {
                if (!raw) return '—';
                const s = String(raw);
                const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
                return s;
            };

            // Helper: send SMS (non-blocking)
            const sendSms = async (to, body) => {
                try {
                    await fetch('https://rest.clicksend.com/v3/sms/send', {
                        method: 'POST',
                        headers: { 'Authorization': CLICKSEND_AUTH, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: [{ to, from: 'RMTransfers', body }] })
                    });
                    console.log(`SMS sent to ${to}`);
                } catch (err) {
                    console.error(`SMS to ${to} failed (non-blocking):`, err);
                }
            };

            // ─── Step 3: Outbound driver notifications ────────────────────────
            if (fields['Driver Name'] && fields['Driver Phone']) {
                const newDriverPhone = formatPhone(fields['Driver Phone']);

                // 3a. SMS to the NEW driver
                if (newDriverPhone) {
                    const driverMsg = `RM TRANSFERS – New Job Assigned\n\nRef: ${rec['Booking Ref'] || '—'}\nCustomer: ${rec['Customer Name'] || '—'}\nPickup: ${rec['Home Address'] || '—'}\nAirport: ${rec['Airport'] || '—'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '—'}\nPax: ${rec['Passengers'] || '—'} | Bags: ${rec['Luggage'] || '—'}\n\nView your jobs: https://airporttaxitransfersliverpool.co.uk/driver-portal.html`;
                    sendSms(newDriverPhone, driverMsg);
                }

                // 3b. SMS to CUSTOMER if driver was CHANGED (not first assignment)
                const oldDriverName = oldRecord['Driver Name'] || '';
                const newDriverName = fields['Driver Name'] || '';
                const isAlreadyPaid = (oldRecord['Status'] || rec['Status']) === 'Accepted';
                if (oldDriverName && oldDriverName !== newDriverName) {
                    const customerPhone = formatPhone(rec['Phone'] || rec['Customer Phone'] || '');
                    if (customerPhone) {
                        const custMsg = `RM TRANSFERS – Driver Update\n\nHi ${rec['Customer Name'] || 'there'},\n\nApologies, the driver for your upcoming transfer has been changed.\n\nYour new driver is: ${newDriverName}\nDriver contact: ${fields['Driver Phone'] || '—'}\n\nBooking Ref: ${rec['Booking Ref'] || '—'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '—'}\nPickup: ${rec['Home Address'] || '—'}\n\nWe apologise for any inconvenience.\n\nNeed to speak to us? Call 07746 899644.\n\nRM Transfers`;
                        sendSms(customerPhone, custMsg);
                        console.log(`Customer notified of driver change: ${oldDriverName} → ${newDriverName}`);
                    }
                } else if (!oldDriverName && newDriverName && isAlreadyPaid) {
                    // First-time driver assignment AFTER admin acknowledged
                    // payment — customer's been waiting for these details.
                    const customerPhone = formatPhone(rec['Phone'] || rec['Customer Phone'] || '');
                    if (customerPhone) {
                        const custMsg = `RM TRANSFERS – Driver Allocated\n\nHi ${rec['Customer Name'] || 'there'},\n\nGood news — your driver has been allocated.\n\nDriver: ${newDriverName}\nContact: ${fields['Driver Phone'] || '—'}\n\nBooking Ref: ${rec['Booking Ref'] || '—'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '—'}\nPickup: ${rec['Home Address'] || '—'}\n\nNeed to speak to us? Call 07746 899644.\n\nRM Transfers`;
                        sendSms(customerPhone, custMsg);
                        console.log(`Customer notified of first-time driver allocation post-payment: ${newDriverName}`);
                    }
                }
            }

            // ─── Step 3c: Customer declined the booking → notify admins ────
            // Fires when the Status field has just transitioned to 'Declined'.
            // We compare against oldRecord['Status'] so we don't re-spam if
            // an admin patches an already-declined booking later.
            if (fields['Status'] === 'Declined' && oldRecord['Status'] !== 'Declined') {
                const ADMIN_NUMBERS = ['+447398233859', '+447746899644']; // Graham, Roy
                const price = rec['Customer Price'] || rec['Total Price'];
                const adminMsg = `RM TRANSFERS – Booking DECLINED by customer\n\nRef: ${rec['Booking Ref'] || '—'}\nCustomer: ${rec['Customer Name'] || '—'}\nPhone: ${rec['Customer Phone'] || '—'}\nQuote: £${price ?? '—'}\nPickup: ${rec['Home Address'] || '—'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '—'}\n\nOpen: https://airporttaxitransfersliverpool.co.uk/admin.html?ref=${rec['Booking Ref'] || ''}`;
                ADMIN_NUMBERS.forEach(n => sendSms(n, adminMsg));
                console.log(`Admins notified of declined booking: ${rec['Booking Ref']}`);
            }

            // ─── Step 4: Return driver notifications ──────────────────────────
            if (fields['Return Driver Name'] && fields['Return Driver Phone']) {
                const retPhone = formatPhone(fields['Return Driver Phone']);

                // 4a. SMS to the NEW return driver
                if (retPhone) {
                    const retMsg = `RM TRANSFERS – Return Leg Assigned\n\nRef: ${rec['Booking Ref'] || '—'}\nCustomer: ${rec['Customer Name'] || '—'}\nPickup: ${rec['Airport'] || '—'} Airport\nDrop-off: ${rec['Home Address'] || '—'}\nReturn Date: ${fmtUKDate(rec['Return Date'])} at ${rec['Return Time'] || '—'}\nPax: ${rec['Passengers'] || '—'} | Bags: ${rec['Luggage'] || '—'}\n\nView your jobs: https://airporttaxitransfersliverpool.co.uk/driver-portal.html`;
                    sendSms(retPhone, retMsg);
                }

                // 4b. SMS to CUSTOMER if return driver was CHANGED
                const oldRetDriver = oldRecord['Return Driver Name'] || '';
                const newRetDriver = fields['Return Driver Name'] || '';
                if (oldRetDriver && oldRetDriver !== newRetDriver) {
                    const customerPhone = formatPhone(rec['Phone'] || rec['Customer Phone'] || '');
                    if (customerPhone) {
                        const custRetMsg = `RM TRANSFERS – Return Driver Update\n\nHi ${rec['Customer Name'] || 'there'},\n\nApologies, the driver for your return transfer has been changed.\n\nYour new return driver is: ${newRetDriver}\nDriver contact: ${fields['Return Driver Phone'] || '—'}\n\nBooking Ref: ${rec['Booking Ref'] || '—'}\nReturn Date: ${fmtUKDate(rec['Return Date'])} at ${rec['Return Time'] || '—'}\n\nWe apologise for any inconvenience.\n\nNeed to speak to us? Call 07746 899644.\n\nRM Transfers`;
                        sendSms(customerPhone, custRetMsg);
                        console.log(`Customer notified of return driver change: ${oldRetDriver} → ${newRetDriver}`);
                    }
                }
            }

            return res.status(200).json({ success: true, record: data });
        } catch (error) {
            console.error('PATCH booking error:', error);
            return res.status(500).json({ error: 'Failed to update booking' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
