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
    
    // Check if Airtable node already exists
    if (!workflow.nodes.find(n => n.name === 'Airtable')) {
      const airtableNode = {
        "parameters": {
          "operation": "append",
          "base": {
            "__rl": true,
            "value": "appzmLNDAsk6m06Ae",
            "mode": "id",
            "__alias": "Airport Transfers Liverpool"
          },
          "table": {
            "__rl": true,
            "value": "tblAIQuXsh9MPtsSC",
            "mode": "id",
            "__alias": "Bookings"
          },
          "columns": {
            "mappingMode": "defineBelow",
            "value": {
              "Booking Ref": "={{ $json.ref }}",
              "Submitted At": "={{ $json.submittedAt }}",
              "Trip Type": "={{ $json.tripType }}",
              "Oneway Direction": "={{ $json.onewayDir }}",
              "Airport": "={{ $json.airport }}",
              "Passengers": "={{ $json.passengers }}",
              "Luggage": "={{ $json.luggage }}",
              "Total Price": "={{ $json.priceGBP }}",
              "Customer Name": "={{ $json.customer.name }}",
              "Customer Phone": "={{ $json.customer.phone }}",
              "Customer Email": "={{ $json.customer.email }}",
              "Home Address": "={{ $json.customer.address }}",
              "Outbound Date": "={{ $json.outbound.date }}",
              "Outbound Time": "={{ $json.outbound.time }}",
              "Outbound Flight": "={{ $json.outbound.flight }}",
              "Return Date": "={{ $json.return.date }}",
              "Return Time": "={{ $json.return.time }}",
              "Return Flight": "={{ $json.return.flight }}",
              "Notes": "={{ $json.notes }}",
              "Page URL": "={{ $json.pageUrl }}"
            }
          },
          "options": {}
        },
        "id": "e67b2d5d-c692-4d0f-a316-9dc9bb1bc75d",
        "name": "Airtable",
        "type": "n8n-nodes-base.airtable",
        "typeVersion": 2,
        "position": [
          420,
          0
        ]
      };
      
      workflow.nodes.push(airtableNode);
      
      if (!workflow.connections["Edit Fields"]) {
        workflow.connections["Edit Fields"] = { "main": [[]] };
      }
      workflow.connections["Edit Fields"]["main"][0].push({
        "node": "Airtable",
        "type": "main",
        "index": 0
      });
      
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
    } else {
      console.log('Airtable node already exists.');
    }
  });
});
