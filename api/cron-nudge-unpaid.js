// Daily Vercel cron — finds bookings that have been Awaiting Payment for
// more than 24 hours without a paid acknowledgement and haven't already
// had their nudge SMS sent. Fires send-payment-nudge for each, then flags
// Payment Nudge Sent = true on the booking so we don't double-nudge.
//
// Vercel triggers this via the cron entry in vercel.json. It also accepts
// manual GET requests for ad-hoc testing.

module.exports = async (req, res) => {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_ID = 'tblAIQuXsh9MPtsSC';

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is not configured.' });
    }

    // Vercel sets a special header on cron invocations. Allow them, plus
    // ad-hoc admin runs (no header).
    const isVercelCron = req.headers['x-vercel-cron'] === '1';

    try {
        const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;

        // Pull every Awaiting Payment record that hasn't already been nudged.
        // We let Airtable filter on Status + nudge flag; we evaluate the
        // 24h window in JS because Awaiting Payment Since is a singleLineText.
        const formula = `AND({Status}='Awaiting Payment', NOT({Payment Nudge Sent}))`;
        const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=` + encodeURIComponent(formula);
        const listRes = await fetch(url, { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } });
        const listData = await listRes.json();
        if (!listRes.ok) {
            console.error('Cron list failed:', listData);
            return res.status(500).json({ error: listData.error?.message || 'Airtable list failed' });
        }

        const candidates = (listData.records || []).filter(r => {
            const since = r.fields['Awaiting Payment Since'];
            if (!since) return false;
            const t = Date.parse(since);
            return Number.isFinite(t) && t < cutoffMs;
        });

        const results = [];
        for (const r of candidates) {
            const f = r.fields;
            try {
                const smsRes = await fetch('https://airporttaxitransfersliverpool.co.uk/api/sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send-payment-nudge',
                        fields: {
                            'Booking Ref': f['Booking Ref'],
                            'Customer Name': f['Customer Name'],
                            'Customer Phone': f['Customer Phone'],
                            'Customer Price': f['Customer Price'] ?? f['Total Price']
                        }
                    })
                });
                const smsData = await smsRes.json();
                if (smsData.error) throw new Error(smsData.error);

                // Mark as nudged
                await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${r.id}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields: { 'Payment Nudge Sent': true } })
                });

                results.push({ ref: f['Booking Ref'], status: 'nudged' });
            } catch (err) {
                console.error(`Cron nudge failed for ${f['Booking Ref']}:`, err);
                results.push({ ref: f['Booking Ref'], status: 'error', error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            triggeredBy: isVercelCron ? 'cron' : 'manual',
            checked: (listData.records || []).length,
            nudged: results.filter(r => r.status === 'nudged').length,
            results
        });
    } catch (err) {
        console.error('Cron error:', err);
        return res.status(500).json({ error: err.message });
    }
};
