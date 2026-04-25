const https = require('https');
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";
const WORKFLOW_ID = "E0sHFHX850tQffIk";

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
    <h1 style="color: #E6B24B; margin: 0; font-size: 24px;">Airport Transfers Liverpool</h1>
  </div>
  <div style="padding: 30px; border: 1px solid #E8E2D4; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #0E2747; margin-top: 0;">Booking Received!</h2>
    <p>Hi {{$json.fields['Customer Name']}},</p>
    <p>Thank you for booking with Airport Transfers Liverpool. We have received your booking request and our team is currently reviewing it to assign one of our professional drivers.</p>
    
    <div style="background: #FAF7F2; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #E8E2D4;">
      <h3 style="margin-top: 0; color: #E6B24B; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Trip Summary</h3>
      <p style="margin: 8px 0;"><strong>Booking Reference:</strong> {{$json.fields['Booking Ref']}}</p>
      <p style="margin: 8px 0;"><strong>Pickup Location:</strong> {{$json.fields['Home Address']}}</p>
      <p style="margin: 8px 0;"><strong>Destination:</strong> {{$json.fields['Airport']}}</p>
      <p style="margin: 8px 0;"><strong>Date & Time:</strong> {{$json.fields['Outbound Date']}} at {{$json.fields['Outbound Time']}}</p>
      <p style="margin: 8px 0;"><strong>Passengers:</strong> {{$json.fields['Passengers']}}</p>
    </div>
    
    <p>You can track the live status of your booking at any time via your personal tracking portal:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://airporttaxitransfersliverpool.co.uk/portal.html?ref={{$json.fields['Booking Ref']}}" style="background: #E6B24B; color: #0B1E37; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">View Booking Portal</a>
    </div>
    
    <p>We will send you another notification (SMS & Email) as soon as your driver is confirmed.</p>
    <p style="color: #5b6472; font-size: 14px;">Thanks,<br>The Airport Transfers Liverpool Team</p>
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
        "jsonBody": "={{ { \"from\": \"bookings@airporttaxitransfersliverpool.co.uk\", \"to\": $json.fields['Customer Email'], \"subject\": \"Booking Received - Airport Transfers Liverpool\", \"html\": `" + emailHtml.replace(/`/g, '\\`') + "` } }}",
        "options": {}
      },
      "id": "resend-customer-email",
      "name": "Resend Customer Email",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [640, 300]
    };
    
    workflow.nodes.push(resendNode);
    
    // Connect Airtable node to the new Resend node
    if (workflow.connections["Airtable"]) {
      workflow.connections["Airtable"]["main"][0].push({
        "node": "Resend Customer Email",
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
      putRes.on('end', () => console.log("Added Resend Node! Status:", putRes.statusCode, putResData));
    });
    req.write(putData);
    req.end();
  });
});
