# WelthWest Algo – Dashboard (React + Vite)

Backend repo: Farooq_Bot_Server.

## Local
```
npm install
npm run dev        # http://localhost:5173, proxies /api and /ws to localhost:8000
```

## Deploy on Vercel
1. Import this repo (framework Vite is auto-detected; `vercel.json` handles SPA routing).
2. Environment variable `VITE_API_URL` = your Render backend URL, e.g. `https://welthwest-algo-api.onrender.com` (no trailing slash).
3. Redeploy after changing it. Then set `FRONTEND_URL` and `CORS_ORIGINS` on the backend to this site's URL.
