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
        promoCode,     // optional promo/coupon code entered by user
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
            success_url: `${getBaseUrl(req)}/thank-you/?ref=${ref}&price=${amount}&type=${tripType}&paid=true${customerEmail ? '&email=1' : ''}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${getBaseUrl(req)}/?cancelled=true&ref=${ref}`,
        };

        // If user entered a promo code, try applying it as a coupon directly.
        // This handles Promotion Codes, Coupon IDs, and Coupon Names.
        if (promoCode) {
            try {
                let discountApplied = false;

                // 1. First try as a promotion code (customer-facing code)
                const promoCodes = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
                if (promoCodes.data.length > 0) {
                    sessionParams.discounts = [{ promotion_code: promoCodes.data[0].id }];
                    discountApplied = true;
                }

                // 2. If not a promotion code, check if it matches a Coupon ID or Name
                if (!discountApplied) {
                    const coupons = await stripe.coupons.list({ limit: 100 });
                    const matchedCoupon = coupons.data.find(c => 
                        (c.id === promoCode || (c.name && c.name.toUpperCase() === promoCode.toUpperCase())) && c.valid
                    );
                    
                    if (matchedCoupon) {
                        sessionParams.discounts = [{ coupon: matchedCoupon.id }];
                        discountApplied = true;
                    }
                }

                if (!discountApplied) {
                    // 3. Fall back to treating it as a coupon ID (this will trigger a clear invalid error from Stripe)
                    sessionParams.discounts = [{ coupon: promoCode }];
                }
            } catch (e) {
                console.error('[create-checkout] Promo code lookup error:', e.message);
                sessionParams.discounts = [{ coupon: promoCode }];
            }
        } else {
            // No code entered — show the promo field on Stripe Checkout
            sessionParams.allow_promotion_codes = true;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log(`[create-checkout] Session created: ${session.id} for ${ref} — £${amount}${promoCode ? ` (promo: ${promoCode})` : ''}`);

        return res.status(200).json({
            url: session.url,
            sessionId: session.id,
        });

    } catch (err) {
        console.error('[create-checkout] Stripe error:', err.message);
        // If the coupon/promo code is invalid, return a clear error
        if (err.type === 'StripeInvalidRequestError' && promoCode) {
            return res.status(400).json({ error: `Invalid promo code "${promoCode}". Please check and try again.` });
        }
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
