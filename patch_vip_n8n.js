const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";
const WORKFLOW_ID = "3c702483-e68c-428a-8c2c-429cbdf61668";

async function patchAirtableNode() {
    const getOptions = {
        method: 'GET',
        headers: { 'X-N8N-API-KEY': API_KEY }
    };
    
    https.get(`https://gmac222.app.n8n.cloud/api/v1/workflows/${WORKFLOW_ID}`, getOptions, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const wf = JSON.parse(data);
            if(wf.nodes) {
                wf.nodes.forEach(node => {
                    if(node.name === "Set") {
                        // The Set node flattens the webhook payload for Airtable
                        // We need to add VIP Upgrades
                        let hasVip = false;
                        for (const val of node.parameters.values.string) {
                            if (val.name === "VIP Upgrades") hasVip = true;
                        }
                        if (!hasVip) {
                            node.parameters.values.string.push({
                                "name": "VIP Upgrades",
                                "value": "={{ $json.body.vipUpgrades || '' }}"
                            });
                        }
                    }
                });
                
                const putOptions = {
                    method: 'PUT',
                    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }
                };
                const req = https.request(`https://gmac222.app.n8n.cloud/api/v1/workflows/${WORKFLOW_ID}`, putOptions, (res2) => {
                    console.log(`Update ${WORKFLOW_ID} status:`, res2.statusCode);
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

patchAirtableNode();
