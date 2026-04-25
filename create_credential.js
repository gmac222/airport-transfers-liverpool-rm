const https = require('https');
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYWZhYmYzNS1lMjY4LTRlZTUtYjQwOC1iZmI5Y2Q2MTJkODIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYzczZWE2YTAtZmE1Zi00OTU5LThmYzEtZWJhM2M0ZGNmNzAwIiwiaWF0IjoxNzc3MDUwNjQ5fQ.-iLY_6Xw5qCR1oZdj4TXUOFVQVEAhsfIOolsrAr3OFA";

const postData = JSON.stringify({
  name: "ClickSend Account",
  type: "httpBasicAuth",
  data: {
    user: "graham.m.222@gmail.com",
    password: "634D102B-304E-B4A5-AD3A-B94E495B458C"
  }
});

const options = {
  hostname: 'gmac222.app.n8n.cloud',
  path: '/api/v1/credentials',
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});
req.write(postData);
req.end();
