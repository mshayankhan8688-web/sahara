# HeartSpace API

Express, MongoDB, Gemini, and Google Places. The site lives in `../frontend`. Full setup, including Atlas, Gemini, Places, and deployment, is in `../frontend/README.md`.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

`MONGODB_URI` and `JWT_SECRET` are required. Leave the Google keys empty until you have them. The API then reports that AI or restaurant search is not configured instead of inventing a reply or a restaurant.

```powershell
npm test
```
