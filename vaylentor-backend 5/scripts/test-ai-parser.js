/* ======================================================================
   Run this after setting ANTHROPIC_API_KEY in .env to see, with your own
   eyes, whether it works and how well it understands a real message.

   Usage:
     cd vaylentor-backend
     node scripts/test-ai-parser.js
====================================================================== */
require('dotenv').config();
const { isConfigured, parseUserRequest } = require('../src/aiParser');

async function main() {
  if (!isConfigured()) {
    console.error('❌ ANTHROPIC_API_KEY is not set in .env — nothing to test yet.');
    process.exit(1);
  }

  const testMessages = [
    'אנחנו זוג, רוצים לטוס למילאנו לשבוע, יש לנו בערך 8000 שקל, ואנחנו שומרים כשרות',
    'משפחה עם 3 ילדים רוצה חופשת קזינו ברומניה, יום הולדת של אבא',
    'רק תגידו לי משהו נחמד באירופה, לא משנה מה',
  ];

  for (const msg of testMessages) {
    console.log(`\nMessage: "${msg}"`);
    try {
      const result = await parseUserRequest(msg);
      console.log('✅ Extracted:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('❌ Request failed:', err.message);
      console.error('   Common causes: no payment method on the Anthropic account yet,');
      console.error('   or the key was copied with extra whitespace.');
    }
  }

  console.log('\nDone. If real JSON came back for each message above, your setup works —');
  console.log('/api/trips/plan will now use this automatically to understand free-text');
  console.log('requests instead of relying only on the fixed keyword list.');
}

main();
