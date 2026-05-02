import Stripe from 'stripe';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY) {
        console.error('[create-checkout] STRIPE_SECRET_KEY not set');
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const {
        ref,
        amount,        // total in pounds (e.g. 110.00)
        customerName,
        customerEmail,
        customerPhone,
        tripSummary,   // e.g. "Return · Liverpool John Lennon · Car"
        vehicleType,   // e.g. "Car", "MPV", "8 Seater"
        tripType,      // "return" or "oneway"
    } = req.body;

    // Validation
    if (!ref || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Missing ref or invalid amount' });
    }

    const amountInPence = Math.round(amount * 100);

    // Build a clear line-item description for the Stripe Checkout page
    const description = tripSummary || `Airport Transfer (${ref})`;

    try {
        const sessionParams = {
            mode: 'payment',
            payment_method_types: ['card'],
            allow_promotion_codes: true,  // Allows 100OFF coupon entry
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: `Airport Transfer — ${ref}`,
                            description: description,
                        },
                        unit_amount: amountInPence,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                booking_ref: ref,
                vehicle_type: vehicleType || '',
                trip_type: tripType || '',
            },
            // Pre-fill customer details if available
            ...(customerEmail && {
                customer_email: customerEmail,
            }),
            // Success & cancel URLs
            success_url: `${getBaseUrl(req)}/thank-you/?ref=${ref}&price=${amount}&type=${tripType}&paid=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${getBaseUrl(req)}/?cancelled=true&ref=${ref}`,
        };

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`[create-checkout] Session created: ${session.id} for ${ref} — £${amount}`);

        return res.status(200).json({
            url: session.url,
            sessionId: session.id,
        });

    } catch (err) {
        console.error('[create-checkout] Stripe error:', err.message);
        return res.status(500).json({ error: 'Failed to create checkout session' });
    }
}

/**
 * Determine the base URL from the request headers.
 * Works for both Vercel preview and production deployments.
 */
function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
}
