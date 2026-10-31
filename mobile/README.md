# January Food Scanner — Expo (Android, iOS and Web)

This Expo app uses January AI for real meal-photo analysis and food lookup. The private January API key lives only in the API proxy, never in the Expo bundle.

## 1. Create a January API key

Create an account at [dashboard.january.ai](https://dashboard.january.ai) and create an API key. Keep it private.

## 2. Deploy the API proxy (recommended: Vercel)

The project includes Vercel serverless functions in `api/` and a local Express server for development.

1. Import this project folder into [Vercel](https://vercel.com/new).
2. In Vercel Project Settings → Environment Variables, add `JANUARY_API_KEY` with your private January key. Optionally add `ALLOWED_ORIGIN` with your deployed web-app URL.
3. Deploy. Your API base URL will look like `https://your-project.vercel.app`.
4. In `mobile/.env`, set `EXPO_PUBLIC_API_URL=https://your-project.vercel.app` before building the Expo app.

The serverless endpoints are `/api/analyze`, `/api/foods`, and `/api/credits`. January credentials are added server-side. In the Expo app, all requests are organized in `mobile/services/api.js` (`analyzeFoodPhoto`, `searchFoods`, and `getCredits`); `App.js` calls these functions.

## 3. Run locally

At the project root:

```bash
cp .env.example .env
# Add JANUARY_API_KEY to .env
npm install
npm run dev
```

In a second terminal:

```bash
cd mobile
cp .env.example .env
# For a physical phone, change localhost to your computer's LAN IP, e.g. http://192.168.1.10:8787
npm install
npx expo start
```

- Press `a` for Android, `i` for iOS (macOS), or `w` for web.
- The phone and development computer must be on the same Wi-Fi when using the local API server.
- For web in the same computer, `http://localhost:8787` is normally correct.

## App features

- Take Photo opens the live camera on supported devices.
- Choose Photo opens the device gallery / browser file picker.
- January AI meal scanning returns a meal name, estimated calories, macros and detected foods.
- Food lookup searches January's food database.
- Recent scans are stored locally on the device.
- Optional meal details (e.g. cooking oil or portion notes) are sent with the scan.

## Important

- Never put `JANUARY_API_KEY` in an `EXPO_PUBLIC_*` variable. That would expose it in the mobile/web bundle.
- Photo scans use January API credits; check your January plan and credits dashboard.
- A scan costs may vary by current January plan/endpoint. Confirm current pricing in [January pricing](https://january.ai/pricing).
- Photos and nutrition results are estimates, not medical advice.
