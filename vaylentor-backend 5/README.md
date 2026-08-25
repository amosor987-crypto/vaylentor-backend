# VAYLENTOR — Backend

זהו ה-backend האמיתי שמחליף את "מצב ההדגמה" בפרונטאנד: הרשמה/כניסה אמיתית (כולל Google), שמירת משתמשים והזמנות במסד נתונים, ותשתית ל-Stripe אמיתי.

**חשוב לדעת מראש:** נתוני הטיסות/מלונות עדיין **מדומים** (ראו `src/mockData.js`) — כפי שביקשת, זו נקודת ההתחלה, ונשדרג לספק אמיתי (כמו Amadeus) בהמשך. כל שאר המערכת (הרשמה, תשלום, הזמנות) כבר אמיתית ועובדת.

---

## 1. הרצה מקומית (לבדיקה לפני פריסה)

```bash
cd vaylentor-backend
npm install
cp .env.example .env
```

פתחו את `.env` ומלאו לפחות:
```
JWT_SECRET=<תריצו: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

הרצה:
```bash
npm start
```

השרת יעלה על `http://localhost:4000`. אפשר לבדוק שהוא חי:
```bash
curl http://localhost:4000/
```

בשלב הזה עדיין **אין** Google login מוגדר — הרשמה/כניסה עם אימייל+סיסמה כן יעבדו. נגדיר Google בסעיף 3.

---

## 2. חיבור הפרונטאנד המקומי

בקובץ `vaylentor.html`, ודאו ש:
```js
const API_BASE = "http://localhost:4000";
```

פתחו את הקובץ בדפדפן (הכי נוח: `npx serve .` בתיקיית הפרונטאנד, כדי לקבל כתובת אמיתית כמו `http://localhost:5500` — Google OAuth לא עובד טוב מ-`file://`).

---

## 3. הגדרת Google Login (חינמי)

1. כנסו ל-[Google Cloud Console](https://console.cloud.google.com/) → צרו פרויקט חדש (או השתמשו בקיים).
2. **APIs & Services → OAuth consent screen** → בחרו "External" → מלאו שם אפליקציה (VAYLENTOR), אימייל תמיכה, ושמרו. אין צורך לפרסם עדיין — אבל **חשוב**: כל עוד ה-consent screen במצב "Testing", **חייבים** להוסיף את כתובת האימייל שאיתה תתחברו כ-**Test user** (באותו מסך, למטה) — אחרת ההתחברות תיכשל עם שגיאת "access blocked".
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:4000/auth/google/callback` (לבדיקה מקומית). כשתפרסו לפרודקשן תוסיפו גם את `https://<הכתובת-של-הבקאנד-שלכם>/auth/google/callback`.
   - **חשוב**: הכתובת חייבת להיות זהה תו-בתו (כולל http/https ו-trailing slash) למה שהשרת בפועל שולח — אחרת תקבלו `redirect_uri_mismatch`.
4. תעתיקו את ה-**Client ID** וה-**Client Secret** ל-`.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   BACKEND_URL=http://localhost:4000
   FRONTEND_URL=http://localhost:5500
   ```
5. הפעילו מחדש את השרת (`npm start`).
6. **בדקו את עצמכם** — פתחו בדפדפן: `http://localhost:4000/api/status`. זה מראה בדיוק מה מוגדר (Google/Stripe/Amadeus) בלי לנחש, כולל את ה-`expectedRedirectUri` המדויק שהשרת מצפה לו — תוודאו שהוא זהה למה שרשמתם ב-Google Cloud Console.
7. בפרונטאנד, כפתור "המשך עם Google" ינווט ל-`{API_BASE}/auth/google` — Google יחזיר את המשתמש לכתובת ה-frontend עם `?token=...`, והפרונטאנד ישמור את הטוקן ויתחבר אוטומטית. אם משהו נכשל, תחזרו עם `?authError=<סיבה>` — תראו את זה בכתובת ה-URL.

### תקלות נפוצות
| שגיאה | סיבה | פתרון |
|---|---|---|
| `redirect_uri_mismatch` | הכתובת שנשלחה בפועל לא זהה למה שרשום ב-Google Cloud Console | בדקו ב-`/api/status` את `expectedRedirectUri` והשוו תו-בתו |
| "This app is blocked" / access blocked | ה-consent screen במצב Testing והאימייל שלכם לא ברשימת Test users | OAuth consent screen → Test users → הוסיפו את עצמכם |
| טוקן/session נעלם אחרי 7 ימים | אפליקציות במצב Testing עם External user type — Google מגביל טוקנים ל-7 ימים | זה תקין במצב פיתוח; יעלם כשתעברו את האפליקציה למצב Production ב-Google Cloud |

---

## 4. פריסה ל-Render (מומלץ להתחלה — יש שכבה חינמית)

1. דחפו את תיקיית `vaylentor-backend` ל-repo ב-GitHub.
2. ב-[Render](https://render.com) → **New → Web Service** → חברו את ה-repo.
3. Root Directory: `vaylentor-backend` (אם היא לא בשורש ה-repo).
4. Build Command: `npm install` | Start Command: `npm start`.
5. הוסיפו את משתני הסביבה (כמו ב-`.env`, כולל `BACKEND_URL` = הכתובת ש-Render נותנת לכם, למשל `https://vaylentor-backend.onrender.com`, ו-`FRONTEND_URL` = הכתובת שבה תארחו את `vaylentor.html`).
6. עדכנו ב-Google Cloud Console את ה-redirect URI לכתובת האמיתית: `https://vaylentor-backend.onrender.com/auth/google/callback`.
7. **שימו לב**: בתוכנית החינמית של Render מערכת הקבצים **נמחקת בכל דיפלוי מחדש** — כלומר מסד ה-SQLite (משתמשים, הזמנות) יימחק. זה בסדר לבדיקות; לפני שיש לכם משתמשים אמיתיים, שדרגו לדיסק קבוע (Render, בתשלום) או עברו ל-Postgres (יש להם גם שכבה חינמית ל-90 יום, או תשתמשו ב-Supabase/Neon בחינם). צריך לשנות רק את `src/db.js`.

### חלופה: Railway
אותו תהליך בערך — `railway login`, `railway init`, `railway up` מתוך התיקייה, ואז מגדירים משתני סביבה בדשבורד. ל-Railway יש Volumes (דיסק קבוע) גם בשכבה החינמית המוגבלת — נוח יותר אם רוצים שה-SQLite ישרוד רסטארטים.

---

## 5. פריסת הפרונטאנד

`vaylentor.html` הוא קובץ סטטי אחד — אפשר להעלות אותו ל:
- **Netlify** (גרירה ושחרור של הקובץ, הכי מהיר)
- **Vercel**
- **GitHub Pages**

אחרי שיש לכם כתובת (למשל `https://vaylentor.netlify.app`):
1. עדכנו את `FRONTEND_URL` ב-backend (ב-Render/Railway) לכתובת הזו.
2. עדכנו בקובץ `vaylentor.html` את `API_BASE` לכתובת ה-backend שלכם.

---

## 6. חיבור Stripe אמיתי (אופציונלי בשלב זה)

בלי מפתחות Stripe, ה-checkout רץ במצב "mock" (מדומה) אוטומטית — זה בסדר לבדיקות.

כשתהיו מוכנים:
1. פתחו חשבון ב-[Stripe](https://stripe.com), קחו **Test** keys קודם.
2. `.env` בבקאנד: `STRIPE_SECRET_KEY=sk_test_...`
3. ב-`vaylentor.html`: `STRIPE_PUBLISHABLE_KEY = "pk_test_..."`
4. בדקו עם [כרטיס הבדיקה](https://stripe.com/docs/testing) `4242 4242 4242 4242`.
5. רק כשהכל עובד במצב Test — עברו למפתחות Live.

---

## 7. חיבור Amadeus — נתוני טיסות ומלונות אמיתיים (חינמי להתחלה)

זה מחליף את `src/mockData.js` בנתונים אמיתיים מ-Amadeus (אחד משלושת ה-GDS הגדולים בעולם, לצד Sabre ו-Travelport). ההרשמה לסביבת ה-sandbox חינמית ומיידית — אין צורך באישור עסקי.

### הרשמה (5 דקות)
1. כנסו ל-[developers.amadeus.com](https://developers.amadeus.com) → **Register** → מלאו טופס → אשרו במייל שיישלח.
2. אחרי ההתחברות: **My Self-Service Workspace → Create new app**.
3. תנו לאפליקציה שם (למשל "VAYLENTOR") — תקבלו מיד **API Key** ו-**API Secret**.
4. הוסיפו ל-`.env`:
   ```
   AMADEUS_CLIENT_ID=<API Key>
   AMADEUS_CLIENT_SECRET=<API Secret>
   AMADEUS_ENV=test
   USE_AMADEUS=true
   ```
5. הפעילו מחדש את השרת, ואז תבדקו את עצמכם עם הסקריפט המצורף:
   ```bash
   npm run test:amadeus
   ```
   הסקריפט הזה באמת מתחבר ל-Amadeus, מבקש טוקן, מחפש טיסה אמיתית ל-JTR (סנטוריני) ומלון, ומדפיס לכם את התוצאה הגולמית — כדי שתראו בעצמכם אם זה עובד, ואם תמונות מלון חוזרות בחשבון שלכם (זה משתנה בין חשבונות ואני לא יכול להבטיח את זה מראש — הרצת הסקריפט היא הדרך היחידה לדעת בוודאות).

### מה חשוב להבין על סביבת ה-Sandbox
- `AMADEUS_ENV=test` (ברירת המחדל) משתמש **בנתוני בדיקה מוגבלים של Amadeus עצמם** — לא מלאי אמיתי חי. זה טוב לפיתוח, לא לפרודקשן.
- כדי לקבל מחירים/זמינות אמיתיים, תצטרכו להעביר את האפליקציה ל-**production** בדשבורד של Amadeus (עדיין באותה שכבת Self-Service, בתשלום לפי שימוש מעבר למכסה החינמית החודשית).
- **תמונות מלון**: ה-API של Amadeus ב-tier החינמי לא תמיד כולל תמונות בתשובה (זה תלוי בחשבון/הסכם) — לכן הקוד ב-`src/providers/amadeusTrips.js` בודק אם `hotel.media` קיים, ואם לא — האתר **חוזר אוטומטית לאיור** במקום לשבור את הדף. הרצת `npm run test:amadeus` תראה לכם בדיוק מה קורה אצלכם.
- אם `/api/trips/plan` מקבל תשובה מ-Amadeus בלי שגיאה, זה תמיד ינסה קודם; אם משהו נכשל (אין נתונים למסלול הזה ב-sandbox, טעות רשת, מכסה נגמרה) — הוא נופל אוטומטית בחזרה ל-`src/mockData.js`, כדי שהאתר לעולם לא יישבר.
- בדקו את המצב שלכם בכל רגע ב-`GET /api/status`.

### השלב הבא (כשתהיו מוכנים לייצור אמיתי)
- להעביר את אפליקציית Amadeus למצב Production.
- לשקול Enterprise APIs של Amadeus אם תזדקקו לתמונות עשירות/תוכן מלא (יש להם Hotel Content API נפרד ברמת Enterprise).
- לחלופין, לשלב ספק תמונות ייעודי (למשל Google Places Photos או הסכם ישיר מול רשתות המלונות) לצד Amadeus למחירים/זמינות.

---

## 8. חיבור Google Places — תמונות אמיתיות של מלונות, מסעדות ואטרקציות

**זה ה-API הנכון לתמונות אמיתיות** — לא Amadeus. Amadeus נותן מחירים/זמינות של טיסות ומלונות, אבל כמעט אף פעם לא תמונות, ובכלל לא מכסה מסעדות ואטרקציות. Google Places מכסה כמעט כל עסק אמיתי בעולם, כולל תמונות.

### הגדרה (דורש כרטיס אשראי — זו דרישה של גוגל, לא שלנו)
1. [console.cloud.google.com](https://console.cloud.google.com) → פרויקט חדש (או קיים).
2. **APIs & Services → Library** → חפשו **"Places API (New)"** → Enable.
3. **Billing** → חברו אמצעי תשלום. גוגל נותנת קרדיט חינמי חוזר מדי חודש, אבל כרטיס חייב להיות רשום — אין דרך לעקוף את זה.
4. **APIs & Services → Credentials → Create Credentials → API key**. מומלץ להגביל אותו (Restrict key) ל-"Places API (New)" בלבד, ואם אפשר גם לפי כתובת IP של השרת שלכם — זה מפתח שרץ בצד השרת (backend), לא בדפדפן, אז אין סיכון שהוא "יידלף" ללקוחות.
5. `.env`:
   ```
   GOOGLE_PLACES_API_KEY=<המפתח>
   ```
6. תבדקו את עצמכם:
   ```bash
   npm run test:places
   ```
   הסקריפט הזה מחפש בפועל מלון אמיתי ומדפיס לכם קישור לתמונה — תפתחו אותו בדפדפן ותוודאו שזו באמת תמונה של המקום.

### ⚠️ נקודה חשובה שחייבים להבין
Google Places עובד **רק על שמות עסקים אמיתיים**. אם תחפשו "Aegean Blue Suites" (שם המלון הבדוי שב-`src/mockData.js`) — לא תקבלו כלום, או גרוע יותר, תקבלו תמונה של עסק **לא קשור** עם שם דומה. בגלל זה, ההעשרה בתמונות (ב-`src/providers/amadeusTrips.js`) **מופעלת רק כשהמלון הגיע מ-Amadeus האמיתי** (ששם המלון בו הוא אמיתי) — היא **לא** מנסה להעשיר את הנתונים המדומים ב-`src/mockData.js`, כי זה היה נותן תמונות מטעות.

**המשמעות בפועל:** תמונות אמיתיות של מלונות יופיעו רק כש-Amadeus **וגם** Google Places מוגדרים שניהם ביחד. תמונות אמיתיות של מסעדות/אטרקציות ספציפיות מתוך מסלול הטיול היומי — **עדיין לא בנוי** בסבב הזה, כי זה דורש להחליף את תוכן המסלול הקבוע (שכרגע מבוסס על שמות לדוגמה) בתוצאות חיפוש חיות מ-Google Places לכל פעילות בנפרד. זה אפשרי, אבל שלב נפרד — תגידו אם תרצו שנבנה את זה הבא.

---

## 9. חיבור Claude — צ'אט שמבין באמת, לא רק מילות מפתח

זה מחליף את זיהוי מילות המפתח הפשוט (שמזהה רק "יוון"/"תאילנד"/וכו') בהבנה אמיתית של מה שהאדם כותב — עיר ספציפית, תקציב, בקשות מיוחדות, כל מה שהוא אומר במילים שלו.

### הגדרה
1. [platform.claude.com](https://platform.claude.com) → היכנסו/הירשמו.
2. **Settings → Billing** → הוסיפו אמצעי תשלום. זה תשלום לפי שימוש בפועל (Pay-as-you-go), אין מנוי חודשי — מומלץ להתחיל עם 5-10$ בלבד.
3. **Settings → API keys → Create key** → תנו שם (למשל "VAYLENTOR") → העתיקו את המפתח (מתחיל ב-`sk-ant-`) — **מוצג פעם אחת בלבד**.
4. `.env`:
   ```
   ANTHROPIC_API_KEY=<המפתח>
   ```
5. בדקו את עצמכם:
   ```bash
   npm run test:ai
   ```
   הסקריפט שולח 3 הודעות דוגמה בעברית ומדפיס בדיוק מה ה-AI הבין מכל אחת — תוכלו לראות בעצמכם שזה עובד לפני שסומכים עליו.

### איך זה עובד בפועל
- כשההודעה מגיעה ל-`/api/trips/plan`, אם `ANTHROPIC_API_KEY` מוגדר, השרת שולח את ההודעה ל-Claude (מודל Haiku — מהיר וזול, מספיק למשימת חילוץ כזו) ומבקש ממנו לחלץ פרטים: עיר, מדינה, תקציב, כמה מבוגרים/ילדים, כשרות, סגנון חופשה, סיבה מיוחדת, ובקשות אחרות — **רק מה שבאמת נאמר, בלי להמציא**.
- **תשובות מהשאלון המובנה תמיד מנצחות** — אם המשתמש כבר ענה "2 מבוגרים" בשאלון, וה-AI "חשב" שהוא הבין 4 מהטקסט החופשי, השאלון מנצח. ה-AI רק ממלא חורים, לא דורס תשובות מפורשות. בדקתי את זה במפורש.
- אם הקריאה ל-Claude נכשלת (אין מפתח, אין תשלום, בעיית רשת) — הכל נופל בחזרה לזיהוי מילות המפתח הרגיל, בלי לשבור את האתר.

---

## 10. מנוע רווח (Revenue Engine) — שלד בלבד, בלי מספרים בדויים

לפי המסמך העסקי שקיבלנו: "Claude לא אמור להמציא שיעורי עמלה". בהתאם לזה:

- `src/revenueEngine.js` מכיל את **המבנה** (commission, markup, service fee, gross/net revenue, gross/net profit) אבל **כל התנאים המסחריים מוגדרים כ-0** עד שיהיה לכם הסכם אמיתי מול ספק.
- כל הזמנה יוצרת רשומה בטבלת `revenue_transactions` (הלדג'ר הפיננסי) — עם דגל `is_configured` שאומר בבירור אם המספרים אמיתיים או "0 כי עוד לא הוגדר", כדי שאף אחד לא יטעה בין השניים.
- **איך למלא תנאים אמיתיים כשיהיו לכם**: פותחים את `src/revenueEngine.js`, ממלאים את `PROVIDER_COMMERCIAL_TERMS` (למשל `{ amadeus_hotel: { type:'percentage', rate: 0.08 } }` — **רק אם 8% זה מה שבאמת סוכם אתכם**), ואת `SERVICE_FEE_CONFIG` אם תרצו לגבות עמלת שירות משלכם. שום שינוי קוד נוסף לא נדרש — הלדג'ר יתחיל לחשב נכון אוטומטית.

### לוח בקרה בסיסי (Admin Dashboard)
- `GET /api/admin/revenue/summary` — סיכום GMV, עמלות, רווח, לפי יעד.
- `GET /api/admin/bookings` — טבלת כל ההזמנות עם הפירוט הפיננסי.
- שני אלה **דורשים הרשאת אדמין** (לא רק התחברות רגילה) — כי נתונים פיננסיים חייבים להיות מוגבלים למורשים בלבד (כמו שהמסמך העסקי דורש). כדי להפוך את החשבון שלכם לאדמין:
  ```bash
  sqlite3 data.db "UPDATE users SET is_admin = 1 WHERE email = 'you@example.com';"
  ```

---

## 11. Duffel ו-Hotelbeds — למה זה לא כמו Amadeus

אם בעתיד תרצו לעבור/להוסיף את הספקים האלה (כפי שמסמך עסקי אחר הציע):

- **Amadeus** (מה שכבר מחובר) — הרשמה עצמית, מיידית, sandbox חינמי מהרגע הראשון.
- **Duffel** ו-**Hotelbeds** — דורשים **תהליך אישור עסקי מול הספק עצמו** — בדרך כלל חברה רשומה, לפעמים רישיון סוכנות נסיעות, ולפעמים שיחת מכירות. זה לא תהליך שאפשר "לפתוח" מקוד — זה צעד עסקי שאתם צריכים ליזום מול הספקים ישירות (duffel.com/contact, hotelbeds.com).
- **החדשות הטובות**: הארכיטקטורה שכבר בנויה (`src/providers/`) בנויה בדיוק כדי לתמוך בספקים נוספים בלי לשנות את שאר המערכת — אם/כשיהיה לכם אישור מ-Duffel/Hotelbeds, נוסיף `src/providers/duffelTrips.js` באותה צורה בדיוק כמו `amadeusTrips.js`, ו-`routes/trips.js` ינסה אותו לפי אותו סדר עדיפויות.

---

## 12. Google Routes — מרחקים וזמני הליכה אמיתיים

זה חלק מ-Google Maps Platform, **אותו חשבון בדיוק** כמו Google Places (סעיף 8) — לא צריך הרשמה נפרדת.

1. `console.cloud.google.com` → אותו פרויקט שכבר יש לכם → **APIs & Services → Library** → חפשו **"Routes API"** → Enable.
2. זהו — `GOOGLE_PLACES_API_KEY` שכבר יש לכם ב-`.env` עובד גם כאן.
3. שימוש: `POST /api/routes` עם `{ origin: {lat, lng}, destination: {lat, lng}, travelMode: 'WALK' }` מחזיר מרחק וזמן הליכה/נסיעה אמיתיים.

**הערת תמחור:** Google מתמחרת לפי ה-field mask שמבקשים. השתמשתי בשכבה הזולה ביותר (Basic, ~$5 ל-1000 קריאות) — רק מרחק ומשך זמן, בלי פרטי ניווט מלאים. אם תרצו יותר (כמו פוליליין למפה), זה יעלה יותר לכל קריאה — עדכנו את `X-Goog-FieldMask` ב-`src/googleRoutes.js`.

---

## 13. מה עוד מדומה ומה כבר אמיתי

| רכיב | סטטוס |
|---|---|
| הרשמה/כניסה עם אימייל+סיסמה | ✅ אמיתי (bcrypt + JWT) |
| כניסה עם Google | ✅ אמיתי — תלוי בהגדרה נכונה שלכם, בדקו ב-`/api/status` |
| שמירת משתמשים והזמנות (כולל נוסעים ובקשות מיוחדות) | ✅ אמיתי (SQLite) |
| תשלום | ✅ תשתית אמיתית (Stripe), רץ ב-mock אם אין מפתח |
| נתוני טיסות/מלונות | ⚙️ **תשתית אמיתית מוכנה** (`src/providers/amadeusTrips.js`) — עובד ברגע שיש לכם מפתחות Amadeus; נופל בחזרה לנתונים מדומים אוטומטית |
| תמונות מלון אמיתיות | ⚙️ **תשתית אמיתית מוכנה** (`src/googlePlaces.js`) — עובדת כשגם Amadeus וגם Google Places מוגדרים; בדקו עם `npm run test:places` |
| תמונות מסעדות/אטרקציות אמיתיות | ❌ טרם ממומש — דורש חיבור נוסף פר-פעילות במסלול |
| צ'אט שמבין הכל, לא רק מילות מפתח | ⚙️ **תשתית אמיתית מוכנה** (`src/aiParser.js`) — עובד ברגע שיש לכם מפתח Anthropic; נופל בחזרה לזיהוי מילות מפתח אוטומטית |
| ניקוד/הסבר אמיתי לכל חבילה (Scoring Engine) | ✅ אמיתי — בפרונטאנד (`vaylentor.html`), מחושב מהמחיר/תקציב/העדפות בפועל |
| מנוע רווח ולדג'ר פיננסי | ⚙️ **מבנה מוכן, מספרים על 0** (`src/revenueEngine.js`) — עד שיהיה הסכם מסחרי אמיתי |
| לוח בקרה עסקי (Admin Dashboard) | ⚙️ **גרסה בסיסית מוכנה**, מוגנת בהרשאת אדמין |
| Apple Sign In | ❌ טרם ממומש — דורש חשבון Apple Developer בתשלום |
| Duffel / Hotelbeds (טיסות/מלונות/פעילויות/העברות אמיתיות) | ❌ דורש אישור עסקי מהספקים עצמם — לא ניתן לפתוח מקוד |
| Google Routes (מרחקים/זמני הליכה אמיתיים) | ✅ **אמיתי** — אותו חשבון Google Cloud כמו Places |

הצעד הבא ההגיוני: להריץ `npm run test:amadeus`, `npm run test:places` ו-`npm run test:ai` ולראות בעצמכם מה חוזר. אם התוצאות טובות — `/api/trips/plan` כבר ישתמש בהן אוטומטית, שום שינוי קוד נוסף לא נדרש.

