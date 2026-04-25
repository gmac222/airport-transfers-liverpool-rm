const https = require('https');

const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";
const WORKFLOW_ID = "ymEQEImxPVac0GJx";
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
    
    // Check if Driver SMS node already exists
    if (workflow.nodes.find(n => n.name === 'ClickSend Driver SMS')) {
      console.log('Driver SMS node already exists');
    } else {
      const clicksendDriverNode = {
        "parameters": {
          "method": "POST",
          "url": "https://rest.clicksend.com/v3/sms/send",
          "authentication": "none",
          "sendHeaders": true,
          "headerParameters": {
            "parameters": [
              { "name": "Authorization", "value": "Basic Z3JhaGFtLm0uMjIyQGdtYWlsLmNvbTo2MzREMTAyQi0zMDRFLUI0QTUtQUQzQS1COTRFNDk1QjQ1OEM=" },
              { "name": "Content-Type", "value": "application/json" }
            ]
          },
          "sendBody": true,
          "specifyBody": "json",
          "jsonBody": "={{ { \"messages\": [ { \"to\": $json.body.driverPhone, \"body\": \"New Job Assigned! Ref: \" + $json.body.bookingRef + \". Pickup: \" + $json.body.pickupAddress + \" at \" + $json.body.outboundTime + \" on \" + $json.body.outboundDate + \".\" } ] } }}",
          "options": {}
        },
        "id": "clicksend-driver-node",
        "name": "ClickSend Driver SMS",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1,
        "position": [250, 200]
      };
      
      workflow.nodes.push(clicksendDriverNode);
      
      // Update connections: Webhook -> ClickSend Driver SMS
      if (workflow.connections["Webhook"]) {
        if (!workflow.connections["Webhook"]["main"]) {
          workflow.connections["Webhook"]["main"] = [[]];
        }
        workflow.connections["Webhook"]["main"][0].push({
          "node": "ClickSend Driver SMS",
          "type": "main",
          "index": 0
        });
      }
      
      const putData = JSON.stringify({
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings,
        name: workflow.name
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
        putRes.on('end', () => console.log("Added Driver SMS! Status:", putRes.statusCode, putResData));
      });
      req.write(putData);
      req.end();
    }
  });
});
