export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, fields } = req.body;

    if (!action || !fields) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const customerPhone = fields['Customer Phone'];
    const formattedCustomerPhone = customerPhone ? customerPhone.replace(/\s+/g, '').replace(/^0/, '+44') : null;
    
    const driverPhone = fields['Driver Phone'];
    const formattedDriverPhone = driverPhone ? driverPhone.replace(/\s+/g, '').replace(/^0/, '+44') : null;

    const messages = [];

    if (action === 'send-payment-link') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nA driver has been assigned to your RM Transfers booking (${fields['Booking Ref']}).\n\nPlease complete your payment to secure your booking: ${fields['Payment Link']}\n\n(Please do not reply to this text.)`
        });
    }

    if (action === 'send-confirmation') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nPayment received! Your RM Transfers booking (${fields['Booking Ref']}) is now confirmed.\n\nYour driver is ${fields['Driver Name']} (${fields['Driver Phone']}).\n\nTrack your booking here: https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}\n\n(Please do not reply to this automated text. Text your driver directly.)`
        });
    }

    if (action === 'resend-customer') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThis is a resent confirmation for your RM Transfers booking (${fields['Booking Ref']}).\n\nYour driver is ${fields['Driver Name'] || 'not yet assigned'}.\n\nTrack your booking here: https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}\n\n(Please do not reply to this automated text. Text your driver directly.)`
        });
    }

    if (action === 'resend-driver') {
        if (!formattedDriverPhone) return res.status(400).json({ error: 'Missing driver phone' });
        messages.push({
            to: formattedDriverPhone,
            body: `RESEND JOB DETAILS: ${fields['Trip Type'] === 'return' ? 'RETURN' : 'ONE WAY'} for ${fields['Customer Name']}\nPickup: ${fields['Home Address']}\nDate: ${fields['Outbound Date']} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nCustomer Phone: ${fields['Customer Phone']}\nPrice: £${fields['Total Price']}\nPortal: https://airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
        });
    }

    if (messages.length === 0) {
        return res.status(400).json({ error: 'No valid action specified' });
    }

    try {
        const payload = {
            from: "RMTransfers", // Ensure this Sender ID is created/approved in your Webex dashboard
            message_body: messages[0].body,
            to: [
                { phone: [messages[0].to] }
            ]
        };

        const smsRes = await fetch('https://api.webexinteract.com/v1/sms', {
            method: 'POST',
            headers: {
                'X-AUTH-KEY': 'aky_3CrID4uqxBbCYQTA6H1p35A2lDn',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!smsRes.ok) {
            console.error("Webex error:", await smsRes.text());
            return res.status(500).json({ error: 'Failed to send SMS' });
        }

        return res.status(200).json({ success: true, message: 'SMS sent successfully' });
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
