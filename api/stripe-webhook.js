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

            // Update Customer Price + Total Price with the amount paid
            await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        'Customer Price': parseFloat(amountPaid),
                        'Total Price': parseFloat(amountPaid),
                        'Payment Status': 'Paid',
                        'Stripe Session ID': session.id,
                    }
                })
            });
            console.log(`[stripe-webhook] Airtable updated: ${recordId} → £${amountPaid}`);
        }
    } catch (err) {
        console.error('[stripe-webhook] Airtable update failed:', err.message);
    }

    // --- 2. Send customer acknowledgement SMS ---
    try {
        const smsBaseUrl = getBaseUrl(req);
        await fetch(`${smsBaseUrl}/api/sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send-booking-received',
                fields: {
                    'Booking Ref': ref,
                    'Customer Name': bookingFields['Customer Name'] || customerName,
                    'Customer Phone': bookingFields['Customer Phone'] || customerPhone,
                    'Quoted Price': amountPaid,
                    'Vehicle Type': vehicleType,
                }
            })
        });
        console.log(`[stripe-webhook] Customer SMS sent for ${ref}`);
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
                fields: {
                    'Booking Ref': ref,
                    'Customer Name': bookingFields['Customer Name'] || customerName,
                    'Customer Phone': bookingFields['Customer Phone'] || customerPhone,
                    'Home Address': bookingFields['Home Address'] || '',
                    'Airport Name': bookingFields['Airport Name'] || bookingFields['Airport'] || '',
                    'Trip Type': bookingFields['Trip Type'] || tripType,
                    'Passengers': bookingFields['Passengers'] || '',
                    'Luggage': bookingFields['Luggage'] || '',
                    'Vehicle Type': bookingFields['Vehicle Type'] || vehicleType,
                    'Quoted Price': amountPaid,
                }
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
