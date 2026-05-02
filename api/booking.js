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


    // GET Request for Admin to fetch all pending/accepted bookings.
    //
    // ?view=operator or ?view=driver redacts the customer's name, phone,
    // email and home address until the booking is BOTH post-payment
    // (Status in {Accepted, Completed, Archived}) AND has been dispatched
    // by admin (Dispatched To Operator = true). Admin/super-admin omits
    // the param and sees everything.
    if (req.method === 'POST' && req.query.action === 'list') {
        try {
            const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?sort%5B0%5D%5Bfield%5D=Submitted+At&sort%5B0%5D%5Bdirection%5D=desc`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`
                }
            });

            const data = await response.json();
            let bookings = data.records || [];

            const view = (req.query.view || '').toString().toLowerCase();
            if (view === 'operator' || view === 'driver') {
                const POST_PAYMENT = new Set(['Accepted', 'Completed', 'Archived']);
                // A booking also counts as "paid" for visibility purposes if
                // Stripe has marked Payment Status = Paid (direct checkout flow),
                // even if admin hasn't yet acknowledged it.
                const isPaidRecord = (f) => POST_PAYMENT.has(f['Status']) || f['Payment Status'] === 'Paid';
                if (view === 'driver') {
                    // Drivers must not see a booking at all until it has
                    // been paid AND admin has dispatched it to the operator.
                    // (Operators allocate the driver only after dispatch,
                    // so this also covers the "before my operator picked
                    // me" case.)
                    bookings = bookings.filter(rec => {
                        const f = rec.fields || {};
                        return isPaidRecord(f) && f['Dispatched To Operator'] === true;
                    });
                } else {
                    // Operator: keep the booking visible (so they can plan)
                    // but redact customer PII until paid + dispatched.
                    bookings = bookings.map(rec => {
                        const f = rec.fields || {};
                        const isPostPayment = isPaidRecord(f);
                        const isDispatched = f['Dispatched To Operator'] === true;
                        if (isPostPayment && isDispatched) return rec;
                        const redacted = { ...f };
                        delete redacted['Customer Name'];
                        delete redacted['Customer Phone'];
                        delete redacted['Customer Email'];
                        delete redacted['Home Address'];
                        return { ...rec, fields: redacted };
                    });
                }
            }

            return res.status(200).json({ bookings });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Failed to list bookings' });
        }
    }

    // POST Request: Create Manual Booking
    if (req.method === 'POST' && req.query.action === 'create') {
        const { fields, typecast } = req.body;

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
                body: JSON.stringify({ records: [{ fields }], typecast: !!typecast })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                console.error('[booking create] Airtable error:', JSON.stringify(data));
                return res.status(400).json({ error: data.error?.message || 'Airtable rejected the record', details: data.error });
            }

            return res.status(200).json({ booking: data.records[0] });
        } catch (error) {
            console.error('[booking create]', error);
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
            if (fields['Driver Name'] !== undefined || fields['Return Driver Name'] !== undefined || fields['Status'] !== undefined || fields['Dispatched To Operator'] !== undefined || fields['Operator'] !== undefined || priceTouched) {
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

            // Helper: send SMS. Returns the awaited promise so callers
            // can `await` it. We also inspect the ClickSend response body
            // so authentication / bad-number errors actually show up in
            // the Vercel logs instead of being silently swallowed.
            const sendSms = async (to, body) => {
                try {
                    const r = await fetch('https://rest.clicksend.com/v3/sms/send', {
                        method: 'POST',
                        headers: { 'Authorization': CLICKSEND_AUTH, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: [{ to, from: 'RMTransfers', body }] })
                    });
                    const txt = await r.text();
                    if (!r.ok) {
                        console.error(`ClickSend ${r.status} for ${to}: ${txt}`);
                    } else {
                        console.log(`SMS sent to ${to}`);
                    }
                } catch (err) {
                    console.error(`SMS to ${to} failed (non-blocking):`, err);
                }
            };

            // ─── Step 3: Outbound driver notifications ────────────────────────
            if (fields['Driver Name'] && fields['Driver Phone']) {
                const newDriverPhone = formatPhone(fields['Driver Phone']);

                // 3a. SMS to the NEW driver. Awaited + ASCII so we can see
                // a real ClickSend error in Vercel logs and so the
                // serverless function can't terminate before the request
                // is sent.
                if (newDriverPhone) {
                    console.log(`Driver SMS trigger fired for ${rec['Booking Ref']} -> ${fields['Driver Name']} @ ${newDriverPhone}`);
                    const driverMsg = `RM TRANSFERS - New Job Assigned\n\nRef: ${rec['Booking Ref'] || '-'}\nCustomer: ${rec['Customer Name'] || '-'}\nPickup: ${rec['Home Address'] || '-'}\nAirport: ${rec['Airport'] || '-'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '-'}\nPassengers: ${rec['Passengers'] || '-'} | Bags: ${rec['Luggage'] || '-'}\n\nView your jobs: https://airporttaxitransfersliverpool.co.uk/driver-portal.html`;
                    await sendSms(newDriverPhone, driverMsg);
                } else {
                    console.warn(`Driver SMS skipped — could not format phone for ${fields['Driver Name']}: ${fields['Driver Phone']}`);
                }

                // Customer is intentionally NOT notified about driver
                // assignments or changes — they don't need to know who the
                // driver is until pickup. Driver contact details only
                // appear in customer-facing comms via the "on the way" /
                // "outside" / "pickup location" buttons the driver or
                // operator presses on the day.
            } else if (fields['Driver Name'] !== undefined) {
                // Operator picked a driver but the PATCH carried no phone
                // — this happens when the operator picks via the quick
                // dropdown and the driver record has no phone on file.
                console.warn(`Driver Name set to '${fields['Driver Name']}' on ${rec['Booking Ref']} but no Driver Phone in PATCH — SMS skipped.`);
            }

            // ─── Step 3b-bis: notify operator + auto-assign default driver
            // Trigger when EITHER:
            //   (a) Dispatched To Operator just flipped to true, OR
            //   (b) the Operator field changed on an already-dispatched
            //       booking (admin re-routed it).
            // Both cases mean a NEW operator now owns this job and
            // should hear about it.
            const dispatchFlippedOn = fields['Dispatched To Operator'] === true && oldRecord['Dispatched To Operator'] !== true;
            const reRouted = fields['Operator'] !== undefined &&
                             fields['Operator'] &&
                             oldRecord['Operator'] !== fields['Operator'] &&
                             rec['Dispatched To Operator'] === true;
            if (dispatchFlippedOn || reRouted) {
                const opName = rec['Operator'] || oldRecord['Operator'];
                console.log(`Dispatch trigger fired for ${rec['Booking Ref']} -> ${opName} (flipped=${dispatchFlippedOn}, reRouted=${reRouted})`);
                if (opName) {
                    try {
                        const opUrl = `https://api.airtable.com/v0/${BASE_ID}/Operators?filterByFormula=` + encodeURIComponent(`{Name}='${opName.replace(/'/g, "\\'")}'`);
                        const opRes = await fetch(opUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
                        const opData = await opRes.json();
                        const opRecord = opData.records && opData.records[0];
                        const opPhone = opRecord && formatPhone(opRecord.fields['Phone']);
                        const defaultDriver = opRecord && opRecord.fields['Default Driver'];

                        // Auto-assign default driver if booking has none yet
                        // (only on a fresh dispatch — re-routing keeps the
                        // existing driver assignment so admin can decide).
                        if (dispatchFlippedOn && defaultDriver && !rec['Driver Name']) {
                            try {
                                const drvUrl = `https://api.airtable.com/v0/${BASE_ID}/tblgM0WSDVJUbbjS2?filterByFormula=` + encodeURIComponent(`AND({Name}='${defaultDriver.replace(/'/g, "\\'")}', {Operator}='${opName.replace(/'/g, "\\'")}')`);
                                const drvRes = await fetch(drvUrl, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
                                const drvData = await drvRes.json();
                                const drvRecord = drvData.records && drvData.records[0];
                                const drvPhoneRaw = drvRecord && drvRecord.fields['Phone'];
                                if (drvRecord) {
                                    await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
                                        method: 'PATCH',
                                        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ fields: { 'Driver Name': defaultDriver, 'Driver Phone': drvPhoneRaw || '' } })
                                    });
                                    rec['Driver Name'] = defaultDriver;
                                    rec['Driver Phone'] = drvPhoneRaw || '';
                                    console.log(`Auto-assigned default driver ${defaultDriver} to ${rec['Booking Ref']}`);

                                    // Step 3a's gate already passed (Driver
                                    // wasn't in the original PATCH), so fire
                                    // the driver SMS here directly.
                                    const drvSmsPhone = formatPhone(drvPhoneRaw);
                                    if (drvSmsPhone) {
                                        const driverMsg = `RM TRANSFERS - New Job Assigned\n\nRef: ${rec['Booking Ref'] || '-'}\nCustomer: ${rec['Customer Name'] || '-'}\nPickup: ${rec['Home Address'] || '-'}\nAirport: ${rec['Airport'] || '-'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '-'}\nPassengers: ${rec['Passengers'] || '-'} | Bags: ${rec['Luggage'] || '-'}\n\nView your jobs: https://airporttaxitransfersliverpool.co.uk/driver-portal.html`;
                                        console.log(`Driver SMS (auto-assign) firing for ${rec['Booking Ref']} -> ${defaultDriver} @ ${drvSmsPhone}`);
                                        await sendSms(drvSmsPhone, driverMsg);
                                    } else {
                                        console.warn(`Auto-assigned ${defaultDriver} has no usable phone - SMS skipped.`);
                                    }
                                } else {
                                    console.warn(`Default driver ${defaultDriver} not found for operator ${opName} - skipping auto-assign.`);
                                }
                            } catch (drvErr) {
                                console.error('Default-driver lookup failed:', drvErr);
                            }
                        }

                        if (opPhone) {
                            const isReturn = (rec['Trip Type'] || '') === 'return';
                            // ASCII-only body so ClickSend doesn't choke on Unicode dashes.
                            const dispatchMsg = `RM TRANSFERS - New Job Dispatched\n\nA new ${isReturn ? 'return' : 'one-way'} booking has been added to your operator portal.\n\nRef: ${rec['Booking Ref'] || '-'}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || '-'}\nAirport: ${rec['Airport'] || '-'}\nPassengers/Bags: ${rec['Passengers'] || '?'} / ${rec['Luggage'] || '?'}\n\nAllocate a driver here: https://airporttaxitransfersliverpool.co.uk/operator.html?ref=${rec['Booking Ref'] || ''}`;
                            // Await so Vercel doesn't kill the function before
                            // ClickSend has actually been called.
                            await sendSms(opPhone, dispatchMsg);
                            console.log(`Operator ${opName} notified of dispatch: ${rec['Booking Ref']}`);
                        } else {
                            console.warn(`Operator ${opName} has no usable phone in the Operators table - skipping dispatch SMS.`);
                        }
                    } catch (lookupErr) {
                        console.error('Operator dispatch SMS lookup failed:', lookupErr);
                    }
                }
            }

            // ─── Step 3c: Customer declined the booking → notify admins ────
            // Fires when the Status field has just transitioned to 'Declined'.
            // We compare against oldRecord['Status'] so we don't re-spam if
            // an admin patches an already-declined booking later.
            if (fields['Status'] === 'Declined' && oldRecord['Status'] !== 'Declined') {
                console.log(`Decline trigger fired for ${rec['Booking Ref']} (was ${oldRecord['Status'] || 'undefined'})`);
                const ADMIN_NUMBERS = ['+447398233859', '+447746899644']; // Graham, Roy
                const price = rec['Customer Price'] || rec['Total Price'];
                // Use plain ASCII so ClickSend doesn't choke on Unicode dashes.
                const dash = '-';
                const adminMsg = `RM TRANSFERS ${dash} Booking DECLINED by customer\n\nRef: ${rec['Booking Ref'] || dash}\nCustomer: ${rec['Customer Name'] || dash}\nPhone: ${rec['Customer Phone'] || dash}\nQuote: GBP ${price ?? dash}\nPickup: ${rec['Home Address'] || dash}\nDate: ${fmtUKDate(rec['Outbound Date'])} at ${rec['Outbound Time'] || dash}\n\nOpen: https://airporttaxitransfersliverpool.co.uk/admin.html?ref=${rec['Booking Ref'] || ''}`;
                // Await both so the serverless function can't terminate before
                // ClickSend has actually been called.
                await Promise.all(ADMIN_NUMBERS.map(n => sendSms(n, adminMsg)));
                console.log(`Admins notified of declined booking: ${rec['Booking Ref']}`);
            }

            // ─── Step 4: Return driver notifications ──────────────────────────
            if (fields['Return Driver Name'] && fields['Return Driver Phone']) {
                const retPhone = formatPhone(fields['Return Driver Phone']);

                // 4a. SMS to the NEW return driver
                if (retPhone) {
                    const retMsg = `RM TRANSFERS – Return Leg Assigned\n\nRef: ${rec['Booking Ref'] || '—'}\nCustomer: ${rec['Customer Name'] || '—'}\nPickup: ${rec['Airport'] || '—'} Airport\nDrop-off: ${rec['Home Address'] || '—'}\nReturn Date: ${fmtUKDate(rec['Return Date'])} at ${rec['Return Time'] || '—'}\nPassengers: ${rec['Passengers'] || '—'} | Bags: ${rec['Luggage'] || '—'}\n\nView your jobs: https://airporttaxitransfersliverpool.co.uk/driver-portal.html`;
                    sendSms(retPhone, retMsg);
                }

                // Customer is intentionally NOT notified about return-leg
                // driver assignments or changes. Pickup-location comms for
                // the return leg are handled via the explicit "Send pickup
                // location" button in the driver / operator portals.
            }

            return res.status(200).json({ success: true, record: data });
        } catch (error) {
            console.error('PATCH booking error:', error);
            return res.status(500).json({ error: 'Failed to update booking' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
