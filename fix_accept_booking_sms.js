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
    
    // Update ClickSend Confirmation SMS (Customer)
    const customerNode = workflow.nodes.find(n => n.name === 'ClickSend Confirmation SMS');
    if (customerNode) {
        customerNode.parameters.jsonBody = "={{ { \"messages\": [ { \"to\": $json.body.customerPhone.replace(/\\s+/g, '').replace(/^0/, '+44'), \"body\": \"Great news! Your booking (Ref: \" + $json.body.bookingRef + \") is confirmed. Your driver will be \" + $json.body.driverName + \" (Phone: \" + $json.body.driverPhone + \" for emergencies). View your trip details here: \" + $json.body.portalLink } ] } }}";
    }

    // Update ClickSend Driver SMS
    const driverNode = workflow.nodes.find(n => n.name === 'ClickSend Driver SMS');
    if (driverNode) {
        driverNode.parameters.jsonBody = "={{ { \"messages\": [ { \"to\": $json.body.driverPhone.replace(/\\s+/g, '').replace(/^0/, '+44'), \"body\": \"New Job Assigned! Ref: \" + $json.body.bookingRef + \". Pickup: \" + $json.body.pickupAddress + \" at \" + $json.body.outboundTime + \" on \" + $json.body.outboundDate + \".\" } ] } }}";
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
      putRes.on('end', () => console.log("Fixed Accept Booking SMS formatting! Status:", putRes.statusCode, putResData));
    });
    req.write(putData);
    req.end();
  });
});
