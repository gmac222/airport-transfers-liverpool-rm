const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";
const WORKFLOW_ID = "E0sHFHX850tQffIk";
const API_URL = `https://gmac222.app.n8n.cloud/api/v1/workflows/${WORKFLOW_ID}`;

const options = {
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Accept': 'application/json'
  }
};

https.get(API_URL, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const workflow = JSON.parse(data);
    
    // Check if Twilio node already exists
    let twilioNode = workflow.nodes.find(n => n.name === 'Twilio SMS');
    
    if (!twilioNode) {
      twilioNode = {
        "parameters": {
          "resource": "sms",
          "operation": "send",
          "from": "",
          "to": "+447746899644",
          "message": "New Booking: {{$json[\"Customer Name\"]}} to {{$json[\"Airport\"]}}. Ref: {{$json[\"Booking Ref\"]}}"
        },
        "id": "twilio-node-id-12345",
        "name": "Twilio SMS",
        "type": "n8n-nodes-base.twilio",
        "typeVersion": 1,
        "position": [
          640,
          0
        ]
      };
      workflow.nodes.push(twilioNode);
    }
    
    // Connect Airtable to Twilio
    if (!workflow.connections["Airtable"]) {
      workflow.connections["Airtable"] = { "main": [[]] };
    }
    
    // Make sure we don't duplicate the connection
    const airtableConnections = workflow.connections["Airtable"]["main"][0];
    const hasConnection = airtableConnections.find(c => c.node === 'Twilio SMS');
    if (!hasConnection) {
      airtableConnections.push({
        "node": "Twilio SMS",
        "type": "main",
        "index": 0
      });
    }

    const putData = JSON.stringify({
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: {
        executionOrder: "v1"
      }
    });
    
    const putOptions = {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putData)
      }
    };
    
    const req = https.request(API_URL, putOptions, (putRes) => {
      let putResData = '';
      putRes.on('data', chunk => putResData += chunk);
      putRes.on('end', () => {
        console.log(`Status: ${putRes.statusCode}`);
        console.log(putResData);
      });
    });
    
    req.write(putData);
    req.end();
  });
});
