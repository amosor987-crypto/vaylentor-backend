/* ======================================================================
   Run this after setting GOOGLE_PLACES_API_KEY in .env to see, with your
   own eyes, whether it works and what a real photo lookup actually returns.

   Usage:
     cd vaylentor-backend
     node scripts/test-places.js
====================================================================== */
require('dotenv').config();
const { isConfigured, findPlacePhoto } = require('../src/googlePlaces');

async function main() {
  if (!isConfigured()) {
    console.error('❌ GOOGLE_PLACES_API_KEY is not set in .env — nothing to test yet.');
    console.error('   See src/googlePlaces.js for the 5-step setup (needs Google Cloud billing enabled).');
    process.exit(1);
  }

  const testCases = [
    { name: 'Katikies Santorini', hint: 'Oia, Santorini, Greece', why: 'a real, well-known hotel — should find a photo easily' },
    { name: 'This Hotel Definitely Does Not Exist 12345', hint: 'Nowhere', why: 'a made-up name — proves the "no result found" path is handled gracefully' },
  ];

  for (const t of testCases) {
    console.log(`\nSearching: "${t.name}" (${t.hint}) — ${t.why}`);
    try {
      const result = await findPlacePhoto(t.name, t.hint);
      if (result) {
        console.log('✅ Found:');
        console.log('   Matched place name:', result.placeName);
        console.log('   Address:', result.address);
        console.log('   Photo URL:', result.photoUrl);
        console.log('   Attribution:', result.attribution || '(none provided)');
        console.log('   -> Open the Photo URL above in your browser to confirm it\'s a real photo.');
      } else {
        console.log('ℹ️  No result / no photo found for this query (expected for the made-up name test case).');
      }
    } catch (err) {
      console.error('❌ Request failed:', err.message);
      console.error('   Common causes: billing not enabled on the Google Cloud project, "Places API (New)"');
      console.error('   not enabled in APIs & Services -> Library, or the API key is restricted to the wrong API.');
    }
  }

  console.log('\nDone. If the first test case returned a real photo URL, your setup works —');
  console.log('the Amadeus integration (src/providers/amadeusTrips.js) will now automatically');
  console.log('use this to fill in hotel photos whenever Amadeus itself doesn\'t provide one.');
}

main();
