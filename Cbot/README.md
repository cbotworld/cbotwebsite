# Cbot

Mobile app for going live on YouTube from your phone. Users enter **Name** and **Day**, stream with a burned-in overlay, and videos are saved on your org YouTube channel.

## Project structure

- `backend/` — Node.js API (YouTube Live API, OAuth, RTMP credentials)
- `mobile/` — Expo React Native app **Cbot**

## Prerequisites

1. Google Cloud project with **YouTube Data API v3** enabled
2. OAuth 2.0 **Web application** client ID + secret
3. Org YouTube channel with **live streaming enabled** (24h wait after first enable)
4. Node.js 20+
5. Android Studio (for Android dev build) or a physical Android device

> **Note:** RTMP live streaming requires a **development build** (`expo-dev-client`). Expo Go will not work.

## 1. Backend setup

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback
APP_API_KEY=pick-a-long-random-string
PORT=3000
```

Start the server:

```bash
npm install
npm run dev
```

Authorize the org YouTube account once:

1. Open http://localhost:3000/auth/youtube
2. Sign in with the **shared org YouTube Google account**
3. Copy the refresh token into `YOUTUBE_REFRESH_TOKEN` in `.env`
4. Restart the backend

Health check: http://localhost:3000/health

## Deploy backend to Vercel (api.cbotworld.com)

1. Import [cbotapi](https://github.com/karthikipad2211-collab/cbotapi) on [vercel.com](https://vercel.com)
2. Add environment variables:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `https://api.cbotworld.com/auth/youtube/callback` |
| `YOUTUBE_REFRESH_TOKEN` | empty first, fill after OAuth |
| `APP_API_KEY` | same as mobile app |

3. Deploy, then Vercel → **Settings → Domains** → add **`api.cbotworld.com`**
4. In your DNS provider, add the **CNAME** record Vercel shows (e.g. `api` → `cname.vercel-dns.com`)
5. In **Google Cloud Console** → OAuth client → add redirect URI:
   `https://api.cbotworld.com/auth/youtube/callback`
6. Open `https://api.cbotworld.com/auth/youtube` → sign in with org YouTube account
7. Copy refresh token → set `YOUTUBE_REFRESH_TOKEN` in Vercel → **Redeploy**
8. Test: `https://api.cbotworld.com/health`

`cbotworld.com` stays free for your main website later.

### Mobile app

```env
EXPO_PUBLIC_API_BASE_URL=https://api.cbotworld.com
EXPO_PUBLIC_APP_API_KEY=your-app-api-key
```

Rebuild after changing `.env` (`npx expo run:android`).

## 2. Mobile setup (Cbot)

```bash
cd mobile
cp .env.example .env
```

Edit `mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
EXPO_PUBLIC_APP_API_KEY=same-as-backend-APP_API_KEY
```

- **Android emulator:** use `http://10.0.2.2:3000`
- **Physical phone:** use your PC LAN IP, e.g. `http://192.168.1.10:3000`

Create a development build:

```bash
npm install
npx expo prebuild
npx expo run:android
```

Or with EAS:

```bash
npx eas build --profile development --platform android
```

## 3. How to use

1. Open **Cbot**
2. Enter **Name** and **Day**
3. Tap **Start Live Session**
4. Tap **Go Live** — app creates a YouTube broadcast, streams RTMP, shows Name/Day on video
5. Tap **Watch on YouTube** to open the live page
6. Tap **Stop** when done — YouTube archives the VOD on your channel

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/auth/youtube` | One-time OAuth for org channel |
| POST | `/broadcasts` | Create broadcast + RTMP key (`{ name, day }`) |
| POST | `/broadcasts/:id/go-live` | Transition to live |
| POST | `/broadcasts/:id/end` | End stream / archive VOD |

All `/broadcasts` routes require header: `X-App-Key: <APP_API_KEY>`

## Scaling note

~250 API units per stream start. 100 users/day needs ~25k daily quota + possible YouTube live create rate approval from Google.

## License

Private — Cbot
