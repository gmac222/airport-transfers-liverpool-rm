// Diagnostic-only endpoint. POST /api/test-sms with { to } to send a
// canned ASCII SMS via ClickSend and get the raw response back in the
// HTTP response. Used to verify the auth + body shape are correct
// when the real flow is silently failing.
//
// Remove this once the SMS issue is resolved.

const CLICKSEND_AUTH = 'Basic Z3JhaGFtLm0uMjIyQGdtYWlsLmNvbTo2MzREMTAyQi0zMDRFLUI0QTUtQUQzQS1COTRFNDk1QjQ1OEM=';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const to = (req.body && req.body.to) || '+447398233859';

    const payload = {
        messages: [
            { to, from: 'RMTransfers', body: 'RM Transfers diagnostic ping. Reply ignored.' }
        ]
    };

    try {
        const r = await fetch('https://rest.clicksend.com/v3/sms/send', {
            method: 'POST',
            headers: {
                'Authorization': CLICKSEND_AUTH,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const status = r.status;
        const text = await r.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        return res.status(200).json({ ok: r.ok, status, response: json || text });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message, stack: err.stack });
    }
};
