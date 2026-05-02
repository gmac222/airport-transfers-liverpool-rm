import Stripe from 'stripe';

/**
 * POST /api/stripe-webhook
 *
 * Called by Stripe after a Checkout Session completes.
 * Responsibilities:
 *   1. Verify the event (using the webhook signing secret).
 *   2. Look up the booking ref from metadata.
 *   3. Update Airtable with the paid price (Customer Price).
 *   4. Fire customer acknowledgement SMS.
 *   5. Fire admin operator alert SMS.
 */
export const config = { api: { bodyParser: false } };   // raw body needed for Stripe sig

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        console.error('[stripe-webhook] Missing Stripe env vars');
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // --- Read raw body for signature verification ---
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            req.headers['stripe-signature'],
            STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('[stripe-webhook] Signature verification failed:', err.message);
        return res.status(400).json({ error: 'Invalid signature' });
    }

    // Only handle completed checkout sessions
    if (event.type !== 'checkout.session.completed') {
        return res.status(200).json({ received: true });
    }

    const session = event.data.object;
    const ref = session.metadata?.booking_ref;
    const vehicleType = session.metadata?.vehicle_type || '';
    const tripType = session.metadata?.trip_type || '';
    const amountPaid = (session.amount_total / 100).toFixed(2);   // pence → pounds
    const customerName = session.customer_details?.name || '';
    const customerEmail = session.customer_details?.email || '';
    const customerPhone = session.customer_details?.phone || '';

    console.log(`[stripe-webhook] Payment complete: ${ref} — £${amountPaid}`);

    if (!ref) {
        console.error('[stripe-webhook] No booking_ref in metadata');
        return res.status(200).json({ received: true });
    }

    // --- 1. Find the Airtable record by booking ref and update Customer Price ---
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_NAME = 'tblAIQuXsh9MPtsSC';
    let recordId = null;
    let bookingFields = {};

    try {
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={Booking Ref}="${ref}"&maxRecords=1`;
        const atRes = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
        });
        const atData = await atRes.json();
        if (atData.records?.length) {
            recordId = atData.records[0].id;
            bookingFields = atData.records[0].fields;

            // Build the patch. We DO NOT overwrite Customer Price with the
            // amount actually charged — a 100% promo would zero it out and
            // lose the original quote. Keep the original Customer Price and
            // store what Stripe actually collected in 'Amount Paid' instead.
            const paidNum = parseFloat(amountPaid);
            const fieldsToUpdate = {
                'Payment Status': 'Paid',
                'Stripe Session ID': session.id,
                // Customer paid directly via Stripe checkout — auto-advance
                // the booking so the operator can allocate a driver without
                // waiting for an admin to click "Acknowledge Payment".
                'Status': 'Accepted',
                'Dispatched To Operator': true,
                'Amount Paid': paidNum,
            };
            // Only set Customer Price / Total Price from the payment if
            // they're missing — this protects the quoted price when a
            // discount/promo was applied at checkout.
            if (bookingFields['Customer Price'] == null) {
                fieldsToUpdate['Customer Price'] = paidNum;
            }
            if (bookingFields['Total Price'] == null) {
                fieldsToUpdate['Total Price'] = paidNum;
            }

            // Try the patch. If Airtable rejects an UNKNOWN_FIELD_NAME
            // (e.g. 'Payment Status' or 'Amount Paid' columns haven't
            // been added to the base yet) drop that field and retry — we
            // care far more about Status / Dispatched To Operator
            // landing than about losing one optional column. Up to a few
            // retries in case multiple unknown fields are present.
            const patchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`;
            const droppedFields = [];
            let patchOk = false;
            for (let attempt = 0; attempt < 6; attempt++) {
                const patchRes = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fields: fieldsToUpdate, typecast: true })
                });
                if (patchRes.ok) { patchOk = true; break; }
                const errBody = await patchRes.text();
                const match = errBody.match(/Unknown field name:?\s*\\?"([^"\\]+)\\?"/i);
                if (!match) {
                    console.error(`[stripe-webhook] Airtable PATCH failed (non-recoverable): ${patchRes.status} ${errBody}`);
                    break;
                }
                const badNameLower = match[1].toLowerCase();
                const realKey = Object.keys(fieldsToUpdate).find(k => k.toLowerCase() === badNameLower);
                if (!realKey) {
                    console.error(`[stripe-webhook] Airtable rejected unknown field '${match[1]}' but couldn't locate it in payload — giving up.`);
                    break;
                }
                droppedFields.push(realKey);
                delete fieldsToUpdate[realKey];
                if (Object.keys(fieldsToUpdate).length === 0) break;
            }
            if (droppedFields.length) {
                console.warn(`[stripe-webhook] Airtable accepted PATCH after dropping unknown fields: ${droppedFields.join(', ')}`);
            }
            if (!patchOk) {
                console.error(`[stripe-webhook] Airtable PATCH ultimately failed for ${recordId} — booking will stay Pending.`);
            } else {
                console.log(`[stripe-webhook] Airtable updated: ${recordId} → paid £${amountPaid}`);
            }
        }
    } catch (err) {
        console.error('[stripe-webhook] Airtable update failed:', err.message);
    }

    // Build the complete fields object for SMS / email — merge Airtable record
    // with the payment data from Stripe so templates have everything they need.
    const smsFields = {
        ...bookingFields,
        'Booking Ref': ref,
        'Quoted Price': amountPaid,
        'Customer Price': amountPaid,
        'Total Price': amountPaid,
        'Payment Status': 'Paid',
    };
    // Fallback to Stripe data if Airtable didn't have it
    if (!smsFields['Customer Name']) smsFields['Customer Name'] = customerName;
    if (!smsFields['Customer Phone']) smsFields['Customer Phone'] = customerPhone;
    if (!smsFields['Customer Email']) smsFields['Customer Email'] = customerEmail;
    if (!smsFields['Vehicle Type']) smsFields['Vehicle Type'] = vehicleType;
    if (!smsFields['Trip Type']) smsFields['Trip Type'] = tripType;

    // --- 2. Send customer confirmation SMS + email ---
    try {
        const smsBaseUrl = getBaseUrl(req);
        await fetch(`${smsBaseUrl}/api/sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send-booking-received',
                fields: smsFields
            })
        });
        console.log(`[stripe-webhook] Customer SMS + email sent for ${ref}`);
    } catch (err) {
        console.error('[stripe-webhook] Customer SMS failed:', err.message);
    }

    // --- 3. Send admin operator alert SMS ---
    try {
        const smsBaseUrl = getBaseUrl(req);
        await fetch(`${smsBaseUrl}/api/sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'new-booking-operator-alert',
                fields: smsFields
            })
        });
        console.log(`[stripe-webhook] Admin SMS sent for ${ref}`);
    } catch (err) {
        console.error('[stripe-webhook] Admin SMS failed:', err.message);
    }

    return res.status(200).json({ received: true });
}

function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
}
