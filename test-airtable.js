const fs = require('fs');
const https = require('https');
const envFile = fs.readFileSync('.env.production', 'utf8');
const tokenMatch = envFile.match(/AIRTABLE_PERSONAL_ACCESS_TOKEN=([^\r\n]+)/) || envFile.match(/AIRTABLE_API_KEY=([^\r\n]+)/);
const token = tokenMatch ? tokenMatch[1].replace(/["']/g, '') : null;

if (!token) {
    console.error('No token found');
    process.exit(1);
}

const options = {
  hostname: 'api.airtable.com',
  path: '/v0/appzmLNDAsk6m06Ae/Bookings?maxRecords=1',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.records && json.records.length > 0) {
        console.log(JSON.stringify(Object.keys(json.records[0].fields), null, 2));
    } else {
        console.log('No records or error:', json);
    }
  });
});
req.on('error', (e) => console.error(e));
req.end();
