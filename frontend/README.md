# SAHARA

SAHARA is the everyday AI assistant in `frontend/` and `backend/`. The Swazz internship portal at the repository root is a separate app and is unchanged.

The public website, Google Play, and the App Store are not published. Do not treat a local URL as a store listing.

Accounts, chats, journals, tasks, plans, and preferences live in MongoDB. Replies come from Google Gemini. Restaurant cards come from Google Places when `GOOGLE_PLACES_API_KEY` is set, and otherwise from OpenStreetMap. Missing fields stay blank. Nothing is filled in with sample restaurants or scripted AI replies.

There is no public URL yet. Deployment below is the path to create one. It has not been run from this project.

## Run the API

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

The API listens on http://localhost:4000. It will not start until `MONGODB_URI` and `JWT_SECRET` are set.

## Run the site

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://localhost:5173. Choose **Start Chatting**, create an account, and sign in. Passwords are hashed with bcrypt on the server.

## MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/atlas.
2. Create a database user and allow your IP (or `0.0.0.0/0` while testing).
3. Copy the connection string into `backend/.env` as `MONGODB_URI`.
4. Use a database name such as `heartspace`.

## Gemini

1. Create a key in Google AI Studio: https://aistudio.google.com/apikey.
2. Set `GEMINI_API_KEY` in `backend/.env`.
3. Set `GEMINI_MODEL=gemini-flash-lite-latest`. If that model is busy, the server tries `gemini-3-flash-preview`. `gemini-2.5-flash` is closed to new keys.
4. Restart the API. The key must never be placed in `frontend/.env`.

Chat text, and a journal entry only after **Share with AI**, is sent to Google to generate the reply. Availability and cost depend on your Gemini plan.

## Restaurant search

1. In Google Cloud, enable **Places API (New)** and billing.
2. Create an API key restricted to that API.
3. Set `GOOGLE_PLACES_API_KEY` in `backend/.env`.
4. Restart the API.

Searches send the food query and, when you allow it, coordinates to Google. The site shows only fields Google returns. Halal status, allergens, and medical suitability are not verified.

### Location permission

On **Restaurants** or in chat, choose **Find restaurants near me** or **Use my location once**. The browser asks once. Deny it and type a city instead, for example `Gulberg, Lahore`. Precise coordinates are stored only if you tick **Save precise location**.

## Deploy

Frontend on Vercel:

- Root directory: `frontend`
- Framework: Vite
- Environment: `VITE_API_URL` = your API origin, with no trailing slash

Backend on Render:

- Root directory: `backend`
- Build: `npm install && npm run build`
- Start: `npm start`
- Environment: every variable in `backend/.env.example`
- For separate Vercel and Render domains set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`
- Set `FRONTEND_URL` to the exact Vercel origin

After both are live, open the Vercel URL, register, and send a message. Do not publish a URL until you have opened it yourself.

## Voice, planner, study, and career

Chat can use the browser microphone and read a reply aloud. That is not a live phone call, and audio is not stored. Tasks and saved plans are stored in MongoDB for the signed-in user. Study and career answers come from Gemini. Live job listings are not connected, so career help must not invent openings.

## Mobile

Android and iOS builds are not generated in this repository. A later Capacitor wrap can reuse this Vite app: install `@capacitor/core` and `@capacitor/cli` inside `frontend`, run `npx cap init SAHARA app.sahara.life --web-dir dist`, then `npx cap add android` and `npx cap add ios` on a Mac for iOS. Microphone and location still need the platform permission prompts. This has not been run here.

## Tests

```powershell
cd backend
npm test
```

The suite checks registration, private journals, missing Gemini, missing Places, and signed-out access. It uses an in-memory MongoDB and does not call Google.
