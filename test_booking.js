const https = require('https');

const ref = "TEST-" + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

const payload = JSON.stringify({
  ref: ref,
  submittedAt: new Date().toISOString(),
  tripType: "return",
  onewayDir: null,
  airport: "MAN",
  airportName: "Manchester",
  passengers: 2,
  luggage: 2,
  priceGBP: 125,
  legPriceGBP: null,
  customer: {
    name: "John Doe (Test)",
    phone: "07398233859",
    email: "graham.m.222@gmail.com",
    address: "Test Address, Liverpool L1 8JQ"
  },
  outbound: {
    date: "2026-06-01",
    "time": "14:30",
    "flight": "EZY123"
  },
  return: {
    date: "2026-06-14",
    "time": "09:15",
    "flight": "BA999"
  },
  notes: "Test booking to check flight tracking link.",
  pageUrl: "https://airporttaxitransfersliverpool.co.uk/"
});

const options = {
  hostname: 'gmac222.app.n8n.cloud',
  path: '/webhook/3c702483-e68c-428a-8c2c-429cbdf61668',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

console.log("Sending Test Booking: " + ref);

const req = https.request(options, res => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});

req.on('error', error => console.error(error));
req.write(payload);
req.end();
