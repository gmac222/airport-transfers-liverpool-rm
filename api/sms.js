export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, fields } = req.body;

    if (!action || !fields) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const formatPhone = (phone) => {
        if (!phone) return null;
        let p = String(phone).replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (p.startsWith('0')) return '+44' + p.substring(1);
        if (p.startsWith('44')) return '+' + p;
        if (!p.startsWith('+') && p.length === 10) return '+44' + p;
        if (!p.startsWith('+')) return '+' + p;
        return p;
    };

    const formattedCustomerPhone = formatPhone(fields['Customer Phone']);
    const formattedDriverPhone = formatPhone(fields['Driver Phone']);

    const messages = [];

    if (action === 'send-payment-link') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nA driver has been assigned to your RM Transfers booking (${fields['Booking Ref']}).\n\nThe total price for your journey is £${fields['Total Price']}.\n\nPlease go to https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']} to securely pay and confirm.\n\n(Please do not reply to this text)`
        });
    }

    if (action === 'send-confirmation') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nPayment received! Your RM Transfers booking (${fields['Booking Ref']}) is confirmed.\n\nYour driver is ${fields['Driver Name']} (${fields['Driver Phone']}).\n\n(Please do not reply to this text. Text your driver directly.)`
        });

        // Send Email Confirmation
        if (fields['Customer Email']) {
            const emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0E2747; line-height: 1.6; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
              <div style="text-align: center; padding: 20px; background: #0B1E37; border-radius: 12px 12px 0 0;">
                <img src="https://airporttaxitransfersliverpool.co.uk/assets/logo.png" alt="RM Transfers Logo" style="height: 60px; width: auto; object-fit: contain; margin: 10px 0;" />
              </div>
              
              <div style="padding: 30px; background: white; border-radius: 0 0 12px 12px; border: 1px solid #E8E2D4; border-top: none;">
                <img src="https://airporttaxitransfersliverpool.co.uk/meet_and_greet.png" alt="Happy trip" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 20px;" />
                
                <h2 style="color: #0B1E37; margin-top: 0; font-size: 24px;">Your Trip is Confirmed! ✈️</h2>
                
                <p>Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},</p>
                
                <p>Fantastic news! We have received your payment, and your booking (Ref: <strong>${fields['Booking Ref']}</strong>) is completely confirmed.</p>
                
                <p>We are absolutely thrilled to be taking you on your journey. Whether you're heading off on a well-deserved holiday or returning home, our goal is to make your transfer as smooth, relaxing, and enjoyable as possible!</p>
                
                <div style="background: rgba(31, 122, 76, 0.1); border-left: 4px solid #1f7a4c; padding: 16px; border-radius: 4px; margin: 24px 0;">
                  <h3 style="margin-top: 0; color: #1f7a4c; font-size: 16px; margin-bottom: 8px;">Your Driver Details</h3>
                  <p style="margin: 4px 0;"><strong>Driver Name:</strong> ${fields['Driver Name']}</p>
                  <p style="margin: 4px 0;"><strong>Contact Number:</strong> ${fields['Driver Phone']}</p>
                </div>
                
                <p>Your driver will be ready for your journey on <strong>${fields['Outbound Date']}</strong> at <strong>${fields['Outbound Time']}</strong>.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}" style="background: #E6B24B; color: #0B1E37; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px;">View Your Itinerary</a>
                </div>
                
                <p>If you need anything before your trip, please don't hesitate to reach out. We can't wait to see you!</p>
                
                <p style="color: #5b6472; font-size: 14px; margin-top: 30px;">Warm regards,<br><strong>The RM Transfers Team</strong><br>Liverpool's Premier Airport Transfer Service</p>
              </div>
            </div>`;

            try {
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer re_FXQGg4UN_LdgUL9U3j8jL2vhPmdpVqw8g',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'bookings@airporttaxitransfersliverpool.co.uk',
                        to: fields['Customer Email'],
                        subject: 'Booking Confirmed! Get Ready for Your Trip ✈️ - RM Transfers',
                        html: emailHtml
                    })
                });
            } catch (err) {
                console.error("Failed to send confirmation email:", err);
            }
        }
    }

    if (action === 'resend-customer') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThis is a resent confirmation for RM Transfers booking (${fields['Booking Ref']}).\n\nYour driver is ${fields['Driver Name'] || 'not yet assigned'}.\n\nView details: https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}\n\n(Please do not reply to this text)`
        });
    }

    if (action === 'resend-driver') {
        if (!formattedDriverPhone) return res.status(400).json({ error: 'Missing driver phone' });
        messages.push({
            to: formattedDriverPhone,
            from: 'RMTransfers',
            body: `RESEND JOB: ${fields['Trip Type'] === 'return' ? 'RETURN' : 'ONE WAY'} for ${fields['Customer Name']}\nPickup: ${fields['Home Address']}\nDate: ${fields['Outbound Date']} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nCustomer: ${fields['Customer Phone']}\nPrice: £${fields['Total Price']}\nPortal: https://airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
        });
    }

    if (action === 'driver-on-way') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nYour RM Transfers driver, ${fields['Driver Name']}, is on the way for your booking (${fields['Booking Ref']})!\n\nYou can contact them directly on ${fields['Driver Phone']}.`
        });
    }

    if (action === 'driver-arrived') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nYour RM Transfers driver, ${fields['Driver Name']}, is waiting outside.\n\nPlease come out when you are ready.`
        });
    }

    if (action === 'send-review-invite') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThank you for traveling with RM Transfers!\n\nWe hope you had a great journey. If you have a moment, we'd really appreciate it if you could leave us a review on Trustpilot:\n\nhttps://uk.trustpilot.com/review/rmtransfers.co.uk?utm_medium=trustbox&utm_source=TrustBoxReviewCollector\n\nThanks again!`
        });
    }

    if (action === 'reminder') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nFriendly reminder from RM Transfers!\n\nYour booking (${fields['Booking Ref']}) is scheduled for ${fields['Outbound Date']} at ${fields['Outbound Time']}.\n\nYour driver will be ${fields['Driver Name'] || 'assigned shortly'}.`
        });
    }

    if (action === 'new-booking-operator-alert') {
        const adminNumbers = ['+447398233859', '+447746899644'];
        adminNumbers.forEach(num => {
            messages.push({
                to: num,
                from: 'RMTransfers',
                body: `NEW BOOKING: ${fields['Booking Ref']}\nName: ${fields['Customer Name']}\nFrom: ${fields['Home Address']}\nTo: ${fields['Airport Name']}\nType: ${fields['Trip Type']}\nPax: ${fields['Passengers']} Bags: ${fields['Luggage']}\nPhone: ${fields['Customer Phone']}\nAdmin: https://airporttaxitransfersliverpool.co.uk/admin.html?ref=${fields['Booking Ref']}`
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
