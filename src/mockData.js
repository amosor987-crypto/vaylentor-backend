const { v4: uuidv4 } = require('uuid');

/* ======================================================================
   This module is the fallback data source for /api/trips/plan. It must
   stay shape-compatible with the frontend's own local buildPackages() in
   vaylentor.html, since the frontend renders whichever one answers first
   with the exact same code path. If you change fields here, mirror the
   change in the frontend's MOCK DATA LAYER section too.

   Once src/providers/amadeusTrips.js succeeds, THAT is used instead — this
   file is only the fallback when Amadeus isn't configured or fails.
====================================================================== */

const DEST_LIB = {
  greece: {
    label: 'סנטוריני, יוון', code: 'JTR',
    hotel: ['Aegean Blue Suites', 'Caldera View Villas', 'Oia Cliffside Hotel'],
    nearbyCities: ['אתונה, יוון', 'מיקונוס, יוון', 'הרקליון כרתים, יוון'],
    airlines: [
      { name: 'אל על', priceDelta: 0, out: { num: 'LY 954', dep: '11:20', arr: '15:05', dur: '3ש\' 45ד\' ישיר' }, ret: { num: 'LY 955', dep: '16:40', arr: '19:55', dur: '3ש\' 15ד\' ישיר' } },
      { name: 'ארקיע', priceDelta: -200, out: { num: 'IZ 1954', dep: '06:30', arr: '10:15', dur: '3ש\' 45ד\' ישיר' }, ret: { num: 'IZ 1955', dep: '21:00', arr: '00:10', dur: '3ש\' 10ד\' ישיר' } },
      { name: 'Aegean Sky Air', priceDelta: 120, out: { num: 'A3 954', dep: '13:10', arr: '16:55', dur: '3ש\' 45ד\' ישיר' }, ret: { num: 'A3 955', dep: '18:20', arr: '21:35', dur: '3ש\' 15ד\' ישיר' } },
    ],
    base: 4180, terminal: 'נתב"ג · טרמינל 3',
    itinerary: {
      1: [['✈️', '11:20', 'טיסה מישראל להרקליון', 'נחיתה בשדה התעופה של סנטוריני, כ-25 ק"מ מהמלון.'], ['🚐', '14:15', 'נהג פרטי מחכה בשדה התעופה', 'שילוט עם שמכם, נסיעה ישירה למלון.'], ['🏨', '15:00', 'צ׳ק אין במלון', 'קבלת פנים וכוס ברוכים הבאים.'], ['🌅', '17:00', 'חוף אמוררה', 'חוף חול שחור וולקני, 10 דקות מהמלון.'], ['🍽️', '20:30', 'ארוחת ערב במסעדה מומלצת', 'דגים טריים ונוף לקלדרה.']],
      2: [['🍳', '09:00', 'ארוחת בוקר במלון', 'מגוון ים תיכוני, טרסה עם נוף.'], ['⛵', '11:00', 'טיול סירה בקלדרה', 'שייט קטרמרן לאיים הוולקניים, עצירת שנורקלינג.'], ['🍷', '15:30', 'טעימת יין בכרם מקומי', 'יקבים מקומיים על מדרונות הקלדרה.'], ['🌇', '19:00', 'שקיעה באויה', 'נקודת התצפית המפורסמת ביותר באי.'], ['🍽️', '21:00', 'ארוחת ערב בעיר', 'מסעדה עם מרפסת פונה לים.']],
      3: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🏖️', '10:30', 'יום חופשי בחוף האדום', 'חול אדמדם ומצוקים דרמטיים.'], ['🍽️', '13:00', 'ארוחת צהריים ליד החוף', ''], ['🛍️', '17:00', 'שוק וזמן חופשי לקניות', 'סמטאות פירה עם גלריות ותכשיטנים.'], ['🍽️', '20:30', 'ארוחת ערב', '']],
      4: [['🧺', '09:30', 'ארוחת בוקר מאוחרת', ''], ['🏛️', '11:00', 'סיור בפירה העתיקה', 'עיר הבירה ההיסטורית על שפת המצוק.'], ['🍽️', '14:00', 'ארוחת צהריים', ''], ['🌅', '18:30', 'שקיעה בפוקאמו', 'חוף שקט, פחות תיירים.'], ['🍽️', '20:30', 'ארוחת ערב פרידה', '']],
      5: [['🧳', '10:00', 'צ׳ק אאוט מהמלון', ''], ['🚐', '11:30', 'נהג פרטי לשדה התעופה', ''], ['✈️', '14:15', 'טיסת חזרה לישראל', '']],
    },
  },
  thailand: {
    label: 'פוקט, תאילנד', code: 'HKT',
    hotel: ['Andaman Palm Resort', 'Patong Bay Villas', 'Lotus Garden Hotel'],
    nearbyCities: ['בנגקוק, תאילנד', 'קראבי, תאילנד', 'צ׳יאנג מאי, תאילנד'],
    airlines: [
      { name: 'אל על', priceDelta: 0, out: { num: 'LY 083', dep: '02:40', arr: '15:55', dur: '9ש\' 15ד\' ישיר' }, ret: { num: 'LY 084', dep: '17:20', arr: '23:50', dur: '9ש\' 30ד\' ישיר' } },
      { name: 'Orient Pacific Air', priceDelta: 170, out: { num: 'OP 771', dep: '23:50', arr: '13:20+1', dur: '10ש\' 30ד\' ישיר' }, ret: { num: 'OP 772', dep: '15:00', arr: '21:10', dur: '10ש\' 10ד\' ישיר' } },
      { name: 'Golden Lotus Air', priceDelta: -350, out: { num: 'GL 118', dep: '04:15', arr: '18:40', dur: '10ש\' 25ד\' (עצירה)' }, ret: { num: 'GL 119', dep: '20:10', arr: '02:55+1', dur: '10ש\' 45ד\' (עצירה)' } },
    ],
    base: 5150, terminal: 'נתב"ג · טרמינל 3',
    itinerary: {
      1: [['✈️', '02:40', 'טיסה מישראל לפוקט', 'טיסה עם עצירה קצרה, נחיתה אחר הצהריים.'], ['🚐', '16:30', 'העברה למלון', ''], ['🏨', '17:15', 'צ׳ק אין במלון', ''], ['🌴', '18:30', 'זמן חופשי בחוף פאטונג', 'חוף עירוני תוסס עם שקיעה יפה.'], ['🍽️', '20:30', 'ארוחת ערב תאית', '']],
      2: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['⛵', '10:30', 'טיול סירה לאיי פי-פי', 'מים טורקיז ומצוקי אבן גיר.'], ['🏝️', '13:00', 'זמן חופשי בחוף מיה ביי', ''], ['🌇', '18:00', 'חזרה למלון', ''], ['🍽️', '20:00', 'ארוחת ערב', '']],
      3: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🏖️', '10:30', 'יום חופשי בחוף קטה', 'חוף שקט יותר בדרום האי.'], ['🛍️', '17:00', 'שוק לילה בפוקט טאון', 'דוכני אוכל רחוב ואומנות מקומית.'], ['🍽️', '20:30', 'ארוחת ערב בשוק', '']],
      4: [['🧘', '09:30', 'שיעור בישול תאי', 'למידת מנות מקומיות עם שף.'], ['🏛️', '13:00', 'סיור בפוקט טאון העתיקה', 'אדריכלות סינו-פורטוגזית צבעונית.'], ['💆', '16:00', 'עיסוי תאי מסורתי', ''], ['🌅', '18:30', 'שקיעה בנקודת התצפית פרומטפ', ''], ['🍽️', '20:30', 'ארוחת ערב פרידה', '']],
      5: [['🧳', '11:00', 'צ׳ק אאוט מהמלון', ''], ['🚐', '13:00', 'העברה לשדה התעופה', ''], ['✈️', '17:20', 'טיסת חזרה לישראל', '']],
    },
  },
  italy: {
    label: 'רומא, איטליה', code: 'FCO',
    hotel: ['Via Roma Boutique Hotel', 'Trastevere Suites', 'Colosseo Palace'],
    nearbyCities: ['פירנצה, איטליה', 'ונציה, איטליה', 'נאפולי, איטליה'],
    airlines: [
      { name: 'אל על', priceDelta: 0, out: { num: 'LY 386', dep: '07:15', arr: '10:05', dur: '3ש\' 50ד\' ישיר' }, ret: { num: 'LY 387', dep: '20:30', arr: '00:55', dur: '3ש\' 25ד\' ישיר' } },
      { name: 'ישראייר', priceDelta: -220, out: { num: '6H 632', dep: '05:45', arr: '08:35', dur: '3ש\' 50ד\' ישיר' }, ret: { num: '6H 633', dep: '22:15', arr: '02:35+1', dur: '3ש\' 20ד\' ישיר' } },
      { name: 'Alpine Sky', priceDelta: 180, out: { num: 'AS 442', dep: '09:30', arr: '12:20', dur: '3ש\' 50ד\' ישיר' }, ret: { num: 'AS 443', dep: '18:00', arr: '22:20', dur: '3ש\' 20ד\' ישיר' } },
    ],
    base: 3890, terminal: 'נתב"ג · טרמינל 3',
    itinerary: {
      1: [['✈️', '07:15', 'טיסה מישראל לרומא', ''], ['🚐', '10:40', 'העברה למלון', ''], ['🏨', '11:30', 'צ׳ק אין במלון', ''], ['🚶', '13:00', 'סיור רגלי בטרסטבורה', 'רובע קסום עם סמטאות אבן וגפנים.'], ['🍽️', '20:00', 'ארוחת ערב איטלקית', '']],
      2: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🏛️', '10:00', 'סיור בקולוסאום ופורום רומנום', 'לב האימפריה הרומית העתיקה.'], ['🍽️', '13:30', 'ארוחת צהריים', ''], ['⛲', '16:00', 'מזרקת טרווי וספרדית', 'שתי הנקודות המצולמות ביותר ברומא.'], ['🍽️', '20:00', 'ארוחת ערב', '']],
      3: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['⛪', '10:00', 'סיור בוותיקן', 'מוזיאוני הוותיקן וכיפת פייטרו.'], ['🍷', '16:00', 'טעימת יין בכרם טוסקני', 'נסיעה קצרה מחוץ לעיר.'], ['🍽️', '20:00', 'ארוחת ערב', '']],
      4: [['🧺', '09:30', 'ארוחת בוקר מאוחרת', ''], ['🛍️', '11:00', 'שוק קמפו דה פיורי', 'שוק פירות וירקות תוסס בלב העיר.'], ['🍽️', '14:00', 'ארוחת צהריים', ''], ['🌅', '18:30', 'שקיעה מגבעת ג׳ניקולו', 'נקודת התצפית הטובה ביותר על רומא.'], ['🍽️', '20:30', 'ארוחת ערב פרידה', '']],
      5: [['🧳', '10:00', 'צ׳ק אאוט מהמלון', ''], ['🚐', '11:30', 'העברה לשדה התעופה', ''], ['✈️', '20:30', 'טיסת חזרה לישראל', '']],
    },
  },
  portugal: {
    label: 'ליסבון, פורטוגל', code: 'LIS',
    hotel: ['Alfama Ocean Hotel', 'Belém Riverside Suites', 'Bairro Alto Boutique'],
    nearbyCities: ['פורטו, פורטוגל', 'סינטרה, פורטוגל', 'פארו, פורטוגל'],
    airlines: [
      { name: 'אל על', priceDelta: 0, out: { num: 'LY 393', dep: '06:30', arr: '11:15', dur: '6ש\' 45ד\' ישיר' }, ret: { num: 'LY 394', dep: '12:45', arr: '20:20', dur: '6ש\' 35ד\' ישיר' } },
      { name: 'ארקיע', priceDelta: -190, out: { num: 'IZ 1393', dep: '03:20', arr: '09:55', dur: '6ש\' 35ד\' (עצירה)' }, ret: { num: 'IZ 1394', dep: '11:40', arr: '21:50', dur: '7ש\' 10ד\' (עצירה)' } },
      { name: 'TAP Premium', priceDelta: 200, out: { num: 'TP 1900', dep: '08:00', arr: '12:40', dur: '6ש\' 40ד\' ישיר' }, ret: { num: 'TP 1901', dep: '14:10', arr: '21:45', dur: '6ש\' 35ד\' ישיר' } },
    ],
    base: 2790, terminal: 'נתב"ג · טרמינל 3',
    itinerary: {
      1: [['✈️', '06:30', 'טיסה מישראל לליסבון', ''], ['🚐', '12:00', 'העברה למלון', ''], ['🏨', '13:00', 'צ׳ק אין במלון', ''], ['🚶', '15:00', 'סיור רגלי באלפמה', 'הרובע ההיסטורי עם הפאדו והסמטאות.'], ['🍽️', '20:00', 'ארוחת ערב פורטוגזית', '']],
      2: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🚋', '10:00', 'טרם 28 המפורסם', 'נסיעה בחשמלית העתיקה דרך הרובעים ההיסטוריים.'], ['🏛️', '13:00', 'מגדל בלם ומנזר ז\'רונימוש', 'סמלי גילויי הימים הפורטוגזים.'], ['🍽️', '19:30', 'ארוחת ערב', '']],
      3: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🏖️', '10:30', 'יום חופשי בחוף קשקאיש', 'עיירת חוף קסומה שעה מהעיר.'], ['🛍️', '17:00', 'שוק וזמן חופשי לקניות', '']],
      4: [['🧺', '09:30', 'ארוחת בוקר מאוחרת', ''], ['🍷', '11:00', 'טעימת פורטו בכרם', 'יין הדגל של האזור.'], ['🌅', '18:30', 'שקיעה מנקודת התצפית סניורה דו מונטה', ''], ['🍽️', '20:30', 'ארוחת ערב פרידה', '']],
      5: [['🧳', '10:00', 'צ׳ק אאוט מהמלון', ''], ['🚐', '11:00', 'העברה לשדה התעופה', ''], ['✈️', '12:45', 'טיסת חזרה לישראל', '']],
    },
  },
  paris: {
    label: 'פריז, צרפת', code: 'CDG',
    hotel: ['Le Marais Charme Hotel', 'Rive Gauche Suites', 'Montmartre View Hotel'],
    nearbyCities: ['ליון, צרפת', 'ניס, צרפת', 'בורדו, צרפת'],
    airlines: [
      { name: 'אל על', priceDelta: 0, out: { num: 'LY 321', dep: '09:15', arr: '13:00', dur: '4ש\' 45ד\' ישיר' }, ret: { num: 'LY 322', dep: '21:10', arr: '01:35', dur: '4ש\' 25ד\' ישיר' } },
      { name: 'ישראייר', priceDelta: -210, out: { num: '6H 220', dep: '05:30', arr: '09:10', dur: '4ש\' 40ד\' ישיר' }, ret: { num: '6H 221', dep: '23:00', arr: '03:20+1', dur: '4ש\' 20ד\' ישיר' } },
      { name: 'Air France Premium', priceDelta: 230, out: { num: 'AF 1900', dep: '12:00', arr: '15:50', dur: '4ש\' 50ד\' ישיר' }, ret: { num: 'AF 1901', dep: '19:00', arr: '23:20', dur: '4ש\' 20ד\' ישיר' } },
    ],
    base: 3450, terminal: 'נתב"ג · טרמינל 3',
    itinerary: {
      1: [['✈️', '09:15', 'טיסה מישראל לפריז', ''], ['🚐', '13:45', 'העברה למלון', ''], ['🏨', '14:30', 'צ׳ק אין במלון', ''], ['🚶', '16:30', 'סיור רגלי במארה', 'רובע יהודי-פריזאי עם גלריות ובוטיקים.'], ['🍽️', '20:00', 'ארוחת ערב צרפתית', '']],
      2: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🏛️', '10:00', 'סיור במוזיאון הלובר', 'אחד ממוזיאוני האמנות הגדולים בעולם.'], ['🍽️', '13:30', 'ארוחת צהריים', ''], ['🗼', '19:00', 'מגדל אייפל בשעת בין ערביים', ''], ['🍽️', '20:30', 'ארוחת ערב', '']],
      3: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🛍️', '10:30', 'שוק וזמן חופשי לקניות', 'שוק בוחון והרובע השישי.'], ['⛪', '14:00', 'נוטרדאם ואי סן-לואי', ''], ['🍽️', '20:00', 'ארוחת ערב', '']],
      4: [['🧺', '09:30', 'ארוחת בוקר מאוחרת', ''], ['🎨', '11:00', 'סיור במונמארטר', 'רובע האמנים והבזיליקה הלבנה.'], ['🌅', '18:30', 'שקיעה מגבעת מונמארטר', ''], ['🍽️', '20:30', 'ארוחת ערב פרידה', '']],
      5: [['🧳', '10:00', 'צ׳ק אאוט מהמלון', ''], ['🚐', '12:00', 'העברה לשדה התעופה', ''], ['✈️', '21:10', 'טיסת חזרה לישראל', '']],
    },
  },
};
DEST_LIB.default = DEST_LIB.greece;

function detectDestinationOrNull(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('יוון') || t.includes('סנטוריני')) return 'greece';
  if (t.includes('תאילנד')) return 'thailand';
  if (t.includes('איטליה') || t.includes('רומא')) return 'italy';
  if (t.includes('פורטוגל') || t.includes('ליסבון')) return 'portugal';
  if (t.includes('פריז')) return 'paris';
  return null;
}
function detectDestination(text) { return detectDestinationOrNull(text) || 'default'; }
function detectBudget(text) { const m = (text || '').match(/(\d[\d,]{2,})/); return m ? parseInt(m[1].replace(/,/g, ''), 10) : null; }
function detectTravelers(text) { if ((text || '').includes('משפחתית') || /4\s*נוסעים/.test(text || '')) return 4; return 2; }
function detectNights(text) { const m = (text || '').match(/(\d{1,2})\s*(לילות|ימים)/); return m ? Math.max(2, parseInt(m[1], 10) - (m[2] === 'ימים' ? 1 : 0)) : 7; }

function formatDateRange(outStr, retStr) {
  try {
    const fmt = (d) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
    return `${fmt(outStr)} – ${fmt(retStr)}`;
  } catch (e) { return 'אוגוסט 2026'; }
}

function buildPersonalNotes(prefs) {
  if (!prefs) return [];
  const notes = [];
  if (prefs.kosher === 'yes') notes.push('🍽️ המלון שנבחר מציע ארוחות כשרות למהדרין.');
  else if (prefs.kosher === 'flex') notes.push('🍽️ יש אפשרויות כשרות בקרבת המלון אם תרצו.');
  if (prefs.children === 'young') notes.push('🧸 המלון כולל בריכת ילדים ואזור משחקים מוצל.');
  else if (prefs.children === 'kids') notes.push('🎈 מועדון ילדים ופעילויות מונחות בבית המלון.');
  else if (prefs.children === 'teens') notes.push('🏄 באזור יש גם אטרקציות ופעילויות שמתאימות לבני נוער.');
  if (prefs.occasion === 'honeymoon') notes.push('💍 שדרוג רומנטי לחדר ופינוק בהגעה, ליום המיוחד שלכם.');
  else if (prefs.occasion === 'birthday') notes.push('🎂 עוגת יום הולדת קטנה תחכה לכם בחדר.');
  else if (prefs.occasion === 'reunion') notes.push('👨‍👩‍👧‍👦 סידרנו חדרים סמוכים ככל האפשר לכל המשפחה.');
  if (prefs.vibe === 'beach') notes.push('🏖️ המסלול הודגש לכיוון זמן חוף וים.');
  else if (prefs.vibe === 'culture') notes.push('🏛️ המסלול כולל דגש על אתרים היסטוריים ותרבות מקומית.');
  else if (prefs.vibe === 'adventure') notes.push('🎢 נוספו פעילויות הרפתקניות למסלול.');
  else if (prefs.vibe === 'food') notes.push('🍷 שולבו חוויות קולינריות וטעימות מקומיות.');
  return notes;
}

// Same generic day-by-day template already used on the frontend for its
// own generic-city fallback, mirrored here so a destination resolved
// dynamically via Google Places on the backend gets a real 5-day starting
// itinerary too, not an empty one.
function genericItinerary(city) {
  return {
    1: [['✈️', '10:00', `טיסה מישראל ל${city}`, ''], ['🚐', '14:00', 'העברה למלון', ''], ['🏨', '15:00', 'צ׳ק אין במלון', ''], ['🚶', '17:00', `סיור היכרות ראשוני ב${city}`, `טיול רגלי קליל להתמצאות במרכז ${city}.`], ['🍽️', '20:00', 'ארוחת ערב במסעדה מקומית מומלצת', `נבחרה עבורכם מסעדה טובה במרכז ${city}.`]],
    2: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🏛️', '10:30', `סיור באתרים המרכזיים של ${city}`, `האתרים וההיסטוריה שהופכים את ${city} ליעד מבוקש.`], ['🍽️', '13:30', 'ארוחת צהריים', ''], ['🛍️', '16:00', 'זמן חופשי לשופינג ובילויים', ''], ['🍽️', '20:00', 'ארוחת ערב במסעדה מומלצת', '']],
    3: [['🍳', '09:00', 'ארוחת בוקר במלון', ''], ['🎢', '10:30', 'יום חופשי או טיול יום מאורגן', `אפשרות ליציאה לאזורים סמוכים ל${city} או יום פנוי.`], ['🍽️', '13:30', 'ארוחת צהריים', ''], ['🌅', '18:30', 'שקיעה מנקודת תצפית מומלצת', ''], ['🍽️', '20:30', 'ארוחת ערב', '']],
    4: [['🧺', '09:30', 'ארוחת בוקר מאוחרת', ''], ['🎨', '11:00', 'זמן חופשי לתחומי עניין אישיים', ''], ['🍽️', '14:00', 'ארוחת צהריים', ''], ['🌇', '18:30', `שקיעה ב${city}`, ''], ['🍽️', '20:30', 'ארוחת ערב פרידה', '']],
    5: [['🧳', '10:00', 'צ׳ק אאוט מהמלון', ''], ['🚐', '11:30', 'העברה לשדה התעופה', ''], ['✈️', '16:20', 'טיסת חזרה לישראל', '']],
  };
}

const TIER_DEFS = [
  { tier: 'value', label: '💰 חסכוני', mult: 0.86, cabin: 'אקונומי', baggage: 'מזוודה 1×20 ק"ג', baggageKey: 'one20' },
  { tier: 'recommended', label: '⭐ מומלץ', mult: 1.0, cabin: 'אקונומי פלוס', baggage: 'מזוודה 1×23 ק"ג + טרולי', baggageKey: 'one23' },
  { tier: 'premium', label: '👑 פרימיום', mult: 1.42, cabin: 'ביזנס', baggage: '2 מזוודות 23 ק"ג + עדיפות בעליה', baggageKey: 'two23' },
];

// Extracted out of buildPackages() so a destination resolved dynamically
// at request time (e.g. via Google Places, when nothing in DEST_LIB
// matched the free text) can go through the exact same tier/pricing math
// as a curated one, instead of duplicating it. `dest` must have the same
// shape as a DEST_LIB entry (label, code, hotel[], airlines[], base,
// terminal, itinerary).
function buildOptionsForDest(dest, destKey, userText, preferences) {
  const budget = detectBudget(userText);
  const travelers = (preferences && preferences.travelers) || detectTravelers(userText);
  const nights = detectNights(userText);
  const dateStr = (preferences && preferences.dates && preferences.dates.out && preferences.dates.ret)
    ? formatDateRange(preferences.dates.out, preferences.dates.ret)
    : 'אוגוסט 2026';
  const personalNotes = buildPersonalNotes(preferences);

  const options = TIER_DEFS.map((t, idx) => {
    const total = Math.round(dest.base * t.mult * (travelers / 2));
    const marketTotal = Math.round(total * 1.16);
    const flight = Math.round(total * 0.36);
    const hotel = Math.round(total * 0.42);
    const transfer = Math.round(total * 0.06);
    const activities = total - flight - hotel - transfer;
    return {
      id: uuidv4(),
      tier: t.tier, tierLabel: t.label, cabin: t.cabin, baggage: t.baggage,
      // Per-traveler baggage selection — the frontend's option detail page
      // (renderOptionDetail) reads these three fields directly and throws
      // if they're missing, which is exactly what was happening for every
      // package that came from this backend (curated or Places-resolved)
      // before these existed here: the "view full package" button
      // appeared to do nothing because the render crashed partway through.
      tierBaggageKey: t.baggageKey,
      baggageAssignments: Array.from({ length: travelers }, () => t.baggageKey),
      baggage_price: 0,
      destination: dest.label, code: dest.code, destKey,
      hotel_name: dest.hotel[idx % dest.hotel.length],
      hotel_photo_url: null,
      airlines: dest.airlines,
      airlineIndex: 0,
      airline_name: dest.airlines[0].name,
      terminal: dest.terminal,
      nights, travelers, dates: dateStr,
      total, marketTotal, flight_price: flight, hotel_price: hotel, transfer_price: transfer, activities_price: activities,
      baseFlightPrice: flight,
      itinerary: dest.itinerary,
      personalNotes: dest.generic ? [
        'יעד שנמצא באמצעות Google Places — פרטי המלון והטיסות כאן הם הערכה כללית, לא נתונים חיים עדיין.',
        ...personalNotes,
      ] : personalNotes,
      reasoning:
        idx === 0 ? 'האופציה החסכונית ביותר שעומדת בתקציב, בלי לוותר על מיקום מרכזי.'
        : idx === 1 ? 'האיזון הכי טוב בין מחיר, מיקום המלון ונוחות הטיסה — הבחירה הפופולרית.'
        : 'שדרוג לחדר עם נוף, טיסה נוחה יותר וזמן פנוי מורחב באטרקציות.',
      // Simple static gradient — the frontend has a full scoring engine
      // (scoreOption) that weighs price/flight/personalization; this
      // backend fallback doesn't reproduce that, but matchScore must be a
      // real number, not undefined, since the option detail page renders
      // it directly as a percentage.
      matchScore: idx === 0 ? 82 : idx === 1 ? 90 : 78,
      scoreReasons: [idx === 0 ? 'האופציה החסכונית ביותר שעומדת בתקציב, בלי לוותר על מיקום מרכזי.'
        : idx === 1 ? 'האיזון הכי טוב בין מחיר, מיקום המלון ונוחות הטיסה — הבחירה הפופולרית.'
        : 'שדרוג לחדר עם נוף, טיסה נוחה יותר וזמן פנוי מורחב באטרקציות.'],
      source: 'mock',
    };
  });

  return { id: uuidv4(), userText, budget, travelers, nights, destination: dest.label, options };
}

function buildPackages(userText, preferences) {
  const destKey = detectDestination(userText);
  const dest = DEST_LIB[destKey];
  return buildOptionsForDest(dest, destKey, userText, preferences);
}

module.exports = { buildPackages, buildOptionsForDest, genericItinerary, DEST_LIB, detectDestination, detectDestinationOrNull };
