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
                    if(node.name === "ClickSend Confirmation SMS" || node.name === "ClickSend SMS") {
                        let body = node.parameters.jsonBody;
                        if (!body.includes('Please do not reply')) {
                            // Find the spot before the end of the string
                            body = body.replace(
                                "} ] } }}",
                                "\\n\\n(Please do not reply to this automated text. If you have any changes, please call or text your driver directly.)\" } ] } }}"
                            );
                            node.parameters.jsonBody = body;
                            console.log("Patched node:", node.name);
                        }
                    }
                });
                
                const putOptions = {
                    method: 'PUT',
                    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }
                };
                const req = https.request(`https://gmac222.app.n8n.cloud/api/v1/workflows/${id}`, putOptions, (res2) => {
                    console.log(`Update ${id} status:`, res2.statusCode);
                });
                
                req.write(JSON.stringify({
                    name: wf.name,
                    nodes: wf.nodes,
                    connections: wf.connections,
                    settings: wf.settings || {}
                }));
                req.end();
            }
        });
    });
}

// Accept Booking Webhook Workflow
patchWorkflow("ymEQEImxPVac0GJx");
// Initial Webhook Workflow
patchWorkflow("3c702483-e68c-428a-8c2c-429cbdf61668");
