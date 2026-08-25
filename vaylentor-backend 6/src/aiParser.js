/* ======================================================================
   This is the "real smart chat" piece: instead of matching a handful of
   hardcoded keywords, this sends the user's actual free text to Claude and
   asks it to extract whatever trip details are actually there — city,
   country, budget, party size, kosher, vibe, occasion, anything else they
   said in their own words. It NEVER invents facts; if something wasn't
   mentioned, the field is simply omitted.

   Setup (you already have your key if you've been following along):
     1. https://platform.claude.com -> sign in / sign up.
     2. Settings -> add a payment method (pay-as-you-go, no subscription).
     3. Settings -> API keys -> Create key -> copy it (starts with sk-ant-).
     4. Put it in .env as ANTHROPIC_API_KEY.
   Uses Haiku (the fast/cheap model) since this is a small extraction task,
   not open-ended conversation — keeps cost per message low.
====================================================================== */

const MODEL = 'claude-haiku-4-5-20251001';

const EXTRACT_TOOL = {
  name: 'extract_trip_details',
  description: 'Extract structured trip-planning details that the user actually stated or clearly implied in their message. Never invent or assume anything not present in the text.',
  input_schema: {
    type: 'object',
    properties: {
      destination_city: { type: 'string', description: 'A specific city name the user mentioned, in Hebrew if that is how they wrote it (e.g. "מילאנו", "בנגקוק"). Omit if no specific city was named.' },
      country: { type: 'string', description: 'A country name the user mentioned, in Hebrew (e.g. "איטליה"). Omit if not mentioned.' },
      budget_ils: { type: 'number', description: 'Budget in Israeli shekels, if a number was given.' },
      nights: { type: 'number', description: 'Number of nights, if stated.' },
      adults: { type: 'number', description: 'Number of adult travelers, if stated or clearly implied (e.g. "זוג" = 2).' },
      children: { type: 'number', description: 'Number of children, if mentioned.' },
      kosher: { type: 'string', enum: ['yes', 'no', 'flex'], description: 'Only set if the user actually mentioned kashrut/kosher preferences.' },
      vibes: { type: 'array', items: { type: 'string', enum: ['beach', 'culture', 'adventure', 'food', 'shopping', 'nightlife'] }, description: 'Any vacation styles clearly implied by the message.' },
      occasion: { type: 'string', enum: ['honeymoon', 'birthday', 'family', 'none'], description: 'Only set if a special occasion was actually mentioned.' },
      special_requests: { type: 'string', description: 'Anything specific the user asked for that does not fit the other fields — summarized in Hebrew, close to their own words.' },
    },
    required: [],
  },
};

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function parseUserRequest(userText) {
  if (!isConfigured()) throw new Error('anthropic_not_configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: 'You are a travel-request parser for an Israeli travel booking site. The user writes in Hebrew, sometimes with English place names mixed in. Extract only what they actually said by calling the extract_trip_details tool. Do not guess or fill in plausible-sounding values for anything they did not mention.',
      messages: [{ role: 'user', content: userText }],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'extract_trip_details' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic_request_failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('anthropic_no_tool_use_in_response');
  return toolUse.input;
}

// Merges what the AI extracted into the existing preferences object from
// the quiz — the quiz always wins if both specify the same thing (the
// person explicitly chose it there), the AI only fills in gaps.
function mergeExtractedIntoPreferences(extracted, existingPreferences) {
  const merged = Object.assign({}, existingPreferences || {});
  if (extracted.adults != null && merged.adults == null) merged.adults = extracted.adults;
  if (extracted.children != null && merged.children == null) merged.children = extracted.children;
  if ((merged.adults != null || merged.children != null) && merged.travelers == null) {
    merged.travelers = (merged.adults || 1) + (merged.children || 0);
  }
  if (extracted.kosher && !merged.kosher) merged.kosher = extracted.kosher;
  if (extracted.vibes && extracted.vibes.length && !merged.vibe) merged.vibe = extracted.vibes;
  if (extracted.occasion && !merged.occasion) merged.occasion = extracted.occasion;
  if (extracted.special_requests) merged.aiSpecialRequests = extracted.special_requests;
  return merged;
}

// Builds enriched text that gives the destination keyword-matcher in
// mockData.js/amadeusTrips.js a better shot at recognizing the place, even
// if the user phrased it in a way the keyword list wouldn't catch alone.
function buildEnrichedText(originalText, extracted) {
  const extras = [extracted.destination_city, extracted.country].filter(Boolean).join(' ');
  return extras ? `${originalText} ${extras}` : originalText;
}

module.exports = { isConfigured, parseUserRequest, mergeExtractedIntoPreferences, buildEnrichedText };
