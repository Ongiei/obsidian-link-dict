const https = require('https');

const BASE_URL = 'api.frdic.com';
const TOKEN = 'NIS 9vQelikj4oQWIIQ1fVdFaD1k5kUhbTIwPObU+Ee6VgAo4vL95oD58g==';

function fetchWord(word) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/api/open/v1/studylist/word?language=en&word=${encodeURIComponent(word)}`,
      method: 'GET',
      headers: {
        'Authorization': TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n=== ${word} ===`);
        console.log('Status:', res.statusCode);
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Raw:', data);
        }
        resolve(data);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!TOKEN) {
    console.error('Error: Set EUDIC_TOKEN environment variable');
    console.error('Usage: EUDIC_TOKEN="your_token" node test-api.js');
    process.exit(1);
  }

  await fetchWord('set');
  await fetchWord('clear');
}

main();