export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { ref, action } = req.body;

    if (!ref || action !== 'on-the-way') {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN || process.env.AIRTABLE_API_KEY;
    const BASE_ID = 'appzmLNDAsk6m06Ae';
    const TABLE_ID = 'tblAIQuXsh9MPtsSC'; // Bookings table

    if (!AIRTABLE_API_KEY) {
        return res.status(500).json({ error: 'Airtable API key is missing' });
    }

    try {
        // 1. Fetch booking from Airtable by ref
        const queryUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=({Booking Ref}='${ref}')&maxRecords=1`;
        const airtableRes = await fetch(queryUrl, {
            headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });
        
        const data = await airtableRes.json();
        
        if (!data.records || data.records.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = data.records[0].fields;
        const customerPhone = booking['Customer Phone'];
        const customerName = booking['Customer Name'] ? booking['Customer Name'].split(' ')[0] : 'Customer';
        const driverName = booking['Driver Name'] || 'Your driver';
        
        if (!customerPhone) {
            return res.status(400).json({ error: 'Customer phone number missing' });
        }

        // Format phone to international
        const formattedPhone = customerPhone.replace(/\s+/g, '').replace(/^0/, '+44');

        // 2. Send SMS via ClickSend
        const smsRes = await fetch('https://rest.clicksend.com/v3/sms/send', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic Z3JhaGFtLm0uMjIyQGdtYWlsLmNvbTo2MzREMTAyQi0zMDRFLUI0QTUtQUQzQS1COTRFNDk1QjQ1OEM=',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        to: formattedPhone,
                        body: `Hi ${customerName}, your RM Transfers driver (${driverName}) is on the way to pick you up! See you soon.\n\n(Please do not reply to this automated text. If you have any changes, please call or text your driver directly at ${booking['Driver Phone'] || 'their number'}).`
                    }
                ]
            })
        });

        if (!smsRes.ok) {
            console.error("ClickSend error:", await smsRes.text());
            return res.status(500).json({ error: 'Failed to send SMS' });
        }

        return res.status(200).json({ success: true, message: 'Customer notified' });

    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
