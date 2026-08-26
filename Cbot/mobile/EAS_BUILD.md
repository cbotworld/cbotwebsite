# Cbot — EAS Cloud Build (Android)

Build the app in Expo's cloud — no Android Studio required.

## 1. Install & login (one time)

```powershell
cd C:\Users\Karthik Burra\Projects\Cbot\mobile
npm install
npx eas login
```

Sign in with your Expo account (create free account at https://expo.dev if needed).

## 2. Link project to Expo

```powershell
npx eas init
```

Choose **Create a new project** when prompted. This adds `projectId` to `app.json`.

## 3. Start cloud build (first time — run in your terminal)

**First build must be interactive** (to create Android signing key):

```powershell
cd C:\Users\Karthik Burra\Projects\Cbot\mobile
npx eas build --profile development --platform android
```

When prompted:
- **Generate a new Android Keystore?** → Yes / Let EAS handle it
- Accept defaults for other prompts

Build takes ~10–20 min. Track at: https://expo.dev/accounts/krackbotstudio/projects/cbot

Later builds can use:
```powershell
npm run build:android
```

## 4. Install on phone

1. Open the build URL on your phone (from EAS dashboard)
2. Download and install the APK
3. Allow **Install from unknown sources** if Android asks

## 5. Run dev server (optional, for hot reload)

After installing the dev client APK:

```powershell
npx expo start --dev-client
```

Scan the QR code from the Cbot app on your phone.

## Environment variables

Already set in `eas.json` for all profiles:

- `EXPO_PUBLIC_API_BASE_URL=https://api.cbotworld.com`
- `EXPO_PUBLIC_APP_API_KEY=...`

To change them later, edit `eas.json` or use:

```powershell
npx eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.cbotworld.com
```

## Profiles

| Profile | Use |
|---------|-----|
| `development` | Dev client with RTMP — **use this first** |
| `preview` | Internal APK for testing |
| `production` | Release APK |
