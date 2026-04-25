const https = require('https');
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";
const WORKFLOW_ID = "ymEQEImxPVac0GJx";

const options = {
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Accept': 'application/json'
  }
};

https.get(`https://gmac222.app.n8n.cloud/api/v1/workflows/${WORKFLOW_ID}`, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const workflow = JSON.parse(data);
    
    // Remove any previous Resend nodes just in case
    workflow.nodes = workflow.nodes.filter(n => !n.name.includes('Resend'));
    
    const emailHtml = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0E2747; line-height: 1.5;">
  <div style="text-align: center; padding: 20px; background: #0B1E37; border-radius: 12px 12px 0 0;">
    <img src="https://airporttaxitransfersliverpool.co.uk/assets/logo.png" alt="RM Transfers Logo" style="height: 60px; width: auto; object-fit: contain; margin: 10px 0;" />
  </div>
  <div style="padding: 30px; border: 1px solid #E8E2D4; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #0E2747; margin-top: 0;">Driver Assigned</h2>
    <p>Hi \${$json.body.customerName},</p>
    <p>Great news! Your booking (Ref: <strong>\${$json.body.bookingRef}</strong>) has been confirmed and a driver has been assigned to your trip.</p>
    
    <div style="background: rgba(31, 122, 76, 0.1); border-left: 4px solid #1f7a4c; padding: 16px; border-radius: 4px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #1f7a4c; font-size: 16px; margin-bottom: 8px;">Your Driver Details</h3>
      <p style="margin: 4px 0;"><strong>Driver Name:</strong> \${$json.body.driverName}</p>
      <p style="margin: 4px 0;"><strong>Emergency Contact:</strong> \${$json.body.driverPhone}</p>
    </div>
    
    <p>Your driver will arrive at <strong>\${$json.body.pickupAddress}</strong> at <strong>\${$json.body.outboundTime}</strong> on <strong>\${$json.body.outboundDate}</strong>.</p>
    
    <p>You can view your full itinerary and driver details on your live booking portal at any time:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="\${$json.body.portalLink}" style="background: #E6B24B; color: #0B1E37; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">View Booking Portal</a>
    </div>
    
    <p style="color: #5b6472; font-size: 14px;">Thanks,<br>The RM Transfers Team</p>
  </div>
</div>`;

    const resendNode = {
      "parameters": {
        "method": "POST",
        "url": "https://api.resend.com/emails",
        "authentication": "none",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "Bearer re_FXQGg4UN_LdgUL9U3j8jL2vhPmdpVqw8g" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { \"from\": \"bookings@airporttaxitransfersliverpool.co.uk\", \"to\": $json.body.customerEmail, \"subject\": \"Driver Assigned - RM Transfers (Liverpool)\", \"html\": `" + emailHtml.replace(/`/g, '\\`') + "` } }}",
        "options": {}
      },
      "id": "resend-driver-assigned-email",
      "name": "Resend Driver Assigned Email",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [250, 400]
    };
    
    workflow.nodes.push(resendNode);
    
    // Connect Webhook node to the new Resend node
    if (workflow.connections["Webhook"]) {
      workflow.connections["Webhook"]["main"][0].push({
        "node": "Resend Driver Assigned Email",
        "type": "main",
        "index": 0
      });
    }

    const putData = JSON.stringify({
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: {},
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
    
    const req = https.request(`https://gmac222.app.n8n.cloud/api/v1/workflows/${WORKFLOW_ID}`, putOptions, (putRes) => {
      let putResData = '';
      putRes.on('data', chunk => putResData += chunk);
      putRes.on('end', () => console.log("Added Resend Node to Accepted workflow! Status:", putRes.statusCode));
    });
    req.write(putData);
    req.end();
  });
});
