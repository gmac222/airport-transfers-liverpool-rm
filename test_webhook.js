const https = require('https');

const WEBHOOK_URL = 'https://gmac222.app.n8n.cloud/webhook/3c702483-e68c-428a-8c2c-429cbdf61668';

const testBooking = {
  ref: "TEST-55555",
  submittedAt: new Date().toISOString(),
  tripType: "return",
  onewayDir: "to",
  airport: "MAN",
  passengers: 4,
  luggage: 4,
  priceGBP: 120.50,
  customer: {
    name: "Sarah Jenkins",
    phone: "07398233859",
    email: "sarah.jenkins@example.co.uk",
    address: "45 Penny Lane, Liverpool, L18 1DE"
  },
  outbound: {
    date: "2026-06-10",
    time: "08:15",
    flight: "RYR456"
  },
  return: {
    date: "2026-06-20",
    time: "19:45",
    flight: "RYR457"
  },
  notes: "Need a child seat for a 4-year-old.",
  pageUrl: "https://example.com/booking"
};

const data = JSON.stringify(testBooking);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(WEBHOOK_URL, options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error submitting test booking:', error);
});

req.write(data);
req.end();
