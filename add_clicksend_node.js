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
    
    // Remove old Twilio node and any previous ClickSend node
    workflow.nodes = workflow.nodes.filter(n => !n.name.includes('Twilio') && !n.name.includes('ClickSend'));
    
    const clicksendOperatorNode = {
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
        "jsonBody": "={{ { \"messages\": [ { \"to\": \"+447398233859\", \"body\": \"New Booking Received! Ref: \" + $json.fields['Booking Ref'] + \"\\nAdmin: https://airporttaxitransfersliverpool.co.uk/admin.html?ref=\" + $json.fields['Booking Ref'] }, { \"to\": \"+447746899644\", \"body\": \"New Booking Received! Ref: \" + $json.fields['Booking Ref'] + \"\\nAdmin: https://airporttaxitransfersliverpool.co.uk/admin.html?ref=\" + $json.fields['Booking Ref'] } ] } }}",
        "options": {}
      },
      "id": "clicksend-operator-node",
      "name": "ClickSend Operator SMS",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [640, -100]
    };

    const clicksendCustomerNode = {
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
        "jsonBody": "={{ { \"messages\": [ { \"to\": $json.fields['Customer Phone'].replace(/\\s+/g, '').replace(/^0/, '+44'), \"body\": \"Hi \" + $json.fields['Customer Name'] + \", your Airport Transfers Liverpool booking (Ref: \" + $json.fields['Booking Ref'] + \") has been received! We will be in touch shortly to confirm.\" } ] } }}",
        "options": {}
      },
      "id": "clicksend-customer-node",
      "name": "ClickSend Customer SMS",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [640, 100]
    };
    

    
    const airtableUpdateNode = {
      "parameters": {
        "operation": "update",
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
        "id": "={{ $('Airtable').item.json.id }}",
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Initial SMS Sent": true
          },
          "matchingColumns": []
        },
        "options": {}
      },
      "id": "airtable-update-sms-node",
      "name": "Update Airtable SMS Sent",
      "type": "n8n-nodes-base.airtable",
      "typeVersion": 2,
      "position": [840, 100],
      "credentials": {
        "airtableTokenApi": {
          "id": "PAYJ8atu75xLv55R",
          "name": "Airtable PAT"
        }
      }
    };

    // Remove any old Update Airtable nodes
    workflow.nodes = workflow.nodes.filter(n => n.name !== 'Update Airtable SMS Sent');
    
    workflow.nodes.push(clicksendOperatorNode, clicksendCustomerNode, airtableUpdateNode);
    
    // Update connections
    if (workflow.connections["Airtable"]) {
      workflow.connections["Airtable"]["main"] = [[
        {
          "node": "ClickSend Operator SMS",
          "type": "main",
          "index": 0
        },
        {
          "node": "ClickSend Customer SMS",
          "type": "main",
          "index": 0
        }
      ]];
    }
    
    if (!workflow.connections["ClickSend Customer SMS"]) {
      workflow.connections["ClickSend Customer SMS"] = {};
    }
    workflow.connections["ClickSend Customer SMS"]["main"] = [[
      {
        "node": "Update Airtable SMS Sent",
        "type": "main",
        "index": 0
      }
    ]];

    const putData = JSON.stringify({
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: {},
      name: workflow.name || "Booking Webhook"
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
      putRes.on('end', () => console.log("Replaced Twilio with ClickSend! Status:", putRes.statusCode, putResData));
    });
    req.write(putData);
    req.end();
  });
});
