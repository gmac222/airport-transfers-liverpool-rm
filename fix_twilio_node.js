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
    const twilioNode = workflow.nodes.find(n => n.name === 'Twilio SMS');
    if (twilioNode) {
      twilioNode.parameters = {
        resource: "sms",
        operation: "send",
        from: "+441514535296",
        to: "+447746899644",
        message: "New Booking Received! Please check Airtable for details."
      };
      
      const putData = JSON.stringify({
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings,
        name: workflow.name,
        tags: workflow.tags
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
        putRes.on('data', () => {});
        putRes.on('end', () => console.log("Successfully fixed Twilio Node parameters. Status:", putRes.statusCode));
      });
      req.write(putData);
      req.end();
    }
  });
});
