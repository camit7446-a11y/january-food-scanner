# Meal scanner for January AI

A React app that turns a meal photo into calories, macros and a per-food breakdown with the
[January AI](https://docs.january.ai) API. It also searches January's food database.

```
Browser (React + Vite)  -->  Express server (holds the sk- key)  -->  https://partners.january.ai/v1.2
```

January's docs say never to ship an `sk-` API key in a web or mobile app. This project follows that:
the browser calls only `/api/...` on your own server, and the server adds the key.

## Run it

1. Create a free account and an API key in the [January Developer Dashboard](https://dashboard.january.ai).
2. In this folder:

```bash
npm install
cp .env.example .env      # then paste your key into JANUARY_API_KEY
npm run dev               # web app on http://localhost:5173, API on :8787
```

For production: `npm run build && npm start` serves the built app and the API from one port (8787).

## What it calls

| Screen | App route | January endpoint | Cost |
|---|---|---|---|
| Scan a meal | `POST /api/analyze` | `POST /v1.2/food-analysis/image` | 10 credits |
| Look up a food | `GET /api/foods` | `GET /v1.2/foods` | 2 credits |
| Credits badge | `GET /api/credits` | `GET /v1.2/credits` | free |

- Photos are resized in the browser to at most 1,600 px before upload (January rejects bodies over 5 MB).
- The default analyzer is January's reasoning analyzer and can take tens of seconds. The "faster standard
  analyzer" checkbox sends `reasoning.effort = "none"`. Both cost the same credits.
- The optional "details" box is sent as January's beta `context` field.
- Your plan's credit allowance is shown in the badge. Check plan details in the dashboard.

## Protecting your credits

A scan costs 10 credits, so the server limits each IP to 20 scans per hour (`SCAN_LIMIT_PER_HOUR`).
Before you publish this app, add real sign-in, and pass your own user id in the `January-End-User-ID`
header (see `endUser()` in `server/index.js`). Replace the in-memory limiter with one stored in Redis or a database
if you run more than one server.

## Project layout

```
server/index.js            Express proxy: adds the key, validates input, maps errors
src/api.js                 Browser client for the proxy + friendly error messages
src/image.js               Resizes photos before upload
src/format.js              Defensive readers for January's nutrient objects
src/components/ScanTab.jsx Photo, options, scan button, recent scans (saved in localStorage)
src/components/NutritionPanel.jsx  Result shown as a Nutrition Facts style label
src/components/SearchTab.jsx       Food database search
```

## Things to verify with your own key

- I built the response handling from January's published examples (`meal_name`, `total_nutrients`,
  `detections[].food`, `confidence_score`). Open "Show raw API response" under the label after your first
  scan and adjust `src/format.js` if your fields differ. Food search results are read from `foods`, `items`
  or `results`.
- Estimates from photos are approximate. Keep the disclaimer in the footer.

## Next steps

Log meals to a diary with January's food-logs endpoints, add glucose prediction, or switch to January's
Web SDK with short-lived client tokens if you want the browser to call January directly.

## Expo mobile app

A native Expo React Native app is included in `mobile/`. It connects to the same secure API proxy as the web app. For production, deploy the included Vercel serverless functions in `api/`, add `JANUARY_API_KEY` as a Vercel environment variable, and set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your deployment URL. For local development, run `npm run dev` at the root and point the Expo app to the computer's LAN IP.

See `mobile/README.md` for the complete setup. The January API key remains server-side.
