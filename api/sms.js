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
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nA driver has been assigned to your RM Transfers booking (${fields['Booking Ref']}).\n\nThe total price for your journey is £${fields['Total Price']}.\n\nPlease go to airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']} to securely pay and confirm.\n\n(Please do not reply to this text)`
        });
    }

    if (action === 'send-confirmation') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nPayment received! Your RM Transfers booking (${fields['Booking Ref']}) is confirmed.\n\nYour driver is ${fields['Driver Name']} (${fields['Driver Phone']}).\n\n(Please do not reply to this text. Text your driver directly.)`
        });
    }

    if (action === 'resend-customer') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThis is a resent confirmation for RM Transfers booking (${fields['Booking Ref']}).\n\nYour driver is ${fields['Driver Name'] || 'not yet assigned'}.\n\nView details: airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}\n\n(Please do not reply to this text)`
        });
    }

    if (action === 'resend-driver') {
        if (!formattedDriverPhone) return res.status(400).json({ error: 'Missing driver phone' });
        messages.push({
            to: formattedDriverPhone,
            body: `RESEND JOB: ${fields['Trip Type'] === 'return' ? 'RETURN' : 'ONE WAY'} for ${fields['Customer Name']}\nPickup: ${fields['Home Address']}\nDate: ${fields['Outbound Date']} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nCustomer: ${fields['Customer Phone']}\nPrice: £${fields['Total Price']}\nPortal: airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
        });
    }

    if (action === 'driver-on-way') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nYour RM Transfers driver, ${fields['Driver Name']}, is on the way for your booking (${fields['Booking Ref']})!\n\nYou can contact them directly on ${fields['Driver Phone']}.`
        });
    }

    if (action === 'driver-arrived') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nYour RM Transfers driver, ${fields['Driver Name']}, is waiting outside.\n\nPlease come out when you are ready.`
        });
    }

    if (action === 'send-review-invite') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThank you for traveling with RM Transfers!\n\nWe hope you had a great journey. If you have a moment, we'd really appreciate it if you could leave us a review on Trustpilot:\n\nhttps://uk.trustpilot.com/review/rmtransfers.co.uk?utm_medium=trustbox&utm_source=TrustBoxReviewCollector\n\nThanks again!`
        });
    }

    if (action === 'reminder') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nFriendly reminder from RM Transfers!\n\nYour booking (${fields['Booking Ref']}) is scheduled for ${fields['Outbound Date']} at ${fields['Outbound Time']}.\n\nYour driver will be ${fields['Driver Name'] || 'assigned shortly'}.`
        });
    }

    if (action === 'new-booking-operator-alert') {
        const adminNumbers = ['+447398233859', '+447746899644'];
        adminNumbers.forEach(num => {
            messages.push({
                to: num,
                body: `NEW BOOKING: ${fields['Booking Ref']}\nName: ${fields['Customer Name']}\nFrom: ${fields['Home Address']}\nTo: ${fields['Airport Name']}\nType: ${fields['Trip Type']}\nPax: ${fields['Passengers']} Bags: ${fields['Luggage']}\nPhone: ${fields['Customer Phone']}`
            });
        });
    }

    if (messages.length === 0) {
        return res.status(400).json({ error: 'No valid action specified' });
    }

    try {
        const smsRes = await fetch('https://rest.clicksend.com/v3/sms/send', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic Z3JhaGFtLm0uMjIyQGdtYWlsLmNvbTo2MzREMTAyQi0zMDRFLUI0QTUtQUQzQS1COTRFNDk1QjQ1OEM=',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages })
        });

        if (!smsRes.ok) {
            console.error("ClickSend error:", await smsRes.text());
            return res.status(500).json({ error: 'Failed to send SMS' });
        }

        return res.status(200).json({ success: true, message: 'SMS sent successfully' });
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
