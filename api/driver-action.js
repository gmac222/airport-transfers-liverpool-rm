export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { ref, action } = req.body;

    if (!ref || (action !== 'on-the-way' && action !== 'complete-job' && action !== 'close-job')) {
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

        const recordId = data.records[0].id;
        const booking = data.records[0].fields;
        const customerPhone = booking['Customer Phone'];
        const customerName = booking['Customer Name'] ? booking['Customer Name'].split(' ')[0] : 'Customer';
        const driverName = booking['Driver Name'] || 'Your driver';
        
        if (!customerPhone) {
            return res.status(400).json({ error: 'Customer phone number missing' });
        }

        // Format phone to international
        const formattedPhone = customerPhone.replace(/\s+/g, '').replace(/^0/, '+44');

        let messageBody = "";
        let scheduleTime = null;

        if (action === 'on-the-way') {
            messageBody = `Hi ${customerName}, your RM Transfers driver (${driverName}) is on the way to pick you up! See you soon.\n\n(Please do not reply to this automated text. If you have any changes, please call or text your driver directly at ${booking['Driver Phone'] || 'their number'}).`;
        } else if (action === 'close-job') {
            messageBody = `Hi ${customerName},\n\nThank you for traveling with RM Transfers!\n\nWe hope you had a great journey. If you have a moment, we'd really appreciate it if you could leave us a review on Trustpilot:\n\nhttps://uk.trustpilot.com/review/rmtransfers.co.uk?utm_medium=trustbox&utm_source=TrustBoxReviewCollector\n\nThanks again!`;
            
            // Calculate 24 hours from now
            const now = new Date();
            let sendDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            // Ensure sending only during normal hours (9 AM - 6 PM UK time)
            try {
                // Get the hour in UK time
                const formatter = new Intl.DateTimeFormat('en-GB', { 
                    timeZone: 'Europe/London', 
                    hour: 'numeric', 
                    hourCycle: 'h23' 
                });
                const ukHourStr = formatter.format(sendDate);
                // In some environments, it might include AM/PM or non-breaking spaces. We parse just the digits.
                const ukHour = parseInt(ukHourStr.replace(/\D/g, ''), 10);

                if (!isNaN(ukHour)) {
                    if (ukHour < 9) {
                        // Set to 9 AM
                        sendDate.setUTCHours(sendDate.getUTCHours() + (9 - ukHour));
                    } else if (ukHour >= 18) {
                        // Set to next day 9 AM
                        sendDate.setUTCHours(sendDate.getUTCHours() + (24 - ukHour + 9));
                    }
                }
                scheduleTime = Math.floor(sendDate.getTime() / 1000);
            } catch(e) {
                console.error("Timezone formatting error:", e);
                // Fallback to exactly 24 hours if Intl formatting fails
                scheduleTime = Math.floor(sendDate.getTime() / 1000);
            }

            // Update Airtable status to Archived
            const updateRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        'Status': 'Archived'
                    }
                })
            });

            if (!updateRes.ok) {
                console.error("Airtable update error:", await updateRes.text());
            }
        } else if (action === 'complete-job') {
            // Just update Airtable status to Completed
            const updateRes = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        'Status': 'Completed'
                    }
                })
            });

            if (!updateRes.ok) {
                console.error("Airtable update error:", await updateRes.text());
                return res.status(500).json({ error: 'Failed to update Airtable' });
            }
            
            return res.status(200).json({ success: true, message: 'Job marked as completed' });
        }

        if (messageBody) {
            const messagePayload = {
                to: formattedPhone,
                body: messageBody
            };

            if (scheduleTime) {
                messagePayload.schedule = scheduleTime;
            }

            // 2. Send SMS via ClickSend
            const smsRes = await fetch('https://rest.clicksend.com/v3/sms/send', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic Z3JhaGFtLm0uMjIyQGdtYWlsLmNvbTo2MzREMTAyQi0zMDRFLUI0QTUtQUQzQS1COTRFNDk1QjQ1OEM=',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [messagePayload]
                })
            });

            if (!smsRes.ok) {
                console.error("ClickSend error:", await smsRes.text());
                return res.status(500).json({ error: 'Failed to send SMS' });
            }

            return res.status(200).json({ success: true, message: action === 'close-job' ? 'Job archived and review scheduled' : 'Customer notified' });
        }
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
