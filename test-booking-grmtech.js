const payload = {
  ref: "ATL-TEST003",
  submittedAt: new Date().toISOString(),
  tripType: "return",
  onewayDir: null,
  airport: "LJLA",
  airportName: "Liverpool John Lennon",
  passengers: 2,
  luggage: 2,
  source: "website_v2",
  customer: {
    name: "Test Customer",
    phone: "07724656757",
    email: "grmtech222@gmail.com",
    address: "14 Wellington Rd, Heswall CH60"
  },
  outbound: {
    date: "2026-05-10",
    time: "10:00",
    flight: "EZY1234"
  },
  return: {
    date: "2026-05-17",
    time: "14:00",
    flight: "EZY5678"
  },
  notes: "Test booking from assistant",
  pageUrl: "https://airporttaxitransfersliverpool.co.uk/"
};

fetch("https://gmac222.app.n8n.cloud/webhook/3c702483-e68c-428a-8c2c-429cbdf61668", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
