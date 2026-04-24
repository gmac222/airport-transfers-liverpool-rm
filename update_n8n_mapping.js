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
    const editFieldsNode = workflow.nodes.find(n => n.name === 'Edit Fields');
    if (editFieldsNode) {
      editFieldsNode.parameters = {
        "assignments": {
          "assignments": [
            { "id": "1", "name": "Booking Ref", "value": "={{ $json.body.ref }}", "type": "string" },
            { "id": "2", "name": "Submitted At", "value": "={{ $json.body.submittedAt }}", "type": "string" },
            { "id": "3", "name": "Trip Type", "value": "={{ $json.body.tripType }}", "type": "string" },
            { "id": "4", "name": "Oneway Direction", "value": "={{ $json.body.onewayDir }}", "type": "string" },
            { "id": "5", "name": "Airport", "value": "={{ $json.body.airport }}", "type": "string" },
            { "id": "6", "name": "Passengers", "value": "={{ $json.body.passengers }}", "type": "number" },
            { "id": "7", "name": "Luggage", "value": "={{ $json.body.luggage }}", "type": "number" },
            { "id": "8", "name": "Total Price", "value": "={{ $json.body.priceGBP }}", "type": "number" },
            { "id": "9", "name": "Customer Name", "value": "={{ $json.body.customer?.name }}", "type": "string" },
            { "id": "10", "name": "Customer Phone", "value": "={{ $json.body.customer?.phone }}", "type": "string" },
            { "id": "11", "name": "Customer Email", "value": "={{ $json.body.customer?.email }}", "type": "string" },
            { "id": "12", "name": "Home Address", "value": "={{ $json.body.customer?.address }}", "type": "string" },
            { "id": "13", "name": "Outbound Date", "value": "={{ $json.body.outbound?.date }}", "type": "string" },
            { "id": "14", "name": "Outbound Time", "value": "={{ $json.body.outbound?.time }}", "type": "string" },
            { "id": "15", "name": "Outbound Flight", "value": "={{ $json.body.outbound?.flight }}", "type": "string" },
            { "id": "16", "name": "Return Date", "value": "={{ $json.body.return?.date }}", "type": "string" },
            { "id": "17", "name": "Return Time", "value": "={{ $json.body.return?.time }}", "type": "string" },
            { "id": "18", "name": "Return Flight", "value": "={{ $json.body.return?.flight }}", "type": "string" },
            { "id": "19", "name": "Notes", "value": "={{ $json.body.notes }}", "type": "string" },
            { "id": "20", "name": "Page URL", "value": "={{ $json.body.pageUrl }}", "type": "string" }
          ]
        },
        "options": {}
      };
    }
    
    const airtableNode = workflow.nodes.find(n => n.name === 'Airtable');
    if (airtableNode) {
      airtableNode.parameters.resource = "record";
      airtableNode.parameters.operation = "create";
      airtableNode.parameters.columns = {
        "mappingMode": "defineBelow",
        "value": {
          "Booking Ref": "={{ $json[\"Booking Ref\"] }}",
          "Submitted At": "={{ $json[\"Submitted At\"] }}",
          "Trip Type": "={{ $json[\"Trip Type\"] }}",
          "Oneway Direction": "={{ $json[\"Oneway Direction\"] }}",
          "Airport": "={{ $json[\"Airport\"] }}",
          "Passengers": "={{ $json[\"Passengers\"] }}",
          "Luggage": "={{ $json[\"Luggage\"] }}",
          "Total Price": "={{ $json[\"Total Price\"] }}",
          "Customer Name": "={{ $json[\"Customer Name\"] }}",
          "Customer Phone": "={{ $json[\"Customer Phone\"] }}",
          "Customer Email": "={{ $json[\"Customer Email\"] }}",
          "Home Address": "={{ $json[\"Home Address\"] }}",
          "Outbound Date": "={{ $json[\"Outbound Date\"] }}",
          "Outbound Time": "={{ $json[\"Outbound Time\"] }}",
          "Outbound Flight": "={{ $json[\"Outbound Flight\"] }}",
          "Return Date": "={{ $json[\"Return Date\"] }}",
          "Return Time": "={{ $json[\"Return Time\"] }}",
          "Return Flight": "={{ $json[\"Return Flight\"] }}",
          "Notes": "={{ $json[\"Notes\"] }}",
          "Page URL": "={{ $json[\"Page URL\"] }}"
        }
      };
      
      const putData = JSON.stringify({
        name: workflow.name || "Airtable Booking Flow",
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
    } else {
      console.log('Airtable node not found.');
    }
  });
});
