# cbotapi

Cbot backend API at **https://api.cbotworld.com**

Creates live broadcasts on your org YouTube channel and returns RTMP credentials for the Cbot mobile app.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/auth/youtube` | One-time OAuth for org YouTube channel |
| POST | `/broadcasts` | Create broadcast + RTMP key (`{ name, day }`) |
| POST | `/broadcasts/:id/go-live` | Transition to live |
| POST | `/broadcasts/:id/end` | End stream / archive VOD |

All `/broadcasts` routes require header: `X-App-Key: <APP_API_KEY>`

## Environment variables

| Variable | Production value |
|----------|------------------|
| `GOOGLE_REDIRECT_URI` | `https://api.cbotworld.com/auth/youtube/callback` |
| `APP_API_KEY` | shared with mobile app |

## Vercel domain

Add **`api.cbotworld.com`** in Vercel → Settings → Domains, then add the CNAME record Vercel provides in your DNS.
