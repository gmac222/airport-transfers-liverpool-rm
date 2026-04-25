const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";

async function patchWorkflow(id) {
    const getOptions = {
        method: 'GET',
        headers: { 'X-N8N-API-KEY': API_KEY }
    };
    
    https.get(`https://gmac222.app.n8n.cloud/api/v1/workflows/${id}`, getOptions, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const wf = JSON.parse(data);
            if(wf.nodes) {
                wf.nodes.forEach(node => {
                    if(node.name === "Send Driver SMS" || node.name === "ClickSend Driver SMS") {
                        let body = node.parameters.jsonBody;
                        // Inject flight tracking if we haven't already
                        if (!body.includes('flightradar24')) {
                            // Find the spot before "Tap here when you're on the way"
                            // Or append if it's the assignment SMS
                            if (body.includes("Tap here when you're on the way")) {
                                body = body.replace(
                                    "Tap here when you're on the way", 
                                    "\" + ($json.fields['Outbound Flight'] ? \"\\n\\nTrack Flight: https://flightradar24.com/data/flights/\" + $json.fields['Outbound Flight'].replace(/\\s/g, '').toLowerCase() + \"\\n\\n\" : \"\\n\\n\") + \"Tap here when you're on the way"
                                );
                            } else if (node.name === "ClickSend Driver SMS") {
                                body = "={{ { \"messages\": [ { \"to\": $json.body.driverPhone.replace(/\\s+/g, '').replace(/^0/, '+44'), \"body\": \"New Job Assigned! Ref: \" + $json.body.bookingRef + \". Pickup: \" + $json.body.pickupAddress + \" at \" + $json.body.outboundTime + \" on \" + $json.body.outboundDate + \".\" + ($json.body.outboundFlight ? \"\\n\\nTrack Flight: https://flightradar24.com/data/flights/\" + $json.body.outboundFlight.replace(/\\s/g, '').toLowerCase() : \"\") } ] } }}";
                            }
                            node.parameters.jsonBody = body;
                            console.log("Patched node:", node.name);
                        }
                    }
                });
                
                // Save it back
                const putOptions = {
                    method: 'PUT',
                    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }
                };
                const req = https.request(`https://gmac222.app.n8n.cloud/api/v1/workflows/${id}`, putOptions, (res2) => {
                    let d = '';
                    res2.on('data', c => d+=c);
                    res2.on('end', () => console.log(`Update ${id} status:`, res2.statusCode, d));
                });
                
                const payload = {
                    name: wf.name,
                    nodes: wf.nodes,
                    connections: wf.connections,
                    settings: wf.settings || {}
                };
                
                req.write(JSON.stringify(payload));
                req.end();
            }
        });
    });
}

// 1. Reminder Workflow
patchWorkflow("r9DHDC3ZrFwy70pw");
// 2. Accept Booking Workflow (Need ID)
patchWorkflow("ymEQEImxPVac0GJx");

