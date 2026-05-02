export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, fields } = req.body;

    if (!action || !fields) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const SUPPORT_PHONE = '07746 899644';
    const SUPPORT_LINE = `\n\nNeed to speak to us? Call ${SUPPORT_PHONE}.`;

    // UK date helper for SMS / email bodies. Airtable returns ISO
    // (YYYY-MM-DD); customers expect DD/MM/YYYY.
    const fmtUKDate = (raw) => {
        if (!raw) return '';
        const s = String(raw);
        const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (ymd) return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
        const d = new Date(s);
        if (isNaN(d.getTime())) return s;
        return d.toLocaleDateString('en-GB');
    };

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

    // Render + send the booking-confirmation email. Driver block is hidden
    // when no driver is allocated yet (we promise SMS 24h before pickup).
    const sendConfirmationEmail = async () => {
        if (!fields['Customer Email']) return;
        const emailHtml = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0E2747; line-height: 1.6; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
              <div style="text-align: center; padding: 30px 20px; background: #0B1E37; border-radius: 12px 12px 0 0;">
                <img src="https://airporttaxitransfersliverpool.co.uk/assets/logo.png" alt="RM Transfers Logo" style="height: 50px; width: auto; object-fit: contain;" />
              </div>

              <div style="padding: 40px 30px; background: white; border-radius: 0 0 12px 12px; border: 1px solid #E8E2D4; border-top: none;">
                <img src="https://airporttaxitransfersliverpool.co.uk/assets/airport-arrivals-greet.jpg" alt="Your Journey Begins" style="width: 100%; height: auto; object-fit: cover; border-radius: 8px; margin-bottom: 24px;" />

                <h2 style="color: #0B1E37; margin-top: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">You're All Set for a Great Trip! ✈️</h2>

                <p style="font-size: 16px;">Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},</p>

                <p style="font-size: 16px;">Fantastic news! Your payment has been received and your booking (Ref: <strong style="color: #E6B24B;">${fields['Booking Ref']}</strong>) is now <strong>100% confirmed</strong>.</p>

                <p style="font-size: 16px;">We are absolutely thrilled to be taking you on your journey. Whether you're heading off on a well-deserved holiday or returning home, our priority is to make your transfer smooth, relaxing, and enjoyable!</p>

                ${fields['Driver Name'] ? `
                <div style="background: #F3EEE4; border-left: 4px solid #C7932F; padding: 20px; border-radius: 6px; margin: 30px 0;">
                  <h3 style="margin-top: 0; color: #0E2747; font-size: 18px; margin-bottom: 12px;">Your Driver Details</h3>
                  <p style="margin: 6px 0; font-size: 15px;"><strong>Driver:</strong> ${fields['Driver Name']}</p>
                  <p style="margin: 6px 0; font-size: 15px;"><strong>Contact:</strong> ${fields['Driver Phone'] || '—'}</p>
                </div>` : ''}

                <div style="background: #F8F9FA; border-left: 4px solid #0B1E37; padding: 20px; border-radius: 6px; margin: 30px 0;">
                  <h3 style="margin-top: 0; color: #0E2747; font-size: 18px; margin-bottom: 12px;">Trip Summary</h3>
                  <p style="margin: 6px 0; font-size: 15px;"><strong>From:</strong> ${fields['Trip Type'] === 'return' ? fields['Home Address'] : (fields['Oneway Direction'] === 'from' ? (fields['Airport Name'] || fields['Airport']) : fields['Home Address'])}</p>
                  <p style="margin: 6px 0; font-size: 15px;"><strong>To:</strong> ${fields['Trip Type'] === 'return' ? (fields['Airport Name'] || fields['Airport']) + ' (Return)' : (fields['Oneway Direction'] === 'from' ? fields['Home Address'] : (fields['Airport Name'] || fields['Airport']))}</p>
                  <p style="margin: 6px 0; font-size: 15px;"><strong>Outbound:</strong> ${fmtUKDate(fields['Outbound Date'])} at ${fields['Outbound Time'] || '—'}</p>
                  ${fields['Outbound Flight'] ? `<p style="margin: 6px 0; font-size: 15px;"><strong>Flight:</strong> ${fields['Outbound Flight']}</p>` : ''}
                  ${fields['Trip Type'] === 'return' && fields['Return Date'] ? `<p style="margin: 6px 0; font-size: 15px;"><strong>Return:</strong> ${fmtUKDate(fields['Return Date'])} at ${fields['Return Time'] || '—'}</p>` : ''}
                  ${(fields['Passengers'] || fields['Luggage']) ? `<p style="margin: 6px 0; font-size: 15px;"><strong>Passengers / Bags:</strong> ${fields['Passengers'] || '?'} / ${fields['Luggage'] || '?'}</p>` : ''}
                </div>

                <p style="font-size: 16px;">Your driver will be ready to meet you on time at your pickup location. They will assist you with your luggage and ensure a comfortable ride in one of our premium vehicles.</p>

                <div style="text-align: center; margin: 40px 0;">
                  <a href="https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}" style="background: #0B1E37; color: #ffffff; font-weight: 600; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">View Your Booking &amp; Save to Home Screen</a>
                </div>

                <img src="https://airporttaxitransfersliverpool.co.uk/assets/airport-transfers-fleet.jpg" alt="Our Premium Fleet" style="width: 100%; height: auto; object-fit: cover; border-radius: 8px; margin-bottom: 24px;" />

                <p style="font-size: 16px;">If you need anything at all before your trip, please don't hesitate to reach out.</p>

                <p style="font-size: 16px;"><strong>Customer Services:</strong> Roy Medlam — <a href="tel:07746899644" style="color: #0E2747; text-decoration: none; font-weight: 600;">07746 899644</a></p>

                <div style="margin-top: 40px; border-top: 1px solid #E8E2D4; padding-top: 20px;">
                  <p style="color: #5b6472; font-size: 14px; margin-bottom: 4px;">Warm regards,</p>
                  <p style="color: #0E2747; font-size: 16px; font-weight: bold; margin-top: 0;">The RM Transfers Team<br><span style="font-size: 14px; font-weight: normal; color: #5b6472;">Liverpool's Premium Airport Transfer Service</span></p>
                </div>
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
    };



    // Sent when admin acknowledges payment. We deliberately DO NOT include
    // the driver's details here — those go out in the 24-hour reminder so
    // the customer has them fresh on the day. This message is the primary
    // booking confirmation: trip details, where to manage the booking, and
    // who to call if anything changes.
    if (action === 'send-payment-received') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });

        const isReturn = fields['Trip Type'] === 'return';
        const isFromAirport = fields['Oneway Direction'] === 'from';
        const pickupLabel = isReturn
            ? fields['Home Address']
            : (isFromAirport ? `${fields['Airport Name'] || fields['Airport'] || 'Airport'}` : fields['Home Address']);
        const dropoffLabel = isReturn
            ? `${fields['Airport Name'] || fields['Airport'] || 'Airport'} (return after)`
            : (isFromAirport ? fields['Home Address'] : `${fields['Airport Name'] || fields['Airport'] || 'Airport'}`);

        let tripBlock = `Pickup: ${pickupLabel || '—'}\nDrop-off: ${dropoffLabel || '—'}\nOutbound: ${fmtUKDate(fields['Outbound Date'])} at ${fields['Outbound Time'] || '—'}`;
        if (isReturn && fields['Return Date']) {
            tripBlock += `\nReturn: ${fmtUKDate(fields['Return Date'])} at ${fields['Return Time'] || '—'}`;
        }
        if (fields['Outbound Flight']) tripBlock += `\nFlight: ${fields['Outbound Flight']}`;
        if (fields['Passengers'] || fields['Luggage']) tripBlock += `\nPassengers/Bags: ${fields['Passengers'] || '?'} / ${fields['Luggage'] || '?'}`;

        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nPayment received — your RM Transfers booking (${fields['Booking Ref']}) is fully confirmed.\n\n${tripBlock}\n\nWe've also emailed your full booking confirmation. View or save your booking here: https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}\n(Tip: tap the share/install icon to add a shortcut to your home screen.)\n\nYour customer support contact is Roy Medlam — call ${SUPPORT_PHONE} any time.\n\n(Please do not reply to this text)`
        });

        await sendConfirmationEmail();
    }

    if (action === 'send-confirmation') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });

        const outDate = fmtUKDate(fields['Outbound Date']);
        const outTime = fields['Outbound Time'];
        const retDate = fmtUKDate(fields['Return Date']);
        const retTime = fields['Return Time'];
        
        let tripDetails = '';
        if (fields['Trip Type'] === 'return') {
            tripDetails += `From: ${fields['Home Address']}\nTo: ${fields['Airport Name']} (Return)\nOutbound: ${outDate} at ${outTime}\nReturn: ${retDate} at ${retTime}`;
        } else {
            const isFromAirport = fields['Oneway Direction'] === 'from';
            const pickup = isFromAirport ? fields['Airport Name'] : fields['Home Address'];
            const dropoff = isFromAirport ? fields['Home Address'] : fields['Airport Name'];
            tripDetails += `From: ${pickup}\nTo: ${dropoff}\nDate: ${outDate} at ${outTime}`;
        }

        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nPayment received! Your RM Transfers booking (${fields['Booking Ref']}) is fully confirmed.\n\n${tripDetails}\n\nDriver: ${fields['Driver Name']} (${fields['Driver Phone']})\n\nWe have also sent an email with your full itinerary.${SUPPORT_LINE}\n\n(Please do not reply to this text. Text your driver directly.)`
        });

        // Also notify the driver that payment is confirmed and the job is locked in
        if (formattedDriverPhone) {
            messages.push({
                to: formattedDriverPhone,
                from: 'RMTransfers',
                body: `CONFIRMED JOB: Payment received for ${fields['Customer Name']}\nRef: ${fields['Booking Ref']}\nPickup: ${fields['Home Address']}\nDate: ${fmtUKDate(fields['Outbound Date'])} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nPassengers: ${fields['Passengers'] || '?'} Bags: ${fields['Luggage'] || '?'}\nCustomer: ${fields['Customer Phone']}\nPrice: £${fields['Total Price']}\n\nDriver Portal: https://airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
            });
        }

        await sendConfirmationEmail();
    }

    // Resend the booking-confirmation email only (no SMS). Used by the
    // operator screen when a customer asks for their details again.
    if (action === 'resend-confirmation-email') {
        if (!fields['Customer Email']) {
            return res.status(400).json({ error: 'No customer email on file' });
        }
        await sendConfirmationEmail();
        return res.status(200).json({ success: true, message: 'Confirmation email resent' });
    }

    if (action === 'resend-customer') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThis is a resent confirmation for RM Transfers booking (${fields['Booking Ref']}).\n\nYour driver is ${fields['Driver Name'] || 'not yet assigned'}.\n\nView details: https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}${SUPPORT_LINE}\n\n(Please do not reply to this text)`
        });
    }

    if (action === 'resend-driver') {
        if (!formattedDriverPhone) return res.status(400).json({ error: 'Missing driver phone' });
        messages.push({
            to: formattedDriverPhone,
            from: 'RMTransfers',
            body: `RESEND JOB: ${fields['Trip Type'] === 'return' ? 'RETURN' : 'ONE WAY'} for ${fields['Customer Name']}\nPickup: ${fields['Home Address']}\nDate: ${fmtUKDate(fields['Outbound Date'])} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nCustomer: ${fields['Customer Phone']}\nPrice: £${fields['Total Price']}\nPortal: https://airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
        });
    }

    if (action === 'driver-on-way') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nYour RM Transfers driver, ${fields['Driver Name']}, is on the way for your booking (${fields['Booking Ref']})!\n\nYou can contact them directly on ${fields['Driver Phone']}.${SUPPORT_LINE}`
        });
    }

    if (action === 'driver-arrived') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nYour RM Transfers driver, ${fields['Driver Name']}, is waiting outside.\n\nPlease come out when you are ready.${SUPPORT_LINE}`
        });
    }

    // Return-leg pickup location — driver / operator types where they
    // will meet the customer (terminal, short-stay car park, specific
    // pickup zone, etc.) and we send it through. Used INSTEAD of
    // 'driver-on-way' for return legs from the airport, where the
    // location isn't predictable.
    if (action === 'return-pickup-location') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        const location = (fields['Pickup Location'] || '').toString().trim();
        if (!location) return res.status(400).json({ error: 'Missing pickup location' });
        const driverName = fields['Driver Name'] || 'your driver';
        const driverPhone = fields['Driver Phone'] || fields['Return Driver Phone'] || '';
        const contactLine = driverPhone ? `\n\nYou can contact ${driverName} directly on ${driverPhone}.` : '';
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nFor your RM Transfers return pickup (${fields['Booking Ref']}), please meet ${driverName} at:\n\n${location}${contactLine}${SUPPORT_LINE}`
        });
    }

    if (action === 'send-review-invite') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nThank you for traveling with RM Transfers!\n\nWe hope you had a great journey. If you have a moment, we'd really appreciate it if you could leave us a review on Trustpilot:\n\nhttps://uk.trustpilot.com/review/rmtransfers.co.uk?utm_medium=trustbox&utm_source=TrustBoxReviewCollector\n\nThanks again!${SUPPORT_LINE}`
        });
    }

    if (action === 'reminder') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nFriendly reminder from RM Transfers!\n\nYour booking (${fields['Booking Ref']}) is scheduled for ${fmtUKDate(fields['Outbound Date'])} at ${fields['Outbound Time']}.\n\nYour driver will be ${fields['Driver Name'] || 'assigned shortly'}.${SUPPORT_LINE}`
        });
    }

    if (action === 'driver-reminder') {
        if (!formattedDriverPhone) return res.status(400).json({ error: 'Missing driver phone' });
        messages.push({
            to: formattedDriverPhone,
            from: 'RMTransfers',
            body: `REMINDER: Job tomorrow for ${fields['Customer Name']}\nRef: ${fields['Booking Ref']}\nPickup: ${fields['Home Address']}\nDestination: ${fields['Airport Name'] || 'See booking'}\nDate: ${fmtUKDate(fields['Outbound Date'])} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nPassengers: ${fields['Passengers'] || '?'} Bags: ${fields['Luggage'] || '?'}\nCustomer: ${fields['Customer Phone']}\n\nDriver Portal: https://airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
        });
    }

    // Combined 24-hour reminder — sends BOTH customer + driver reminders in one go (failsafe button)
    if (action === 'send-24h-reminders') {
        if (formattedCustomerPhone) {
            messages.push({
                to: formattedCustomerPhone,
                from: 'RMTransfers',
                body: `Hi ${fields['Customer Name']?.split(' ')[0] || 'Customer'},\n\nFriendly reminder from RM Transfers!\n\nYour booking (${fields['Booking Ref']}) is scheduled for ${fmtUKDate(fields['Outbound Date'])} at ${fields['Outbound Time']}.\n\nYour driver will be ${fields['Driver Name'] || 'assigned shortly'}.${SUPPORT_LINE}`
            });
        }
        if (formattedDriverPhone) {
            messages.push({
                to: formattedDriverPhone,
                from: 'RMTransfers',
                body: `REMINDER: Job tomorrow for ${fields['Customer Name']}\nRef: ${fields['Booking Ref']}\nPickup: ${fields['Home Address']}\nDestination: ${fields['Airport Name'] || 'See booking'}\nDate: ${fmtUKDate(fields['Outbound Date'])} @ ${fields['Outbound Time']}\nFlight: ${fields['Outbound Flight'] || 'N/A'}\nPassengers: ${fields['Passengers'] || '?'} Bags: ${fields['Luggage'] || '?'}\nCustomer: ${fields['Customer Phone']}\n\nDriver Portal: https://airporttaxitransfersliverpool.co.uk/driver-action.html?ref=${fields['Booking Ref']}`
            });
        }
    }

    // Post-payment customer confirmation — fired by the Stripe webhook
    // after checkout.session.completed. Contains full trip details so
    // the customer has everything in one text.
    if (action === 'send-booking-received') {
        if (!formattedCustomerPhone) return res.status(400).json({ error: 'Missing customer phone' });
        const firstName = (fields['Customer Name'] || 'Customer').split(' ')[0];
        const priceLine = fields['Quoted Price'] ? `\nTotal paid: £${fields['Quoted Price']}` : '';
        const vehicleLine = fields['Vehicle Type'] ? `\nVehicle: ${fields['Vehicle Type']}` : '';

        const isReturn = fields['Trip Type'] === 'return';
        const isFromAirport = fields['Oneway Direction'] === 'from';
        const pickupLabel = isReturn
            ? fields['Home Address']
            : (isFromAirport ? `${fields['Airport Name'] || fields['Airport'] || 'Airport'}` : fields['Home Address']);
        const dropoffLabel = isReturn
            ? `${fields['Airport Name'] || fields['Airport'] || 'Airport'} (return)`
            : (isFromAirport ? fields['Home Address'] : `${fields['Airport Name'] || fields['Airport'] || 'Airport'}`);

        let tripBlock = `Pickup: ${pickupLabel || '—'}\nDrop-off: ${dropoffLabel || '—'}\nOutbound: ${fmtUKDate(fields['Outbound Date'])} at ${fields['Outbound Time'] || '—'}`;
        if (isReturn && fields['Return Date']) {
            tripBlock += `\nReturn: ${fmtUKDate(fields['Return Date'])} at ${fields['Return Time'] || '—'}`;
        }
        if (fields['Outbound Flight']) tripBlock += `\nFlight: ${fields['Outbound Flight']}`;
        if (fields['Return Flight']) tripBlock += `\nReturn flight: ${fields['Return Flight']}`;
        if (fields['Passengers'] || fields['Luggage']) tripBlock += `\nPassengers/Bags: ${fields['Passengers'] || '?'} / ${fields['Luggage'] || '?'}`;

        messages.push({
            to: formattedCustomerPhone,
            from: 'RMTransfers',
            body: `Hi ${firstName},\n\nPayment received — your RM Transfers booking (${fields['Booking Ref']}) is fully confirmed! ✅\n\n${tripBlock}${vehicleLine}${priceLine}\n\nWe'll text you with your driver's details before your trip.\n\nView your booking: https://airporttaxitransfersliverpool.co.uk/portal.html?ref=${fields['Booking Ref']}\n\nWe've also emailed your full confirmation.${SUPPORT_LINE}\n\n(Please do not reply to this text)`
        });

        await sendConfirmationEmail();
    }

    if (action === 'new-booking-operator-alert') {
        const adminNumbers = ['+447398233859', '+447746899644'];
        const quoteLine = fields['Quoted Price'] ? `\nQuoted: £${fields['Quoted Price']}` : '';
        const vehicleLine = fields['Vehicle Type'] ? `\nVehicle: ${fields['Vehicle Type']}` : '';
        adminNumbers.forEach(num => {
            messages.push({
                to: num,
                from: 'RMTransfers',
                body: `NEW BOOKING: ${fields['Booking Ref']}\nName: ${fields['Customer Name']}\nFrom: ${fields['Home Address']}\nTo: ${fields['Airport Name']}\nType: ${fields['Trip Type']}\nPassengers: ${fields['Passengers']} Bags: ${fields['Luggage']}${vehicleLine}${quoteLine}\nPhone: ${fields['Customer Phone']}\nOpen: https://airporttaxitransfersliverpool.co.uk/admin.html?ref=${fields['Booking Ref']}`
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

        const body = await smsRes.text();
        if (!smsRes.ok) {
            console.error(`[sms] ClickSend HTTP ${smsRes.status} for action='${action}':`, body);
            return res.status(500).json({ error: 'Failed to send SMS' });
        }

        // ClickSend can return HTTP 200 with per-message failures (bad number,
        // blocked, no credit). Inspect each result so partial failures show
        // up in the logs instead of silently disappearing.
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { /* ignore */ }
        const results = parsed?.data?.messages || [];
        const failures = results.filter(m => m.status && m.status !== 'SUCCESS');
        const successes = results.filter(m => m.status === 'SUCCESS');
        console.log(`[sms] action='${action}' queued=${messages.length} success=${successes.length} fail=${failures.length}`);
        if (failures.length) {
            for (const m of failures) {
                console.error(`[sms] FAILED to=${m.to} status=${m.status} code=${m.error_code || '-'} text=${m.error_text || '-'}`);
            }
            return res.status(207).json({
                success: successes.length > 0,
                partial: true,
                results,
                error: failures.map(m => `${m.to}: ${m.status}`).join('; ')
            });
        }

        return res.status(200).json({ success: true, message: 'SMS sent successfully', count: successes.length });
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
