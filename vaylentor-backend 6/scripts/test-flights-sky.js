/* ======================================================================
   Run this after setting RAPIDAPI_KEY in .env to see, with your own eyes,
   whether the key works and what a real flight search actually returns.

   IMPORTANT: this specific provider (src/providers/flightsSkyTrips.js)
   was written without direct access to live API documentation — the
   field names it expects (price.raw, legs[0].carriers.marketing[0].name,
   etc.) are a best guess based on how this family of RapidAPI travel
   wrappers is commonly shaped. This script prints the RAW response so
   you can compare it against what the code expects and tell me what
   needs to change if anything doesn't match.

   Usage:
     cd vaylentor-backend
     node scripts/test-flights-sky.js
====================================================================== */
require('dotenv').config();
const https = require('https');

const RAPIDAPI_HOST = 'flights-sky.p.rapidapi.com';

function rapidApiGet(path, params) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const options = {
      method: 'GET',
      hostname: RAPIDAPI_HOST,
      path: `${path}?${query}`,
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!process.env.RAPIDAPI_KEY) {
    console.error('❌ RAPIDAPI_KEY is not set in .env — nothing to test yet.');
    console.error('   Copy the X-RapidAPI-Key value shown on the "Flights Scraper Sky"');
    console.error('   page on rapidapi.com into .env as RAPIDAPI_KEY=...');
    process.exit(1);
  }

  console.log('Using RapidAPI key:', process.env.RAPIDAPI_KEY.slice(0, 10) + '… (truncated)');

  const depDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const retDate = new Date(Date.now() + 52 * 86400000).toISOString().slice(0, 10);

  console.log(`\n1) Searching flights TLV → JTR (Santorini) for ${depDate} / ${retDate}...`);
  console.log('   (This first call also tells us if the endpoint path/params below are even right.)');
  try {
    const { status, body } = await rapidApiGet('/api/v1/flights/searchFlights', {
      originSkyId: 'TLV',
      destinationSkyId: 'JTR',
      date: depDate,
      returnDate: retDate,
      adults: 2,
      currency: 'ILS',
      market: 'he-IL',
      countryCode: 'IL',
    });
    console.log(`   HTTP status: ${status}`);
    if (status >= 400) {
      console.log('❌ Request failed. Raw response (this usually explains why):');
      console.log(body.slice(0, 1000));
      console.log('\n   Common causes: wrong endpoint path, a required param this API');
      console.log('   calls something different, or the free tier not including this');
      console.log('   endpoint. Check the "Params" and "Endpoints" tabs on the RapidAPI');
      console.log('   page and tell Claude exactly what you see — the code will get updated.');
    } else {
      console.log('✅ Got a response. RAW output (compare this against what');
      console.log('   src/providers/flightsSkyTrips.js expects):');
      console.log(body.slice(0, 2000));
    }
  } catch (err) {
    console.error('❌ Request errored:', err.message);
  }

  console.log('\nDone. Paste the raw output above back to Claude if the field names');
  console.log('need adjusting in src/providers/flightsSkyTrips.js.');
}

main();
