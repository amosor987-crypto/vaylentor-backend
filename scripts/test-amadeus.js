/* ======================================================================
   Run this after setting AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET in .env
   to see, with your own eyes, whether your credentials work and what a
   real flight + hotel search actually returns — including whether hotel
   photos come back on your account tier (this varies and isn't something
   that can be confirmed without hitting the live API).

   Usage:
     cd vaylentor-backend
     node scripts/test-amadeus.js
====================================================================== */
require('dotenv').config();
const { amadeusGet, isConfigured, BASE_URL } = require('../src/amadeus');

async function main() {
  console.log('Amadeus environment:', BASE_URL);
  if (!isConfigured()) {
    console.error('\n❌ AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET are not set in .env — nothing to test yet.');
    process.exit(1);
  }

  console.log('\n1) Requesting an access token (OAuth2 client_credentials)...');
  try {
    const { getAccessToken } = require('../src/amadeus');
    const token = await getAccessToken();
    console.log('✅ Got a token:', token.slice(0, 12) + '… (truncated)');
  } catch (err) {
    console.error('❌ Could not get a token:', err.message);
    console.error('   Double-check the API Key/Secret were copied correctly from');
    console.error('   My Self-Service Workspace, and that there are no extra spaces.');
    process.exit(1);
  }

  const depDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const retDate = new Date(Date.now() + 52 * 86400000).toISOString().slice(0, 10);

  console.log(`\n2) Searching flights TLV → JTR (Santorini) for ${depDate} / ${retDate}...`);
  try {
    const flightData = await amadeusGet('/v2/shopping/flight-offers', {
      originLocationCode: 'TLV',
      destinationLocationCode: 'JTR',
      departureDate: depDate,
      returnDate: retDate,
      adults: 2,
      max: 2,
      currencyCode: 'ILS',
    });
    const count = flightData?.data?.length || 0;
    console.log(`✅ Got ${count} flight offer(s).`);
    if (count > 0) {
      console.log('   First offer price:', flightData.data[0].price?.total, flightData.data[0].price?.currency);
      console.log('   Raw first offer (trimmed) — inspect this to see the real shape:');
      console.log(JSON.stringify(flightData.data[0], null, 2).slice(0, 1200));
    } else {
      console.log('   (No test-environment data for this exact route today — try a different');
      console.log('    destination/date, or check developers.amadeus.com for which routes');
      console.log('    the sandbox currently has fixtures for.)');
    }
  } catch (err) {
    console.error('❌ Flight search failed:', err.message);
  }

  console.log('\n3) Looking up hotels in Santorini (cityCode JTR)...');
  try {
    const listData = await amadeusGet('/v1/reference-data/locations/hotels/by-city', { cityCode: 'JTR' });
    const hotelCount = listData?.data?.length || 0;
    console.log(`✅ Found ${hotelCount} hotel(s) listed for this city code.`);
    if (hotelCount > 0) {
      const sampleIds = listData.data.slice(0, 3).map((h) => h.hotelId);
      console.log('   Sample hotel IDs:', sampleIds.join(', '));

      console.log('\n4) Getting live offers (price + whatever media is included) for those hotels...');
      const offersData = await amadeusGet('/v3/shopping/hotel-offers', {
        hotelIds: sampleIds.join(','),
        adults: 2,
        checkInDate: depDate,
        checkOutDate: retDate,
      });
      const offerCount = offersData?.data?.length || 0;
      console.log(`✅ Got ${offerCount} hotel offer(s).`);
      if (offerCount > 0) {
        const first = offersData.data[0];
        console.log('   Hotel name:', first?.hotel?.name);
        console.log('   Price:', first?.offers?.[0]?.price?.total, first?.offers?.[0]?.price?.currency);
        const hasPhoto = Boolean(first?.hotel?.media?.[0]?.uri);
        console.log(`   Photo included on this response? ${hasPhoto ? 'YES → ' + first.hotel.media[0].uri : 'NO (expected on the free self-service tier for many accounts — the site will keep using its illustrated scenes for this hotel)'}`);
      }
    } else {
      console.log('   (No test-environment hotels for this city code today — try a different city.)');
    }
  } catch (err) {
    console.error('❌ Hotel lookup failed:', err.message);
  }

  console.log('\nDone. If steps 1-2 succeeded, your credentials work and /api/trips/plan');
  console.log('will start using real flight (and hotel, where available) data automatically.');
}

main();
